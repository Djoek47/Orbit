/**
 * One act per family per turn.
 *
 * Two planners can stage the same request: the local grammar (instant, from the person's
 * words) and the model (a second or two later, from tool results). When they disagreed on
 * a spoken slot — "Clean Dishes" from the words, "Wash the dishes" from the model — the
 * stage treated them as two acts and committed both. That is the "Clean → Nero" twice.
 *
 * The rule: whichever planner stages an act family first in a turn owns it. A later plan
 * for the same family may only fill slots that are still empty on the live beat. It never
 * adds a second beat, and it never overwrites what the person said.
 *
 * A turn starts when the person speaks or types. Families staged or committed in the turn
 * stay owned until the next turn (or 60 s, whichever is first). A beat still live and
 * uncommitted in the chain keeps its family owned across turns, so a spoken correction
 * ("no, to Mia") refines the card instead of spawning a copy.
 */
import type { IuiBeat, IuiPayload } from '@/lib/poppins/ui-scenes';

export type ActFamily = string;

/** Turn ownership expires if nothing new is said for this long. */
export const TURN_OWNERSHIP_MS = 60_000;
/**
 * An identical act committed within this window is never written twice. A late second
 * plan lands within a few seconds of the first commit; a person repeating themselves
 * on purpose takes longer. Undo forgets the fingerprint immediately.
 */
export const COMMIT_FINGERPRINT_MS = 8_000;

const WRITE_FAMILY: Record<string, ActFamily> = {
  create_task: 'task',
  create_homework: 'task',
  add_grocery: 'grocery',
  clear_grocery: 'grocery_clear',
  create_event: 'event',
  create_itinerary_stop: 'trip',
  advance_itinerary: 'trip_advance',
  complete_task: 'complete',
  update_task: 'task_update',
  claim_reward: 'reward',
  upsert_place: 'place',
  grant_allowance: 'allowance',
};

/** Server tool name → family, for pending confirmations and tool results. */
export const TOOL_FAMILY: Record<string, ActFamily> = {
  create_task_draft: 'task',
  assign_task: 'task',
  create_task: 'task',
  add_grocery: 'grocery',
  clear_grocery_list: 'grocery_clear',
  create_calendar_event: 'event',
  create_itinerary: 'trip',
  advance_itinerary_stop: 'trip_advance',
  complete_task: 'complete',
  update_task: 'task_update',
  claim_reward: 'reward',
  grant_allowance: 'allowance',
};

/** Beats that only accompany an act (the settle mark, a thinking line). */
const COMPANION_SCENES = new Set(['result_mark', 'thinking']);

/** Slots a later plan may fill when the owner left them empty. */
const REFINE_KEYS = ['assignee', 'due', 'date', 'time', 'location', 'placeAddress', 'repeat'] as const;

export function actFamilyOfBeat(beat: IuiBeat): ActFamily | null {
  if (COMPANION_SCENES.has(beat.scene)) return null;
  const write = beat.payload.write ?? 'none';
  if (write !== 'none' && WRITE_FAMILY[write]) return WRITE_FAMILY[write]!;
  if (beat.scene === 'confirm') {
    const ids = beat.payload.confirmationIds ?? [];
    return ids.length ? `confirm:${[...ids].sort().join(',')}` : 'confirm';
  }
  return `scene:${beat.scene}`;
}

export function toolFamily(tool: string): ActFamily | null {
  return TOOL_FAMILY[tool] ?? null;
}

function filled(value: unknown): boolean {
  return value != null && String(value).trim().length > 0;
}

/**
 * Pure: what a later plan may add to the owner's payload. Only empty slots, never a
 * spoken one, never a mangled word while a Narrow choice is still open.
 */
export function refinementPatch(current: IuiPayload, incoming: IuiPayload): Partial<IuiPayload> {
  const patch: Record<string, unknown> = {};
  for (const key of REFINE_KEYS) {
    if (!filled(current[key]) && filled(incoming[key])) patch[key] = incoming[key];
  }
  const narrowOpen = current.narrow === true && !current.selectedChipId;
  if (!narrowOpen) {
    if (!filled(current.title) && !filled(current.libraryTaskId) && filled(incoming.title)) {
      patch.title = incoming.title;
    }
    if (!filled(current.groceryName) && !current.items?.length && filled(incoming.groceryName)) {
      patch.groceryName = incoming.groceryName;
    }
    if (!filled(current.category) && !filled(current.title) && filled(incoming.category)) {
      patch.category = incoming.category;
    }
  }
  return patch as Partial<IuiPayload>;
}

/** Pure: identity of a committed write — same act, same person, same day. */
export function commitFingerprint(beat: IuiBeat): string | null {
  const p = beat.payload;
  const write = p.write ?? 'none';
  if (write === 'none') return null;
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
  const items = (p.items ?? [])
    .filter((item) => !item.dropped && item.label.trim())
    .map((item) => `${norm(item.label)}>${norm(item.assignee)}`)
    .sort()
    .join(',');
  const subject =
    p.taskId ?? p.title ?? p.groceryName ?? p.placeName ?? p.rewardName ?? p.allowanceAmountLabel;
  return [
    write,
    norm(subject),
    norm(p.assignee ?? p.allowanceMemberName),
    norm(p.due ?? p.date),
    items,
  ].join('|');
}

type TurnState = {
  id: number;
  startedAt: number;
  families: Map<ActFamily, 'staged' | 'committed'>;
};

let turn: TurnState = { id: 0, startedAt: 0, families: new Map() };
const recentCommits = new Map<string, number>();

/** The person spoke or typed: a new turn begins. Returns its id. */
export function beginTurn(now = Date.now()): number {
  turn = { id: turn.id + 1, startedAt: now, families: new Map() };
  return turn.id;
}

export function currentTurnId(): number {
  return turn.id;
}

function turnFresh(now: number): boolean {
  return turn.startedAt > 0 && now - turn.startedAt <= TURN_OWNERSHIP_MS;
}

export function noteStaged(family: ActFamily | null, now = Date.now()): void {
  if (!family || !turnFresh(now)) return;
  if (!turn.families.has(family)) turn.families.set(family, 'staged');
}

export function noteCommitted(family: ActFamily | null, now = Date.now()): void {
  if (!family || !turnFresh(now)) return;
  turn.families.set(family, 'committed');
}

/** True when this turn already staged or committed the family. */
export function turnOwnsFamily(family: ActFamily | null, now = Date.now()): boolean {
  if (!family || !turnFresh(now)) return false;
  return turn.families.has(family);
}

export function rememberCommit(fingerprint: string | null, now = Date.now()): void {
  if (!fingerprint) return;
  recentCommits.set(fingerprint, now);
  for (const [key, at] of recentCommits) {
    if (now - at > COMMIT_FINGERPRINT_MS) recentCommits.delete(key);
  }
}

/** Undo reversed the act — saying it again must work. */
export function forgetCommit(fingerprint: string | null): void {
  if (fingerprint) recentCommits.delete(fingerprint);
}

export function wasCommittedRecently(fingerprint: string | null, now = Date.now()): boolean {
  if (!fingerprint) return false;
  const at = recentCommits.get(fingerprint);
  return at != null && now - at <= COMMIT_FINGERPRINT_MS;
}

/** Test helper. */
export function resetTurnOwnership(): void {
  turn = { id: 0, startedAt: 0, families: new Map() };
  recentCommits.clear();
}
