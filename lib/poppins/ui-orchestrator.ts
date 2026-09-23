/**
 * IUI session bus — playlist, speech-gated HOLD, barge-in revise, lip-sync.
 */

import { useSyncExternalStore } from 'react';

import { interpretStageSpeech, matchSpokenTokens } from '@/lib/poppins/ui-speech';
import { withComposeProgress } from '@/lib/poppins/iui-compose';
import { withHomeworkComposeProgress } from '@/lib/poppins/homework-compose';
import type { IuiCommitReverse } from '@/lib/poppins/iui-reverse';
import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';
import { getSessionActMode, getSessionDirectMode, getSessionHoldMultiplier, getSessionSelfName, getSessionUndoMs } from '@/lib/poppins/session-act-mode';
import { undoWindowMsForAssignee } from '@/lib/poppins/iui-commit';
import { validateAct } from '@/lib/poppins/validate-act';
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
  /** True after a failed commit — retry or dismiss advances. */
  commitFailed: boolean;
  /** Tappable undo window after a successful settle (~5s). */
  undoUntil: number | null;
  undoBeat: IuiBeat | null;
  undoReverse: IuiCommitReverse | null;
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
  commitFailed: false,
  undoUntil: null,
  undoBeat: null,
  undoReverse: null,
};

let state: IuiDriveState = EMPTY;
/** Session hold duration from active member — survives playlist clear/append. */
let sessionHoldMs = HOLD_MS_DEFAULT;
const listeners = new Set<() => void>();
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let unfoldTimer: ReturnType<typeof setTimeout> | null = null;
let quietTimer: ReturnType<typeof setTimeout> | null = null;
let undoTimer: ReturnType<typeof setTimeout> | null = null;
let commitHandler:
  | ((beat: IuiBeat) => void | Promise<void | { reverse?: IuiCommitReverse | null }>)
  | null = null;
let undoHandler:
  | ((beat: IuiBeat, reverse: IuiCommitReverse | null) => void | Promise<void>)
  | null = null;
let coachHandler: ((route: string) => void) | null = null;
let pendingHandler: ((approved: boolean, ids: string[]) => void) | null = null;
let hapticHandler: ((kind: IuiHapticKind) => void) | null = null;
let tapHandler: ((tap: IuiStageTap) => void) | null = null;
const tapHandlers = new Set<(tap: IuiStageTap) => void>();

/** Default undo window; prefs override via setSessionInteractionPrefs. */
export const UNDO_MS = 5000;

function effectiveUndoMs(beat?: IuiBeat | null): number {
  const base = getSessionUndoMs() || UNDO_MS;
  const self = getSessionSelfName();
  return undoWindowMsForAssignee(base, beat?.payload.assignee, self ? { name: self } : null);
}

const PROTECTED_SLOTS = [
  'assignee',
  'title',
  'due',
  'date',
  'time',
  'category',
  'libraryTaskId',
  'groceryName',
] as const;

function clearUndoTimer() {
  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = null;
}

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
  clearUndoTimer();
}

function currentBeat(): IuiBeat | null {
  return state.playlist[state.index] ?? null;
}

function markSlotSources(
  patch: Partial<IuiPayload>,
  source: 'speech' | 'touch' | 'model'
): Partial<IuiPayload> {
  const slotSource = { ...(patch.slotSource ?? {}) };
  for (const key of PROTECTED_SLOTS) {
    if (patch[key] != null && String(patch[key]).trim()) {
      slotSource[key] = source;
    }
  }
  return { ...patch, slotSource };
}

