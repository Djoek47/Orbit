/**
 * IUI session bus — playlist, speech-gated HOLD, barge-in revise, lip-sync.
 */

import { useSyncExternalStore } from 'react';

import { interpretStageSpeech, matchSpokenTokens } from '@/lib/poppins/ui-speech';
import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';
import {
  HOLD_MS_DEFAULT,
  HOLD_MS_KID,
  SHOW_MS,
  SPEECH_QUIET_MS,
  UNFOLD_MS,
  sceneNeedsUnfold,
  type IuiBeat,
  type IuiPayload,
  type IuiPhase,
} from '@/lib/poppins/ui-scenes';

export type IuiHapticKind = 'show' | 'hold' | 'settle' | 'veto';

export type IuiDriveState = {
  live: boolean;
  playlist: IuiBeat[];
  index: number;
  phase: IuiPhase;
  holding: boolean;
  holdMs: number;
  holdStartedAt: number | null;
  thinkingLine: string;
  frozen: boolean;
  speaking: boolean;
  spoken: string;
};

const EMPTY: IuiDriveState = {
  live: false,
  playlist: [],
  index: 0,
  phase: 'show',
  holding: false,
  holdMs: HOLD_MS_DEFAULT,
  holdStartedAt: null,
  thinkingLine: '',
  frozen: false,
  speaking: false,
  spoken: '',
};

let state: IuiDriveState = EMPTY;
const listeners = new Set<() => void>();
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let unfoldTimer: ReturnType<typeof setTimeout> | null = null;
let quietTimer: ReturnType<typeof setTimeout> | null = null;
let commitHandler: ((beat: IuiBeat) => void | Promise<void>) | null = null;
let coachHandler: ((route: string) => void) | null = null;
let pendingHandler: ((approved: boolean, ids: string[]) => void) | null = null;
let hapticHandler: ((kind: IuiHapticKind) => void) | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<IuiDriveState>) {
  state = { ...state, ...patch };
  emit();
}

function clearHoldTimer() {
  if (holdTimer) clearTimeout(holdTimer);
  holdTimer = null;
}

function clearUnfoldTimer() {
  if (unfoldTimer) clearTimeout(unfoldTimer);
  unfoldTimer = null;
}

function clearQuietTimer() {
  if (quietTimer) clearTimeout(quietTimer);
  quietTimer = null;
}

function clearAllTimers() {
  clearHoldTimer();
  clearUnfoldTimer();
  clearQuietTimer();
}

function currentBeat(): IuiBeat | null {
  return state.playlist[state.index] ?? null;
}

function patchCurrentPayload(patch: Partial<IuiPayload>) {
  const beat = currentBeat();
  if (!beat) return;
  const next = { ...beat, payload: { ...beat.payload, ...patch } };
  setState({
    playlist: state.playlist.map((item, i) => (i === state.index ? next : item)),
  });
}

async function settleCurrent() {
  const beat = currentBeat();
  if (!beat) {
    clear();
    return;
  }
  if (state.speaking && beat.commit === 'hold') return;
  setState({ phase: 'settle', holding: false, holdStartedAt: null });
  hapticHandler?.('settle');
  if (beat.scene === 'confirm' && beat.payload.confirmationIds?.length) {
    pendingHandler?.(true, beat.payload.confirmationIds);
  }
  if (beat.scene === 'navigate_coach' && beat.payload.route) {
    coachHandler?.(beat.payload.route);
  } else if (beat.commit !== 'none') {
    await commitHandler?.(beat);
  }
  const next = state.index + 1;
  if (next < state.playlist.length) {
    setState({
      index: next,
      phase: 'show',
      holding: false,
      thinkingLine: state.playlist[next]?.payload.thinkingLine ?? '',
      spoken: '',
    });
    armBeat();
    return;
  }
  setTimeout(() => clear(), 700);
}

function startHoldClock(beat: IuiBeat) {
  if (state.frozen || state.speaking || currentBeat()?.id !== beat.id) return;
  if (state.holding) return;
  setState({ holding: true, phase: 'hold', holdStartedAt: Date.now() });
  hapticHandler?.('hold');
  clearHoldTimer();
  holdTimer = setTimeout(() => {
    if (state.speaking || state.frozen || currentBeat()?.id !== beat.id) return;
    void settleCurrent();
  }, state.holdMs);
}

function maybeArmHold() {
  const beat = currentBeat();
  if (!beat || beat.commit !== 'hold' || state.frozen || state.speaking) return;
  if (state.holding) return;
  if (sceneNeedsUnfold(beat.scene) && state.phase === 'show') return;
  clearQuietTimer();
  quietTimer = setTimeout(() => {
    if (state.speaking || state.frozen) return;
    startHoldClock(beat);
  }, SPEECH_QUIET_MS);
}

function scheduleUnfold() {
  const beat = currentBeat();
  if (!beat || state.frozen) return;
  if (!sceneNeedsUnfold(beat.scene)) {
    maybeArmHold();
    return;
  }
  clearUnfoldTimer();
  unfoldTimer = setTimeout(() => {
    if (currentBeat()?.id !== beat.id || state.frozen) return;
    if (state.phase === 'show') setState({ phase: 'unfold' });
    maybeArmHold();
  }, SHOW_MS);
}

function armBeat() {
  clearAllTimers();
  const beat = currentBeat();
  if (!beat || state.frozen) return;
  setState({ phase: 'show', holding: false, holdStartedAt: null });
  hapticHandler?.('show');

  if (beat.commit === 'confirm') {
    if (sceneNeedsUnfold(beat.scene)) scheduleUnfold();
    return;
  }

  if (beat.commit === 'none') {
    const linger = beat.scene === 'list_peek' || beat.scene === 'member_pick' ? 1600 : 900;
    holdTimer = setTimeout(() => {
      if (state.frozen || currentBeat()?.id !== beat.id) return;
      void settleCurrent();
    }, linger);
    return;
  }

  scheduleUnfold();
}

