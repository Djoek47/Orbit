/**
 * IUI session bus — playlist, HOLD assent, barge-in revise.
 */

import { useSyncExternalStore } from 'react';

import { interpretStageSpeech } from '@/lib/poppins/ui-speech';
import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';
import {
  HOLD_MS_DEFAULT,
  HOLD_MS_KID,
  SHOW_MS,
  type IuiBeat,
  type IuiPayload,
  type IuiPhase,
} from '@/lib/poppins/ui-scenes';

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
};

let state: IuiDriveState = EMPTY;
const listeners = new Set<() => void>();
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let commitHandler: ((beat: IuiBeat) => void | Promise<void>) | null = null;
let coachHandler: ((route: string) => void) | null = null;
let pendingHandler: ((approved: boolean, ids: string[]) => void) | null = null;

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

function currentBeat(): IuiBeat | null {
  return state.playlist[state.index] ?? null;
}

async function settleCurrent() {
  const beat = currentBeat();
  if (!beat) {
    clear();
    return;
  }
  setState({ phase: 'settle', holding: false, holdStartedAt: null });
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
    });
    armBeat();
    return;
  }
  setTimeout(() => clear(), 700);
}

function armBeat() {
  clearHoldTimer();
  const beat = currentBeat();
  if (!beat || state.frozen) return;
  setState({ phase: 'show', holding: false });

  if (beat.commit === 'hold') {
    holdTimer = setTimeout(() => {
      if (state.frozen || currentBeat()?.id !== beat.id) return;
      setState({ holding: true, phase: 'hold', holdStartedAt: Date.now() });
      holdTimer = setTimeout(() => {
        if (state.frozen || currentBeat()?.id !== beat.id) return;
        void settleCurrent();
      }, state.holdMs);
    }, SHOW_MS);
    return;
  }

  if (beat.commit === 'confirm') {
    setState({ phase: 'show', holding: false });
    return;
  }

  const linger = beat.scene === 'list_peek' || beat.scene === 'member_pick' ? 1600 : 900;
  holdTimer = setTimeout(() => {
    if (state.frozen || currentBeat()?.id !== beat.id) return;
    void settleCurrent();
  }, linger);
}

function startPlaylist(playlist: IuiBeat[], kid?: boolean) {
  if (!playlist.length) return;
  clearHoldTimer();
  setState({
    live: true,
    playlist,
    index: 0,
    phase: 'show',
    holding: false,
    holdMs: kid ? HOLD_MS_KID : HOLD_MS_DEFAULT,
    holdStartedAt: Date.now(),
    thinkingLine: playlist[0]?.payload.thinkingLine ?? '',
    frozen: false,
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
    const next = {
      ...beat,
      payload: { ...beat.payload, ...patch },
    };
    const playlist = state.playlist.map((item, i) => (i === state.index ? next : item));
    setState({ playlist, frozen: false, phase: 'show' });
    armBeat();
  },
  applySpeech(text: string, memberNames: string[] = []) {
    if (!state.live) return false;
    const steer = interpretStageSpeech(text, { memberNames, live: true });
    if (steer.kind === 'freeze') {
      poppinsUiOrchestrator.freeze();
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
    clearHoldTimer();
    setState({ frozen: true, holding: false, phase: 'show' });
  },
  confirm() {
    clearHoldTimer();
    void settleCurrent();
  },
  veto() {
    const beat = currentBeat();
    if (beat?.scene === 'confirm' && beat.payload.confirmationIds?.length) {
      pendingHandler?.(false, beat.payload.confirmationIds);
    }
    clearHoldTimer();
    clear();
  },
  clear,
};

function clear() {
  clearHoldTimer();
  state = { ...EMPTY };
  emit();
}

export function usePoppinsUiDrive(): IuiDriveState {
  return useSyncExternalStore(
    poppinsUiOrchestrator.subscribe,
    poppinsUiOrchestrator.getState,
    poppinsUiOrchestrator.getState
  );
}