function patchCurrentPayload(patch: Partial<IuiPayload>) {
  const beat = currentBeat();
  if (!beat) return;
  let merged = {
    ...beat.payload,
    ...patch,
    slotSource: { ...beat.payload.slotSource, ...patch.slotSource },
  };
  // WO11 — assigning a person fills the first group row missing an assignee.
  if (patch.assignee && merged.items?.length) {
    let filled = false;
    merged = {
      ...merged,
      items: merged.items.map((item) => {
        if (filled || item.dropped || item.assignee?.trim()) return item;
        filled = true;
        return { ...item, assignee: String(patch.assignee) };
      }),
    };
    const needsFace = merged.items.some((item) => !item.dropped && !item.assignee?.trim());
    if (beat.scene === 'task_compose' || beat.scene === 'homework_compose') {
      merged.composeReady = !needsFace;
    }
  }
  const payload =
    beat.scene === 'task_compose' && !merged.items?.length
      ? withComposeProgress(merged)
      : beat.scene === 'homework_compose' && !merged.items?.length
        ? withHomeworkComposeProgress(merged)
        : merged;
  const next = { ...beat, payload };
  setState({
    playlist: state.playlist.map((item, i) => (i === state.index ? next : item)),
  });
}

function applyGroupItemStatus(
  itemId: string,
  status: 'pending' | 'saving' | 'done' | 'failed'
) {
  const beat = currentBeat();
  if (!beat?.payload.items?.length) return;
  const items = beat.payload.items.map((item) =>
    item.id === itemId ? { ...item, status } : item
  );
  const done = items.filter((item) => !item.dropped && item.status === 'done').length;
  const total = items.filter((item) => !item.dropped).length;
  patchCurrentPayload({
    items,
    progressLabel: total > 1 ? `${Math.min(done + 1, total)} of ${total}` : undefined,
  });
}

function applyDropGroupItem(itemId: string) {
  const beat = currentBeat();
  if (!beat?.payload.items?.length) return;
  const items = beat.payload.items.map((item) =>
    item.id === itemId ? { ...item, dropped: true } : item
  );
  const active = items.filter((item) => !item.dropped && item.label.trim());
  if (!active.length) {
    hapticHandler?.('veto');
    clearAllTimers();
    clear();
    return;
  }
  const first = active[0]!;
  const needsFace = active.some((item) => !item.assignee?.trim());
  patchCurrentPayload({
    items,
    groceryName: beat.scene === 'grocery_add' ? first.label : beat.payload.groceryName,
    title: first.label,
    assignee: first.assignee ?? beat.payload.assignee,
    due: first.due ?? beat.payload.due,
    progressLabel: active.length > 1 ? `1 of ${active.length}` : undefined,
    composeReady:
      beat.scene === 'task_compose' || beat.scene === 'homework_compose' ? !needsFace : undefined,
  });
  if (state.holding) resetHoldProgressOnly();
  maybeArmHold();
}

function advanceAfterSettle() {
  const next = state.index + 1;
  if (next < state.playlist.length) {
    setState({
      index: next,
      phase: 'show',
      holding: false,
      commitFailed: false,
      thinkingLine: state.playlist[next]?.payload.thinkingLine ?? '',
      spoken: '',
      frozen: false,
    });
    armBeat();
    return;
  }
  setTimeout(() => clear(), SETTLE_CLEAR_MS);
}

function armUndoWindow(beat: IuiBeat, reverse?: IuiCommitReverse | null) {
  clearUndoTimer();
  const ms = effectiveUndoMs(beat);
  setState({
    undoBeat: beat,
    undoUntil: Date.now() + ms,
    undoReverse: reverse ?? null,
  });
  undoTimer = setTimeout(() => {
    setState({ undoBeat: null, undoUntil: null, undoReverse: null });
  }, ms);
}

