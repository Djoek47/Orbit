/**
 * IUI session bus — playlist, speech-gated HOLD, barge-in revise, lip-sync.
 */

import { useSyncExternalStore } from 'react';

import { interpretStageSpeech, matchSpokenTokens } from '@/lib/poppins/ui-speech';
import { withComposeProgress } from '@/lib/poppins/iui-compose';
import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';
import {
  HOLD_MS_DEFAULT,
  HOLD_MS_KID,
  NONE_LINGER_MS,
  RESULT_LINGER_MS,
  SETTLE_CLEAR_MS,
  SHOW_MS,
  SPEECH_QUIET_MS,
  sceneNeedsUnfold,
  type IuiBeat,
  type IuiPayload,
  type IuiPhase,
} from '@/lib/poppins/ui-scenes';

export type IuiHapticKind = 'show' | 'hold' | 'settle' | 'veto';

export type IuiStageTap = {
  kind: string;
  text: string;
};

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
let tapHandler: ((tap: IuiStageTap) => void) | null = null;
const tapHandlers = new Set<(tap: IuiStageTap) => void>();

function emitTap(tap: IuiStageTap) {
  tapHandler?.(tap);
  for (const handler of tapHandlers) handler(tap);
}

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
  const merged = { ...beat.payload, ...patch };
  const payload =
    beat.scene === 'task_compose' ? withComposeProgress(merged) : merged;
  const next = { ...beat, payload };
  setState({
    playlist: state.playlist.map((item, i) => (i === state.index ? next : item)),
  });
}