function resetHoldProgressOnly() {
  const beat = currentBeat();
  if (!beat || !state.holding || beat.commit !== 'hold') return;
  setState({ holdStartedAt: Date.now() });
  clearHoldTimer();
  holdTimer = setTimeout(() => {
    if (state.speaking || state.frozen || currentBeat()?.id !== beat.id) return;
    void settleCurrent();
  }, state.holdMs);
}

function startPlaylist(playlist: IuiBeat[], kid?: boolean) {
  if (!playlist.length) return;
  clearAllTimers();
  setState({
    live: true,
    playlist,
    index: 0,
    phase: 'show',
    holding: false,
    holdMs: kid ? HOLD_MS_KID : HOLD_MS_DEFAULT,
    holdStartedAt: null,
    thinkingLine: playlist[0]?.payload.thinkingLine ?? '',
    frozen: false,
    spoken: '',
  });
  armBeat();
}

export const poppinsUiOrchestrator = {
  getState(): IuiDriveState {
    return state;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setCommitHandler(handler: ((beat: IuiBeat) => void | Promise<void>) | null) {
    commitHandler = handler;
  },
  setCoachHandler(handler: ((route: string) => void) | null) {
    coachHandler = handler;
  },
  setPendingHandler(handler: ((approved: boolean, ids: string[]) => void) | null) {
    pendingHandler = handler;
  },
  setHapticHandler(handler: ((kind: IuiHapticKind) => void) | null) {
    hapticHandler = handler;
  },
  setSpeaking(speaking: boolean) {
    if (state.speaking === speaking) return;
    if (speaking && state.holding) {
      clearHoldTimer();
      clearQuietTimer();
      setState({ speaking: true, holding: false, phase: 'unfold' });
      return;
    }
    setState({ speaking });
    if (!speaking) maybeArmHold();
  },
  drive(actions: Array<Record<string, unknown>>, opts?: { kid?: boolean; replace?: boolean }) {
    let playlist = mapUiActionsToPlaylist(actions);
    if (opts?.kid) playlist = playlist.filter((beat) => beat.scene !== 'reward_mint');
    if (!playlist.length) return;
    if (state.live && state.playlist.length && !opts?.replace) {
      setState({ playlist: [...state.playlist, ...playlist], live: true });
      return;
    }
    startPlaylist(playlist, opts?.kid);
  },
  splice(actions: Array<Record<string, unknown>>) {
    const extra = mapUiActionsToPlaylist(actions);
    if (!extra.length) return;
    const wasEmpty = !state.playlist.length;
    setState({ playlist: [...state.playlist, ...extra], live: true });
    if (wasEmpty) armBeat();
  },
  revise(patch: Partial<IuiPayload>) {
    const beat = currentBeat();
    if (!beat) return;
    patchCurrentPayload(patch);
    setState({ frozen: false });
    if (state.holding) {
      resetHoldProgressOnly();
      return;
    }
    if (state.phase === 'show' || state.phase === 'unfold' || state.phase === 'hold') {
      return;
    }
  },
  syncSpoken(text: string, memberNames: string[] = []) {
    if (!state.live) return;
    setState({ spoken: text });
    const beat = currentBeat();
    if (!beat) return;
    const names =
      memberNames.length > 0 ? memberNames : (beat.payload.faces ?? []).map((face) => face.name);
    const patch = matchSpokenTokens(text, { memberNames: names, title: beat.payload.title });
    if (Object.keys(patch).length) {
      patchCurrentPayload(patch);
    }
    if (state.phase === 'show' && (patch.spokenName || patch.date || patch.due)) {
      setState({ phase: 'unfold' });
      maybeArmHold();
    }
  },
  applySpeech(text: string, memberNames: string[] = []) {
    if (!state.live) return false;
    const steer = interpretStageSpeech(text, {
      memberNames,
      live: true,
      frozen: state.frozen,
    });
    if (steer.kind === 'freeze') {
      poppinsUiOrchestrator.freeze();
      return true;
    }
    if (steer.kind === 'unfreeze') {
      poppinsUiOrchestrator.unfreeze();
      return true;
    }
    if (steer.kind === 'veto') {
      poppinsUiOrchestrator.veto();
      return true;
    }
    if (steer.kind === 'confirm') {
      poppinsUiOrchestrator.confirm();
      return true;
    }
    if (steer.kind === 'revise') {
      poppinsUiOrchestrator.revise(steer.patch);
      return true;
    }
    if (steer.kind === 'splice') {
      poppinsUiOrchestrator.splice(steer.actions);
      return true;
    }
    return false;
  },
  freeze() {
    clearAllTimers();
    setState({ frozen: true, holding: false, phase: state.phase === 'hold' ? 'unfold' : state.phase });
  },
  unfreeze() {
    setState({ frozen: false });
    maybeArmHold();
  },
  confirm() {
    clearAllTimers();
    void settleCurrent();
  },
  veto() {
    const beat = currentBeat();
    if (beat?.scene === 'confirm' && beat.payload.confirmationIds?.length) {
      pendingHandler?.(false, beat.payload.confirmationIds);
    }
    hapticHandler?.('veto');
    clearAllTimers();
    clear();
  },
  clear,
};

function clear() {
  clearAllTimers();
  const speaking = state.speaking;
  state = { ...EMPTY, speaking };
  emit();
}

export function usePoppinsUiDrive(): IuiDriveState {
  return useSyncExternalStore(
    poppinsUiOrchestrator.subscribe,
    poppinsUiOrchestrator.getState,
    poppinsUiOrchestrator.getState
  );
}