async function settleCurrent(opts?: { fromTap?: boolean }) {
  const beat = currentBeat();
  if (!beat) {
    clear();
    return;
  }
  if (state.speaking && beat.commit === 'hold' && !opts?.fromTap) return;
  setState({ phase: 'settle', holding: false, holdStartedAt: null, commitFailed: false });
  hapticHandler?.('settle');
  if (beat.scene === 'confirm' && beat.payload.confirmationIds?.length) {
    pendingHandler?.(true, beat.payload.confirmationIds);
  }
  let reverse: IuiCommitReverse | null | undefined;
  if (beat.scene === 'navigate_coach' && beat.payload.route) {
    coachHandler?.(beat.payload.route);
  } else if (beat.commit !== 'none') {
    try {
      const result = await commitHandler?.(beat);
      if (result && typeof result === 'object' && 'ask' in result && result.ask) {
        setState({
          frozen: false,
          holding: false,
          phase: 'unfold',
          commitFailed: false,
          thinkingLine: String(result.ask),
        });
        return;
      }
      if (result && typeof result === 'object' && 'reverse' in result) {
        reverse = result.reverse ?? null;
      }
      const write = beat.payload.write ?? 'none';
      if (write !== 'none') {
        const { actKeyFromBeat, recordCommittedAct } = await import('@/lib/poppins/act-ledger');
        const items = beat.payload.items?.filter((item) => !item.dropped && item.status !== 'failed');
        if (items?.length) {
          for (const item of items) {
            recordCommittedAct(
              write,
              actKeyFromBeat(write, { groceryName: item.label, title: item.label })
            );
          }
        } else {
          recordCommittedAct(
            write,
            actKeyFromBeat(write, {
              groceryName: beat.payload.groceryName,
              title: beat.payload.title,
              taskId: beat.payload.taskId,
            })
          );
        }
      }
    } catch (error) {
      const { ActRejectedError, clearRejectedSlot } = await import('@/lib/poppins/validate-act');
      const { withComposeProgress } = await import('@/lib/poppins/iui-compose');
      const { withHomeworkComposeProgress } = await import('@/lib/poppins/homework-compose');
      if (error instanceof ActRejectedError) {
        const cleared = clearRejectedSlot(beat.payload, error.validation.slot);
        const progressed =
          beat.scene === 'homework_compose'
            ? withHomeworkComposeProgress(cleared)
            : withComposeProgress(cleared);
        patchCurrentPayload(progressed);
        setState({
          frozen: false,
          holding: false,
          phase: 'unfold',
          commitFailed: false,
          thinkingLine: '',
        });
        return;
      }
      setState({
        frozen: true,
        holding: false,
        phase: 'unfold',
        commitFailed: true,
        thinkingLine: "Couldn't save that. Tap to try again, or skip.",
      });
      return;
    }
  }
  if (beat.commit !== 'none') {
    armUndoWindow(beat, reverse);
  }
  advanceAfterSettle();
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
  // Marginal fuzzy fill — NARROW / wait for certainty, do not silence-commit.
  if (beat.payload.provisional) return;
  if (sceneNeedsUnfold(beat.scene) && state.phase === 'show') return;
  // Direct: slots filled → commit immediately, no HOLD.
  if (beatReadyForDirectCommit(beat)) {
    void settleCurrent({ fromTap: true });
    return;
  }
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
  if (beat.scene === 'task_compose' || beat.scene === 'homework_compose') {
    return Boolean(p.assignee || p.title || p.libraryTaskId || p.category);
  }
  if (beat.scene === 'grocery_add') {
    return Boolean(p.groceryName || (p.items && p.items.some((item) => !item.dropped && item.label)));
  }
  return false;
}

function canMergeBeat(current: IuiBeat, incoming: IuiBeat): boolean {
  if (current.scene !== incoming.scene || current.commit !== incoming.commit) return false;
  const sources = current.payload.slotSource ?? {};
  for (const key of PROTECTED_SLOTS) {
    const source = sources[key];
    if (source !== 'speech' && source !== 'touch') continue;
    const currentVal = String(current.payload[key] ?? '').trim();
    const incomingVal = String(incoming.payload[key] ?? '').trim();
    if (currentVal && incomingVal && currentVal.toLowerCase() !== incomingVal.toLowerCase()) {
      return false;
    }
  }
  return true;
}