async function settleCurrent(opts?: { fromTap?: boolean }) {
  const beat = currentBeat();
  if (!beat) {
    clear();
    return;
  }
  if (state.speaking && beat.commit === 'hold' && !opts?.fromTap) return;
  setState({ phase: 'settle', holding: false, holdStartedAt: null });
  hapticHandler?.('settle');
  if (beat.scene === 'confirm' && beat.payload.confirmationIds?.length) {
    pendingHandler?.(true, beat.payload.confirmationIds);
  }
  if (beat.scene === 'navigate_coach' && beat.payload.route) {
    coachHandler?.(beat.payload.route);
  } else if (beat.commit !== 'none') {
    try {
      await commitHandler?.(beat);
    } catch {
      setState({
        frozen: true,
        holding: false,
        phase: 'unfold',
        thinkingLine: "Couldn't save that. Tap to try again.",
      });
      return;
    }
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
  setTimeout(() => clear(), SETTLE_CLEAR_MS);
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
  if (beat.payload.composeReady === false) return;
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

/** Named in the utterance — do not wait SHOW before painting. */
function beatCanSkipShow(beat: IuiBeat): boolean {
  if (beat.scene === 'calendar_zoom' || beat.scene === 'itinerary_stage') return false;
  if (!sceneNeedsUnfold(beat.scene)) return true;
  const p = beat.payload;
  if (beat.scene === 'task_compose') {
    return Boolean(p.assignee || p.title || p.libraryTaskId || p.category);
  }
  if (beat.scene === 'grocery_add') return Boolean(p.groceryName);
  return false;
}

function canMergeBeat(current: IuiBeat, incoming: IuiBeat): boolean {
  return current.scene === incoming.scene && current.commit === incoming.commit;
}

function mergeIncomingPlaylist(playlist: IuiBeat[]) {
  const current = currentBeat();
  const incoming = playlist[0];
  if (!current || !incoming || !canMergeBeat(current, incoming)) return false;
  patchCurrentPayload(incoming.payload);
  const rest = playlist.slice(1);
  const kept = state.playlist.slice(0, state.index + 1);
  setState({
    playlist: rest.length ? [...kept, ...rest] : kept,
    live: true,
    thinkingLine: incoming.payload.thinkingLine ?? state.thinkingLine,
  });
  if (state.phase === 'show' && beatCanSkipShow(currentBeat() ?? incoming)) {
    setState({ phase: 'unfold' });
  }
  maybeArmHold();
  return true;
}

function armBeat() {
  clearAllTimers();
  const beat = currentBeat();
  if (!beat || state.frozen) return;
  const skipShow = beatCanSkipShow(beat);
  setState({
    phase: skipShow ? 'unfold' : 'show',
    holding: false,
    holdStartedAt: null,
  });
  hapticHandler?.('show');

  if (beat.commit === 'confirm') {
    if (sceneNeedsUnfold(beat.scene) && !skipShow) scheduleUnfold();
    return;
  }

  if (beat.commit === 'none') {
    const linger =
      beat.scene === 'list_peek' || beat.scene === 'member_pick' || beat.scene === 'result_mark'
        ? RESULT_LINGER_MS
        : NONE_LINGER_MS;
    holdTimer = setTimeout(() => {
      if (state.frozen || currentBeat()?.id !== beat.id) return;
      void settleCurrent();
    }, linger);
    return;
  }

  if (skipShow) {
    maybeArmHold();
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

export type IuiDriveSnapshot = Pick<
  IuiDriveState,
  'playlist' | 'index' | 'phase' | 'frozen' | 'holdMs' | 'thinkingLine'
>;

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
  setTapHandler(handler: ((tap: IuiStageTap) => void) | null) {
    tapHandler = handler;
  },
  subscribeTap(handler: (tap: IuiStageTap) => void) {
    tapHandlers.add(handler);
    return () => {
      tapHandlers.delete(handler);
    };
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
    if (state.live && state.playlist.length && mergeIncomingPlaylist(playlist)) {
      return;
    }
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
      maybeArmHold();
      return;
    }
    maybeArmHold();
  },
  syncSpoken(text: string, memberNames: string[] = []) {
    if (!text.trim()) return;
    setState({ spoken: text });
    if (!state.live) return;
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
  applySpeech(text: string, memberNames: string[] = [], opts?: { selfName?: string }) {
    if (!state.live) return false;
    const steer = interpretStageSpeech(text, {
      memberNames,
      live: true,
      frozen: state.frozen,
      selfName: opts?.selfName,
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
  /** Finger press: stop talking over the choice and apply it now. Auto-HOLD still waits. */
  chooseFromTap(patch: Partial<IuiPayload>, text: string, kind = 'choice') {
    if (state.speaking) setState({ speaking: false });
    poppinsUiOrchestrator.revise(patch);
    emitTap({ kind, text });
  },
  confirm(opts?: { fromTap?: boolean }) {
    if (opts?.fromTap) {
      if (state.speaking) setState({ speaking: false });
      emitTap({ kind: 'confirm', text: 'assign now' });
    }
    clearAllTimers();
    return settleCurrent(opts);
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
  /** Hangup / swipe-away log: keep the act, stop the clock. Not a veto. */
  pause() {
    if (!state.live) return;
    clearAllTimers();
    setState({
      frozen: true,
      holding: false,
      phase: state.phase === 'hold' ? 'unfold' : state.phase,
    });
  },
  snapshot(): IuiDriveSnapshot {
    return {
      playlist: state.playlist,
      index: state.index,
      phase: state.phase,
      frozen: state.frozen,
      holdMs: state.holdMs,
      thinkingLine: state.thinkingLine,
    };
  },
  restore(snapshot: IuiDriveSnapshot, opts?: { resumeHold?: boolean }) {
    if (!snapshot.playlist.length) return;
    clearAllTimers();
    setState({
      live: true,
      playlist: snapshot.playlist,
      index: snapshot.index,
      phase: snapshot.phase === 'hold' ? 'unfold' : snapshot.phase,
      holding: false,
      holdMs: snapshot.holdMs,
      holdStartedAt: null,
      thinkingLine: snapshot.thinkingLine,
      frozen: opts?.resumeHold ? false : true,
      spoken: '',
    });
    if (opts?.resumeHold) {
      maybeArmHold();
    }
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
