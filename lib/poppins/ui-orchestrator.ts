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
  actFamilyOfBeat,
  actsOfBeat,
  beatSubjectText,
  beginTurn as beginOwnershipTurn,
  bestMatch,
  commitFingerprint,
  forgetCommit,
  itemAsPayload,
  markCommitted,
  refinementPatch,
  registerStaged,
  rememberCommit,
  subjectOf,
  turnActs,
  turnHasPendingAct,
  wasCommittedRecently,
  type PlanSource,
  type TurnAct,
} from '@/lib/poppins/turn-ownership';
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
  /** Tappable undo window after a successful settle (~5s from last commit). */
  undoUntil: number | null;
  /** @deprecated Prefer undoLedger — kept as the latest entry for older UI. */
  undoBeat: IuiBeat | null;
  undoReverse: IuiCommitReverse | null;
  /** WO11 §2.5 — every commit since the turn began. */
  undoLedger: Array<{ beat: IuiBeat; reverse: IuiCommitReverse | null }>;
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
  undoLedger: [],
};

let state: IuiDriveState = EMPTY;
/** Session hold duration from active member — survives playlist clear/append. */
let sessionHoldMs = HOLD_MS_DEFAULT;
/**
 * Model confirmations already answered. Every confirmation that reaches the stage gets
 * exactly one answer: Yes when its card settles, No when it is vetoed or cleared away
 * unanswered — the model must never be left waiting on a card that no longer exists.
 */
const resolvedConfirmations = new Set<string>();
function resolveConfirmations(approved: boolean, ids: readonly string[] | undefined) {
  const open = (ids ?? []).filter((id) => !resolvedConfirmations.has(id));
  if (!open.length) return;
  for (const id of open) resolvedConfirmations.add(id);
  if (resolvedConfirmations.size > 200) {
    const oldest = [...resolvedConfirmations].slice(0, resolvedConfirmations.size - 200);
    for (const id of oldest) resolvedConfirmations.delete(id);
  }
  pendingHandler?.(approved, open);
}
/** Decline every confirmation still waiting on the stage (the stage is going away). */
function declineOpenConfirmations() {
  const ids = state.playlist.flatMap((beat) =>
    beat.scene === 'confirm' ? beat.payload.confirmationIds ?? [] : []
  );
  resolveConfirmations(false, ids);
}
/** Which planner staged each beat — the recent-commit guard only ever applies to model plans. */
const beatSource = new Map<string, PlanSource>();
function noteBeatSource(beats: IuiBeat[], source: PlanSource) {
  for (const beat of beats) beatSource.set(beat.id, source);
  if (beatSource.size > 400) {
    const keep = new Set(state.playlist.map((b) => b.id));
    for (const id of beatSource.keys()) if (!keep.has(id)) beatSource.delete(id);
  }
}
/** WO16 §1.3 — elapsed hold ms preserved across speech pause so the ring resumes. */
let holdElapsedMs = 0;
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
    const needsFace = merged.items?.some((item) => !item.dropped && !item.assignee?.trim()) ?? false;
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
  // WO16 §1.1 — stay in narrow only while exactly two chips remain.
  dropNarrowIfChipsGone();
}