/** Stable identity for playlist dedupe when merging a model refinement. */
function beatIdentityKey(beat: IuiBeat): string {
  const p = beat.payload;
  const slot =
    p.libraryTaskId?.trim() ||
    p.title?.trim()?.toLowerCase() ||
    p.groceryName?.trim()?.toLowerCase() ||
    p.taskId?.trim() ||
    p.route?.trim() ||
    p.assignee?.trim()?.toLowerCase() ||
    '';
  return `${beat.scene}|${beat.commit}|${slot}`;
}

function mergeIncomingPlaylist(playlist: IuiBeat[]) {
  const current = currentBeat();
  const incoming = playlist[0];
  if (!current || !incoming || !canMergeBeat(current, incoming)) return false;
  // Preserve grouped rows when a refinement beat carries only the head slot.
  const incomingPayload: Partial<IuiPayload> = { ...incoming.payload };
  if (!incomingPayload.items?.length && current.payload.items?.length) {
    delete incomingPayload.items;
    delete incomingPayload.progressLabel;
  }
  patchCurrentPayload(incomingPayload);
  const rest = playlist.slice(1);
  const kept = state.playlist.slice(0, state.index + 1);
  const tail = state.playlist.slice(state.index + 1);
  const seen = new Set(kept.map(beatIdentityKey));
  // Also fingerprint each group row so a late plan cannot re-queue the same act.
  for (const beat of kept) {
    for (const item of beat.payload.items ?? []) {
      if (item.dropped || !item.label.trim()) continue;
      seen.add(`${beat.scene}|item|${item.label.trim().toLowerCase()}`);
    }
  }
  const mergedTail: IuiBeat[] = [];
  for (const beat of [...rest, ...tail]) {
    const key = beatIdentityKey(beat);
    if (seen.has(key)) continue;
    if (beat.payload.items?.length) {
      const filtered = beat.payload.items.filter((item) => {
        const itemKey = `${beat.scene}|item|${item.label.trim().toLowerCase()}`;
        if (!item.label.trim() || seen.has(itemKey)) return false;
        seen.add(itemKey);
        return true;
      });
      if (!filtered.length) continue;
      seen.add(key);
      mergedTail.push({
        ...beat,
        payload: {
          ...beat.payload,
          items: filtered,
          groceryName: filtered[0]?.label ?? beat.payload.groceryName,
          title: filtered[0]?.label ?? beat.payload.title,
        },
      });
      continue;
    }
    seen.add(key);
    mergedTail.push(beat);
  }
  setState({
    playlist: [...kept, ...mergedTail],
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
    const undoableMark =
      beat.scene === 'result_mark' &&
      Boolean(state.undoBeat && state.undoUntil && Date.now() < state.undoUntil);
    const remainingUndo = state.undoUntil ? Math.max(0, state.undoUntil - Date.now()) : 0;
    const linger = undoableMark
      ? Math.max(RESULT_LINGER_MS, remainingUndo)
      : beat.scene === 'list_peek' || beat.scene === 'member_pick' || beat.scene === 'result_mark'
        ? RESULT_LINGER_MS
        : NONE_LINGER_MS;
    holdTimer = setTimeout(() => {
      if (state.frozen || currentBeat()?.id !== beat.id) return;
      void settleCurrent();
    }, linger);
    return;
  }

  if (skipShow) {
    if (beatReadyForDirectCommit(beat)) {
      void settleCurrent({ fromTap: true });
      return;
    }
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
  const mult = getSessionHoldMultiplier();
  const baseHold = kid != null ? (kid ? HOLD_MS_KID : HOLD_MS_DEFAULT) : sessionHoldMs / (getSessionHoldMultiplier() || 1);
  const resolvedBase = kid != null ? (kid ? HOLD_MS_KID : HOLD_MS_DEFAULT) : HOLD_MS_DEFAULT;
  sessionHoldMs = Math.round(resolvedBase * mult);
  void baseHold;
  // Stamp session actMode onto beats that don't already carry one (B2.3).
  const mode = getSessionActMode();
  const stamped = playlist.map((beat) =>
    beat.payload.actMode
      ? beat
      : { ...beat, payload: { ...beat.payload, actMode: mode } }
  );
  setState({
    live: true,
    playlist: stamped,
    index: 0,
    phase: 'show',
    holding: false,
    holdMs: sessionHoldMs,
    holdStartedAt: null,
    thinkingLine: stamped[0]?.payload.thinkingLine ?? '',
    frozen: false,
    spoken: '',
    commitFailed: false,
    undoUntil: null,
    undoBeat: null,
    undoReverse: null,
  });
  armBeat();
}

function directSlotFilled(
  beat: IuiBeat,
  key: 'assignee' | 'title' | 'due' | 'date' | 'time' | 'libraryTaskId' | 'groceryName',
  value: string | undefined
): boolean {
  if (!value?.trim()) return false;
  return beat.payload.slotSource?.[key] !== 'model';
}

function beatReadyForDirectCommit(beat: IuiBeat): boolean {
  if (!getSessionDirectMode()) return false;
  if (beat.commit !== 'hold') return false;
  if (beat.payload.provisional === true) return false;
  if (beat.payload.composeReady === false) return false;
  const gate = validateAct(beat.payload, beat.scene);
  if (!gate.ok) return false;
  const write = beat.payload.write ?? 'none';
  if (write === 'add_grocery' || beat.scene === 'grocery_add') {
    if (beat.payload.items?.some((item) => !item.dropped && item.label.trim())) {
      return !beat.payload.items.some(
        (item) => !item.dropped && item.label.trim() && item.status === 'failed'
      );
    }
    return directSlotFilled(beat, 'groceryName', beat.payload.groceryName) ||
      directSlotFilled(beat, 'title', beat.payload.title);
  }
  if (write === 'complete_task') return true;
  if (write === 'create_task' || write === 'create_homework' || beat.scene === 'task_compose' || beat.scene === 'homework_compose') {
    if (beat.payload.items?.length) {
      const active = beat.payload.items.filter((item) => !item.dropped);
      return (
        active.length > 0 &&
        active.every((item) => item.label.trim() && item.assignee?.trim() && (item.due ?? beat.payload.due)?.trim())
      );
    }
    const hasTitle =
      directSlotFilled(beat, 'title', beat.payload.title) ||
      directSlotFilled(beat, 'libraryTaskId', beat.payload.libraryTaskId);
    const hasAssignee = directSlotFilled(beat, 'assignee', beat.payload.assignee);
    const hasDue = directSlotFilled(beat, 'due', beat.payload.due);
    return hasTitle && hasAssignee && hasDue;
  }
  if (write === 'create_event') {
    const allDay = /\ball[\s-]?day\b/i.test(beat.payload.sourceUtterance ?? '');
    return (
      directSlotFilled(beat, 'title', beat.payload.title) &&
      directSlotFilled(beat, 'date', beat.payload.date) &&
      (allDay || directSlotFilled(beat, 'time', beat.payload.time))
    );
  }
  return gate.ok;
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
  setCommitHandler(
    handler:
      | ((beat: IuiBeat) => void | Promise<void | { reverse?: IuiCommitReverse | null; ask?: string }>)
      | null
  ) {
    commitHandler = handler;
  },
  setUndoHandler(
    handler: ((beat: IuiBeat, reverse: IuiCommitReverse | null) => void | Promise<void>) | null
  ) {
    undoHandler = handler;
  },
  /** Kid vs adult HOLD duration for this Speak session. */
  setSessionKid(kid: boolean) {
    sessionHoldMs = kid ? HOLD_MS_KID : HOLD_MS_DEFAULT;
    setState({ holdMs: sessionHoldMs });
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
    if (opts?.kid != null) {
      sessionHoldMs = opts.kid ? HOLD_MS_KID : HOLD_MS_DEFAULT;
      setState({ holdMs: sessionHoldMs });
    }
    if (state.live && state.playlist.length && mergeIncomingPlaylist(playlist)) {
      return;
    }
    if (state.live && state.playlist.length && !opts?.replace) {
      setState({ playlist: [...state.playlist, ...playlist], live: true, holdMs: sessionHoldMs });
      return;
    }
    startPlaylist(playlist, opts?.kid);
  },
  splice(actions: Array<Record<string, unknown>>) {
    const extra = mapUiActionsToPlaylist(actions);
    if (!extra.length) return;
    const wasEmpty = !state.playlist.length;
    setState({ playlist: [...state.playlist, ...extra], live: true, holdMs: sessionHoldMs });
    if (wasEmpty) armBeat();
  },
  revise(patch: Partial<IuiPayload>) {
    const beat = currentBeat();
    if (!beat) return;
    patchCurrentPayload(patch);
    setState({ frozen: false, commitFailed: false, thinkingLine: '' });
    if (state.holding) {
      resetHoldProgressOnly();
      maybeArmHold();
      return;
    }
    maybeArmHold();
  },
  dropGroupItem(itemId: string) {
    applyDropGroupItem(itemId);
  },
  patchGroupItemStatus(
    itemId: string,
    status: 'pending' | 'saving' | 'done' | 'failed'
  ) {
    applyGroupItemStatus(itemId, status);
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
      patchCurrentPayload(markSlotSources(patch, 'speech'));
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
    const beat = currentBeat();
    // B2 — a face tap must never assign a grocery add.
    if (
      patch.assignee != null &&
      beat &&
      (beat.scene === 'grocery_add' || beat.payload.write === 'add_grocery')
    ) {
      console.warn('iui.assignee_ignored', { scene: beat.scene, write: beat.payload.write });
      const { assignee: _ignored, ...rest } = patch;
      if (Object.keys(rest).length) {
        poppinsUiOrchestrator.revise(markSlotSources(rest, 'touch'));
      }
      emitTap({ kind, text });
      return;
    }
    poppinsUiOrchestrator.revise(markSlotSources(patch, 'touch'));
    emitTap({ kind, text });
  },
  confirm(opts?: { fromTap?: boolean }) {
    const beat = currentBeat();
    if (opts?.fromTap && beat?.payload.composeReady === false && !state.commitFailed) {
      return Promise.resolve();
    }
    if (opts?.fromTap) {
      if (state.speaking) setState({ speaking: false });
      emitTap({ kind: 'confirm', text: state.commitFailed ? 'try again' : 'assign now' });
    }
    clearAllTimers();
    return settleCurrent(opts);
  },
  /** Skip a frozen failed beat and continue the playlist. */
  dismissFailed() {
    if (!state.commitFailed) return;
    setState({ commitFailed: false, frozen: false, thinkingLine: '' });
    advanceAfterSettle();
  },
  /** Tap the settle mark within ~5s to reverse the last commit (handler optional). */
  async undoLast() {
    const beat = state.undoBeat;
    const reverse = state.undoReverse;
    if (!beat || !state.undoUntil || Date.now() > state.undoUntil) return false;
    clearUndoTimer();
    setState({ undoBeat: null, undoUntil: null, undoReverse: null });
    await undoHandler?.(beat, reverse);
    // Mark held for undo — advance as soon as reverse lands.
    if (currentBeat()?.scene === 'result_mark') {
      clearAllTimers();
      advanceAfterSettle();
    }
    return true;
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
  state = { ...EMPTY, speaking, holdMs: sessionHoldMs };
  emit();
}

export function usePoppinsUiDrive(): IuiDriveState {
  return useSyncExternalStore(
    poppinsUiOrchestrator.subscribe,
    poppinsUiOrchestrator.getState,
    poppinsUiOrchestrator.getState
  );
}