/** Leave narrow the moment chips are gone — even while speaking (WO16 §1.1). */
function dropNarrowIfChipsGone() {
  if (state.phase !== 'narrow') return;
  const beat = currentBeat();
  const chips = beat?.payload.chips;
  const stillNarrow =
    (beat?.payload.narrow === true || beat?.payload.provisional === true) &&
    chips?.length === 2;
  if (!stillNarrow) {
    setState({ phase: 'unfold' });
  }
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

function reverseCount(reverse: IuiCommitReverse | null | undefined): number {
  // WO16 §3.3 — null reverse means nothing to undo; do not invent a count of 1.
  if (!reverse) return 0;
  if (reverse.batch?.length) return reverse.batch.length;
  return 1;
}

function turnUndoCount(ledger: IuiDriveState['undoLedger']): number {
  return ledger.reduce((sum, entry) => sum + reverseCount(entry.reverse), 0);
}

function armUndoWindow(beat: IuiBeat, reverse?: IuiCommitReverse | null) {
  // If it cannot be reversed, do not offer Undo.
  if (reverseCount(reverse) <= 0) return;
  clearUndoTimer();
  const ms = effectiveUndoMs(beat);
  const entry = { beat, reverse: reverse ?? null };
  const undoLedger = [...state.undoLedger, entry];
  setState({
    undoBeat: beat,
    undoUntil: Date.now() + ms,
    undoReverse: reverse ?? null,
    undoLedger,
  });
  undoTimer = setTimeout(() => {
    setState({ undoBeat: null, undoUntil: null, undoReverse: null, undoLedger: [] });
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
  holdElapsedMs = 0;
  hapticHandler?.('settle');
  if (beat.scene === 'confirm' && beat.payload.confirmationIds?.length) {
    resolveConfirmations(true, beat.payload.confirmationIds);
  }
  let reverse: IuiCommitReverse | null | undefined;
  const fingerprint = beat.commit !== 'none' ? commitFingerprint(beat) : null;
  if (
    fingerprint &&
    beatSource.get(beat.id) === 'model' &&
    wasCommittedRecently(fingerprint)
  ) {
    // A model plan for an act that already landed moments ago. A person saying it twice
    // is always written; only a late model echo is skipped.
    console.warn('iui.duplicate_commit_skipped', { fingerprint });
    advanceAfterSettle();
    return;
  }
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
    rememberCommit(fingerprint);
    markCommitted(beat.id);
    armUndoWindow(beat, reverse);
  }
  advanceAfterSettle();
}

/**
 * Acts on the stage that have not settled yet — including cards from an earlier turn, so a
 * correction ("…no, to Mia") refines the card on screen instead of spawning a copy.
 */
function liveChainActs(): TurnAct[] {
  if (!state.live) return [];
  const acts: TurnAct[] = [];
  for (let i = state.index; i < state.playlist.length; i++) {
    const beat = state.playlist[i]!;
    if (i === state.index && state.phase === 'settle') continue;
    acts.push(...actsOfBeat(beat, beatSource.get(beat.id) ?? 'local'));
  }
  return acts;
}

/** Turn acts plus live cards, each key once (turn memory wins — it knows what committed). */
function matchCandidates(): TurnAct[] {
  const byKey = new Map<string, TurnAct>();
  for (const act of liveChainActs()) byKey.set(act.key, act);
  for (const act of turnActs()) byKey.set(act.key, act);
  return [...byKey.values()];
}

/**
 * Fill empty slots on the card an absorbed model beat stands for. Never touches a committed
 * act, a settling card, or anything the person already said.
 */
function absorbIntoAct(act: TurnAct, incoming: Partial<IuiPayload>) {
  if (act.state === 'committed') return;
  const index = state.playlist.findIndex((beat) => beat.id === act.beatId);
  if (index < 0 || index < state.index) return;
  if (index === state.index && state.phase === 'settle') return;
  const beat = state.playlist[index]!;

  if (act.itemId) {
    const items = beat.payload.items ?? [];
    let changed = false;
    const nextItems = items.map((item) => {
      if (item.id !== act.itemId) return item;
      const assignee = item.assignee?.trim() ? item.assignee : incoming.assignee;
      const due = item.due?.trim() ? item.due : incoming.due;
      if (assignee === item.assignee && due === item.due) return item;
      changed = true;
      return { ...item, assignee: assignee ?? item.assignee, due: due ?? item.due };
    });
    if (!changed) return;
    const needsFace = nextItems.some((item) => !item.dropped && !item.assignee?.trim());
    const payload = {
      ...beat.payload,
      items: nextItems,
      ...(beat.scene === 'task_compose' || beat.scene === 'homework_compose'
        ? { composeReady: !needsFace }
        : {}),
    };
    setState({
      playlist: state.playlist.map((b, i) => (i === index ? { ...b, payload } : b)),
    });
  } else {
    const patch = refinementPatch(beat.payload, incoming);
    if (!Object.keys(patch).length) return;
    if (index === state.index) {
      patchCurrentPayload(markSlotSources(patch, 'model'));
    } else {
      const marked = markSlotSources(patch, 'model');
      setState({
        playlist: state.playlist.map((b, i) =>
          i === index
            ? {
                ...b,
                payload: {
                  ...b.payload,
                  ...marked,
                  slotSource: { ...b.payload.slotSource, ...marked.slotSource },
                },
              }
            : b
        ),
      });
    }
  }
  if (index === state.index) {
    if (state.holding) resetHoldProgressOnly();
    maybeArmHold();
  }
}

/**
 * A model plan is matched act-by-act, by subject, against what is already staged or done.
 * A matched act only fills empty slots on its card; an act with a new subject stages as
 * usual. Matching is one-to-one within a plan, so two different tasks from the model never
 * collapse into one. Companion beats (the settle mark) travel with their act.
 */
function reconcileModelPlaylist(playlist: IuiBeat[]): IuiBeat[] {
  const candidates = matchCandidates();
  const claimed = new Set<string>();
  const kept: IuiBeat[] = [];
  let dropCompanions = false;

  for (const beat of playlist) {
    const family = actFamilyOfBeat(beat);
    if (family == null) {
      if (!dropCompanions) kept.push(beat);
      continue;
    }
    dropCompanions = false;

    const rows = (beat.payload.items ?? []).filter((item) => !item.dropped && item.label.trim());
    if (rows.length) {
      const remaining = rows.filter((item) => {
        const match = bestMatch(family, subjectOf(item.label), candidates, claimed);
        if (!match) return true;
        claimed.add(match.key);
        absorbIntoAct(match, itemAsPayload(item));
        return false;
      });
      if (!remaining.length) {
        console.warn('iui.model_plan_refined', { family, rows: rows.length });
        dropCompanions = true;
        continue;
      }
      let next: IuiBeat = beat;
      if (remaining.length < rows.length) {
        next =
          remaining.length === 1
            ? {
                ...beat,
                payload: {
                  ...beat.payload,
                  items: undefined,
                  progressLabel: undefined,
                  title: remaining[0]!.label,
                  groceryName:
                    beat.scene === 'grocery_add' ? remaining[0]!.label : beat.payload.groceryName,
                  assignee: remaining[0]!.assignee ?? beat.payload.assignee,
                  due: remaining[0]!.due ?? beat.payload.due,
                },
              }
            : { ...beat, payload: { ...beat.payload, items: remaining } };
      }
      kept.push(next);
      registerStaged([next], 'model');
      continue;
    }

    const match = bestMatch(family, subjectOf(beatSubjectText(beat.payload)), candidates, claimed);
    if (match) {
      claimed.add(match.key);
      absorbIntoAct(match, beat.payload);
      console.warn('iui.model_plan_refined', { family });
      dropCompanions = true;
      continue;
    }
    kept.push(beat);
    registerStaged([beat], 'model');
  }
  return kept;
}

function startHoldClock(beat: IuiBeat) {
  if (state.frozen || state.speaking || currentBeat()?.id !== beat.id) return;
  if (state.holding) return;
  const elapsed = Math.min(holdElapsedMs, state.holdMs);
  const remaining = Math.max(50, state.holdMs - elapsed);
  setState({
    holding: true,
    phase: 'hold',
    // Back-date so the ring resumes from where speech paused it (WO16 §1.3).
    holdStartedAt: Date.now() - elapsed,
  });
  // WO11 §2.7 — one haptic for the group (settle), not hold+settle.
  if (!(beat.payload.items && beat.payload.items.filter((item) => !item.dropped).length > 1)) {
    hapticHandler?.('hold');
  }
  clearHoldTimer();
  holdTimer = setTimeout(() => {
    if (state.speaking || state.frozen || currentBeat()?.id !== beat.id) return;
    holdElapsedMs = 0;
    void settleCurrent();
  }, remaining);
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

/** Drop model values that would overwrite a spoken/touch slot in slotOrder. */
function scrubModelOverwrite(current: IuiPayload, incoming: IuiPayload): IuiPayload {
  const next = { ...incoming };
  const spoken = new Set(current.slotOrder ?? []);
  for (const key of PROTECTED_SLOTS) {
    const inSlotOrder = spoken.has(key as 'title' | 'assignee' | 'due' | 'category' | 'date' | 'time');
    const source = current.slotSource?.[key];
    if (!inSlotOrder && source !== 'speech' && source !== 'touch') continue;
    const currentVal = String(current[key] ?? '').trim();
    const incomingVal = String(incoming[key] ?? '').trim();
    const incomingSource = incoming.slotSource?.[key];
    if (
      currentVal &&
      incomingVal &&
      currentVal.toLowerCase() !== incomingVal.toLowerCase() &&
      incomingSource !== 'speech' &&
      incomingSource !== 'touch'
    ) {
      console.warn('iui.model_overwrite_blocked', { slot: key, kept: currentVal, dropped: incomingVal });
      (next as Record<string, unknown>)[key] = current[key];
      next.slotSource = { ...next.slotSource, [key]: source ?? 'speech' };
    }
  }
  // Keep the person's slot order.
  if (current.slotOrder?.length) {
    next.slotOrder = current.slotOrder;
    next.focusSlot = current.focusSlot;
  }
  // WO16 §1.1 — model merge must not erase Narrow chips / flag before a chip is chosen.
  if (current.narrow === true && !current.selectedChipId) {
    next.narrow = true;
    if (current.chips?.length === 2 && (next.chips?.length !== 2)) {
      next.chips = current.chips;
    }
    // Do not accept a mangled grocery name until a chip is picked.
    if (!next.selectedChipId) {
      next.groceryName = current.groceryName;
      next.title = current.title ?? next.title;
      next.provisional = true;
    }
  }
  return next;
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
  // Preserve / merge grouped rows when a refinement arrives.
  const incomingPayload: Partial<IuiPayload> = { ...incoming.payload };
  if (current.payload.items?.length) {
    if (!incomingPayload.items?.length) {
      delete incomingPayload.items;
      delete incomingPayload.progressLabel;
    } else {
      const seen = new Set(
        current.payload.items
          .filter((item) => !item.dropped && item.label.trim())
          .map((item) => item.label.trim().toLowerCase())
      );
      const mergedItems = [...current.payload.items];
      for (const item of incomingPayload.items) {
        const key = item.label.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        mergedItems.push(item);
      }
      incomingPayload.items = mergedItems;
      const active = mergedItems.filter((item) => !item.dropped);
      incomingPayload.progressLabel =
        active.length > 1 ? `1 of ${active.length}` : undefined;
      incomingPayload.groceryName = active[0]?.label ?? incomingPayload.groceryName;
      incomingPayload.title = active[0]?.label ?? incomingPayload.title;
    }
  }
  patchCurrentPayload(scrubModelOverwrite(current.payload, incomingPayload as IuiPayload));
  // Preserve Narrow flag across model merge unless a chip was already chosen.
  const after = currentBeat();
  if (
    after &&
    current.payload.narrow === true &&
    !after.payload.selectedChipId &&
    after.payload.narrow !== true
  ) {
    patchCurrentPayload({ narrow: true });
  }
  dropNarrowIfChipsGone();
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
  holdElapsedMs = 0;
  const beat = currentBeat();
  if (!beat || state.frozen) return;
  // Narrow: explicit flag, or legacy provisional + exactly two chips.
  const isNarrow =
    beat.commit === 'hold' &&
    ((beat.payload.narrow === true && beat.payload.chips?.length === 2) ||
      (beat.payload.provisional === true && beat.payload.chips?.length === 2));
  if (isNarrow) {
    setState({
      phase: 'narrow',
      holding: false,
      holdStartedAt: null,
      thinkingLine: beat.payload.thinkingLine || 'Which one?',
    });
    hapticHandler?.('show');
    return;
  }
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
  // Replacing the chain: any confirmation still waiting on the old one is answered No.
  declineOpenConfirmations();
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
    undoLedger: [],
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

/** True when a live playlist still has work that has not settled. */
function chainHasUncommittedWork(): boolean {
  if (!state.live || !state.playlist.length) return false;
  // Current beat not yet settled, or anything still queued behind it.
  if (state.index < state.playlist.length && state.phase !== 'settle') return true;
  return state.index + 1 < state.playlist.length;
}

function appendAndDedupePlaylist(playlist: IuiBeat[], opts?: { blockedReplace?: boolean }) {
  if (opts?.blockedReplace) {
    console.warn('iui.chain_replaced_blocked', {
      index: state.index,
      phase: state.phase,
      queued: Math.max(0, state.playlist.length - state.index - 1),
      incoming: playlist.length,
    });
  }
  const kept = state.playlist.slice(0, Math.max(state.index + 1, 0));
  const tail = state.playlist.slice(state.index + 1);
  const seen = new Set(kept.map(beatIdentityKey));
  for (const beat of kept) {
    for (const item of beat.payload.items ?? []) {
      if (item.dropped || !item.label.trim()) continue;
      seen.add(`${beat.scene}|item|${item.label.trim().toLowerCase()}`);
    }
  }
  const mergedTail: IuiBeat[] = [];
  for (const beat of [...playlist, ...tail]) {
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
  const added = Math.max(0, mergedTail.length - tail.length);
  const current = currentBeat();
  if (current && added > 0) {
    const activeCount =
      current.payload.items?.filter((item) => !item.dropped).length ??
      (current.payload.groceryName || current.payload.title ? 1 : 0);
    const total = activeCount + added;
    patchCurrentPayload({
      progressLabel:
        total > 1 ? `${Math.min(activeCount, total)} of ${total}` : current.payload.progressLabel,
      thinkingLine:
        added === 1 ? `+1` : added > 1 ? `+${added}` : current.payload.thinkingLine,
    });
  }
  setState({
    playlist: [...kept, ...mergedTail],
    live: true,
    holdMs: sessionHoldMs,
  });
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
      // Pause the ring — keep elapsed so we resume, not restart (WO16 §1.3).
      if (state.holdStartedAt) {
        holdElapsedMs = Math.min(
          state.holdMs,
          Math.max(holdElapsedMs, Date.now() - state.holdStartedAt)
        );
      }
      setState({ speaking: true, holding: false, phase: 'unfold', holdStartedAt: null });
      return;
    }
    setState({ speaking });
    if (!speaking) maybeArmHold();
  },
  /**
   * The person spoke or typed — a new turn. Families staged from here on belong to it.
   * Call before driving the turn's local plan.
   */
  beginTurn() {
    return beginOwnershipTurn();
  },
  /**
   * True when the stage already holds (or already committed) the act a model confirmation
   * is asking about — same kind AND same subject. A confirmation for a different task is
   * not "handled" just because some task is on screen.
   */
  stageHasActFor(tool: string, args: Record<string, unknown> = {}) {
    return turnHasPendingAct(tool, args, liveChainActs());
  },
  drive(
    actions: Array<Record<string, unknown>>,
    opts?: { kid?: boolean; replace?: boolean; source?: 'local' | 'model' }
  ) {
    let playlist = mapUiActionsToPlaylist(actions);
    if (opts?.kid) {
      playlist = playlist.filter(
        (beat) => beat.scene !== 'reward_mint' && beat.scene !== 'allowance_act'
      );
    }
    if (opts?.source === 'model') {
      playlist = reconcileModelPlaylist(playlist);
      noteBeatSource(playlist, 'model');
    } else {
      registerStaged(playlist, 'local');
      noteBeatSource(playlist, 'local');
    }
    if (!playlist.length) return;
    if (opts?.kid != null) {
      sessionHoldMs = opts.kid ? HOLD_MS_KID : HOLD_MS_DEFAULT;
      setState({ holdMs: sessionHoldMs });
    }
    const liveUncommitted = state.live && state.playlist.length && chainHasUncommittedWork();
    if (state.live && state.playlist.length && mergeIncomingPlaylist(playlist)) {
      if (opts?.replace && liveUncommitted) {
        console.warn('iui.chain_replaced_blocked', {
          via: 'merge',
          index: state.index,
          phase: state.phase,
        });
      }
      return;
    }
    // WO11 §2.6 — never wipe a live chain: replace downgrades to append+dedupe.
    if (liveUncommitted) {
      appendAndDedupePlaylist(playlist, { blockedReplace: opts?.replace === true });
      return;
    }
    if (state.live && state.playlist.length && !opts?.replace) {
      appendAndDedupePlaylist(playlist);
      return;
    }
    startPlaylist(playlist, opts?.kid);
  },
  splice(actions: Array<Record<string, unknown>>) {
    const extra = mapUiActionsToPlaylist(actions);
    if (!extra.length) return;
    const wasEmpty = !state.playlist.length;
    if (state.live && state.playlist.length) {
      appendAndDedupePlaylist(extra);
      return;
    }
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
  /** Drop a queued upcoming beat (Batch board × on "NEXT, ON ITS OWN CARD"). */
  dropQueuedBeat(beatId: string) {
    const id = beatId.replace(/^queue:/, '');
    if (!id || !state.playlist.length) return;
    const nextIndex = state.index + 1;
    const filtered = state.playlist.filter((beat, i) => i <= state.index || beat.id !== id);
    if (filtered.length === state.playlist.length) return;
    setState({ playlist: filtered });
    void nextIndex;
  },
  /** Settle ledger labels for the Undo window (newest turn). */
  undoLedgerRows(): Array<{ id: string; label: string }> {
    if (!state.undoUntil || Date.now() > state.undoUntil) return [];
    const ledger = state.undoLedger.length
      ? state.undoLedger
      : state.undoBeat
        ? [{ beat: state.undoBeat, reverse: state.undoReverse }]
        : [];
    return ledger.flatMap((entry, index) => {
      const beat = entry.beat;
      const reverse = entry.reverse;
      // Multi-write batch → one row per child so per-row undo can target an entity.
      if (reverse?.batch?.length) {
        const items = beat.payload.items?.filter((item) => !item.dropped) ?? [];
        return reverse.batch.map((child, childIndex) => {
          const byId = child.itemId
            ? items.find((item) => item.id === child.itemId)
            : undefined;
          const label =
            child.label ??
            byId?.label ??
            beat.payload.groceryName ??
            beat.payload.title ??
            child.write.replace(/_/g, ' ');
          return {
            id: child.entityId || `${beat.id}-batch-${childIndex}`,
            label,
          };
        });
      }
      const items = beat.payload.items?.filter((item) => !item.dropped) ?? [];
      if (items.length > 1 && !reverse?.batch?.length) {
        return [
          {
            id: `${beat.id}-group`,
            label:
              beat.scene === 'grocery_add'
                ? `Groceries · ${items.length} items`
                : `${items.length} things`,
          },
        ];
      }
      const label =
        beat.payload.placeName ??
        beat.payload.groceryName ??
        beat.payload.title ??
        beat.payload.rewardName ??
        beat.payload.allowanceAmountLabel ??
        beat.payload.itineraryTitle ??
        items[0]?.label ??
        'Act';
      const assignee = beat.payload.assignee ?? beat.payload.allowanceMemberName;
      const due = beat.payload.due;
      const detail =
        assignee || due
          ? `${label}${assignee ? ` → ${assignee}` : ''}${due ? ` · ${due}` : ''}`
          : label;
      return [
        {
          id: reverse?.entityId || `${beat.id}-${index}`,
          label: detail,
        },
      ];
    });
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
    // Narrow chip → fill slots, clear provisional/narrow, leave Narrow for HOLD.
    const fromNarrow =
      state.phase === 'narrow' ||
      beat?.payload.narrow === true ||
      (beat?.payload.provisional === true && (beat.payload.chips?.length ?? 0) === 2);
    const cleared: Partial<IuiPayload> = fromNarrow
      ? {
          ...patch,
          provisional: false,
          narrow: false,
          composeReady: true,
          chips: undefined,
          selectedChipId: patch.selectedChipId ?? patch.libraryTaskId,
        }
      : patch;
    poppinsUiOrchestrator.revise(markSlotSources(cleared, 'touch'));
    if (fromNarrow) {
      setState({ phase: 'unfold' });
      maybeArmHold();
    }
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
  /** WO12 §F4 — mark the turn as model-offline without failing the act. */
  flagModelOffline() {
    const beat = currentBeat();
    if (!beat) return;
    if (beat.scene === 'result_mark' || beat.scene === 'task_done') {
      patchCurrentPayload({ modelOffline: true });
      return;
    }
    const nextMark = state.playlist.find(
      (item, i) => i > state.index && (item.scene === 'result_mark' || item.scene === 'task_done')
    );
    if (nextMark) {
      setState({
        playlist: state.playlist.map((item) =>
          item.id === nextMark.id
            ? { ...item, payload: { ...item.payload, modelOffline: true } }
            : item
        ),
      });
    }
  },
  /** Tap the settle mark within ~5s to reverse every commit in the turn (newest first). */
  async undoLast() {
    const ledger = state.undoLedger.length
      ? state.undoLedger
      : state.undoBeat
        ? [{ beat: state.undoBeat, reverse: state.undoReverse }]
        : [];
    if (!ledger.length || !state.undoUntil || Date.now() > state.undoUntil) return false;
    clearUndoTimer();
    setState({ undoBeat: null, undoUntil: null, undoReverse: null, undoLedger: [] });
    // Newest first.
    for (const entry of [...ledger].reverse()) {
      forgetCommit(commitFingerprint(entry.beat));
      await undoHandler?.(entry.beat, entry.reverse);
    }
    // Mark held for undo — advance as soon as reverse lands.
    if (currentBeat()?.scene === 'result_mark') {
      clearAllTimers();
      advanceAfterSettle();
    }
    return true;
  },
  /**
   * Per-row undo inside the ~5s window — reverse one ledger entry (or one batch child)
   * and leave the rest. Pass the row id from `undoLedgerRows()`.
   */
  async undoOne(rowId: string) {
    if (!rowId || !state.undoUntil || Date.now() > state.undoUntil) return false;
    const ledger = state.undoLedger.length
      ? state.undoLedger
      : state.undoBeat
        ? [{ beat: state.undoBeat, reverse: state.undoReverse }]
        : [];
    if (!ledger.length) return false;

    for (let i = 0; i < ledger.length; i++) {
      const entry = ledger[i]!;
      const reverse = entry.reverse;
      if (reverse?.batch?.length) {
        const childIndex = reverse.batch.findIndex(
          (child, idx) =>
            child.entityId === rowId || `${entry.beat.id}-batch-${idx}` === rowId
        );
        if (childIndex >= 0) {
          const child = reverse.batch[childIndex]!;
          forgetCommit(commitFingerprint(entry.beat));
          await undoHandler?.(entry.beat, child);
          const nextBatch = reverse.batch.filter((_, idx) => idx !== childIndex);
          const nextLedger = [...ledger];
          if (nextBatch.length === 0) {
            nextLedger.splice(i, 1);
          } else {
            nextLedger[i] = {
              beat: entry.beat,
              reverse: { ...reverse, batch: nextBatch, entityId: nextBatch[0]?.entityId ?? reverse.entityId },
            };
          }
          const still = nextLedger.length > 0;
          setState({
            undoLedger: nextLedger,
            undoBeat: still ? nextLedger[nextLedger.length - 1]!.beat : null,
            undoReverse: still ? nextLedger[nextLedger.length - 1]!.reverse : null,
            undoUntil: still ? state.undoUntil : null,
          });
          if (!still) {
            clearUndoTimer();
            if (currentBeat()?.scene === 'result_mark') {
              clearAllTimers();
              advanceAfterSettle();
            }
          }
          return true;
        }
      }
      const entryId = reverse?.entityId || `${entry.beat.id}-${i}`;
      const groupId = `${entry.beat.id}-group`;
      if (rowId === entryId || rowId === groupId || rowId === entry.beat.id) {
        forgetCommit(commitFingerprint(entry.beat));
        await undoHandler?.(entry.beat, reverse);
        const nextLedger = ledger.filter((_, idx) => idx !== i);
        const still = nextLedger.length > 0;
        setState({
          undoLedger: nextLedger,
          undoBeat: still ? nextLedger[nextLedger.length - 1]!.beat : null,
          undoReverse: still ? nextLedger[nextLedger.length - 1]!.reverse : null,
          undoUntil: still ? state.undoUntil : null,
        });
        if (!still) {
          clearUndoTimer();
          if (currentBeat()?.scene === 'result_mark') {
            clearAllTimers();
            advanceAfterSettle();
          }
        }
        return true;
      }
    }
    return false;
  },
  /** How many acts the current undo window covers. */
  undoCount(): number {
    if (!state.undoUntil || Date.now() > state.undoUntil) return 0;
    if (state.undoLedger.length) return turnUndoCount(state.undoLedger);
    return state.undoBeat ? reverseCount(state.undoReverse) : 0;
  },
  veto() {
    const beat = currentBeat();
    if (beat?.scene === 'confirm' && beat.payload.confirmationIds?.length) {
      resolveConfirmations(false, beat.payload.confirmationIds);
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
  // A confirmation still queued behind the card being dismissed is answered No.
  declineOpenConfirmations();
  // Keep the undo window alive after the card dismisses (WO16 §3.1).
  clearHoldTimer();
  clearUnfoldTimer();
  clearQuietTimer();
  holdElapsedMs = 0;
  const speaking = state.speaking;
  state = {
    ...EMPTY,
    speaking,
    holdMs: sessionHoldMs,
    undoUntil: state.undoUntil,
    undoBeat: state.undoBeat,
    undoReverse: state.undoReverse,
    undoLedger: state.undoLedger,
  };
  emit();
}

export function usePoppinsUiDrive(): IuiDriveState {
  return useSyncExternalStore(
    poppinsUiOrchestrator.subscribe,
    poppinsUiOrchestrator.getState,
    poppinsUiOrchestrator.getState
  );
}
