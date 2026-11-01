/**
 * One request is one act — matched by SUBJECT, not by kind.
 *
 * Two planners can stage the same request: the local grammar (instant, from the person's
 * words) and the model (a second or two later, from tool results — or occasionally first).
 * When they disagreed on wording — "Clean Dishes" from the words, "Wash the dishes" from the
 * model — the stage treated them as two acts and committed both ("Clean → Nero" twice).
 *
 * The rule: every staged act registers its subject (content words, minus filler and chore
 * verbs). A later plan's beat is absorbed by an existing act of the same family that shares
 * a subject — one-to-one within a plan. Absorbed beats may only fill empty slots on a live,
 * uncommitted card; they never add a second card and never overwrite what was said.
 * Anything with a new subject — "Bread" after "Milk", "Walk the dog" while "Clean Dishes"
 * waits for a person — stages normally.
 *
 * A turn starts when the person starts speaking (or sends typed text). Acts staged or
 * committed in the turn stay matchable until the next turn or 60 s. Live, uncommitted cards
 * from an earlier turn stay matchable too, so "…no, to Mia" refines the card on screen.
 */
import type { IuiBeat, IuiGroupItem, IuiPayload } from '@/lib/poppins/ui-scenes';

export type ActFamily = string;
export type PlanSource = 'local' | 'model';

/** Turn memory expires if nothing new is said for this long. */
export const TURN_OWNERSHIP_MS = 60_000;
/**
 * A model-planned act identical to one committed within this window is not written again
 * (its plan arrived after the person had already moved on). A person repeating themselves
 * is always written — this guard never applies to local plans.
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

/** Server tool name → family, for pending confirmations. */
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

/** Families with no subject — there is one grocery list, one "next stop". */
/**
 * Families matched by kind alone. A turn builds one trip: the model's plan for "a trip" is
 * the trip the words already staged, whatever it calls it — it may fill gaps, never replace
 * the stops.
 */
const SUBJECTLESS = new Set(['grocery_clear', 'trip_advance', 'trip']);

/** Beats that only accompany an act (the settle mark, a thinking line). */
const COMPANION_SCENES = new Set(['result_mark', 'thinking']);

/** Slots a later plan may fill when the owner left them empty. */
const REFINE_KEYS = ['assignee', 'due', 'date', 'time', 'location', 'placeAddress', 'repeat'] as const;

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'my', 'our', 'your', 'his', 'her', 'their', 'its', 'to', 'for', 'of',
  'and', 'with', 'in', 'on', 'at', 'by', 'up', 'out', 'off', 'some', 'task', 'chore', 'todo',
  'please', 'list', 'grocery', 'groceries', 'this', 'that', 'it', 'me', 'them', 'all',
  'today', 'tomorrow', 'tonight', 'week', 'daily',
]);

const CHORE_VERBS = new Set([
  'clean', 'wash', 'do', 'take', 'make', 'tidy', 'vacuum', 'wipe', 'put', 'empty', 'load',
  'unload', 'feed', 'walk', 'water', 'mow', 'sweep', 'mop', 'fold', 'cook', 'prepare', 'set',
  'clear', 'add', 'buy', 'get', 'pick', 'scrub', 'dust', 'organize', 'sort', 'bring', 'help',
  'finish', 'start', 'practice', 'read', 'study', 'brush', 'change', 'fix', 'hang', 'iron',
  'pack', 'rinse', 'shop', 'tend', 'throw', 'trim', 'weed', 'grab', 'restock',
]);

function singular(word: string): string {
  if (word.length > 4 && /(ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Pure: the content words of a subject and its leading chore verb, if any. */
export function subjectOf(text: string | undefined | null): { tokens: string[]; verb?: string } {
  const words = String(text ?? '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singular)
    .filter((w) => !STOP_WORDS.has(w));
  const verb = words.find((w) => CHORE_VERBS.has(w));
  const tokens = [...new Set(words.filter((w) => !CHORE_VERBS.has(w)))];
  return { tokens, verb };
}

/**
 * Pure: how strongly two subjects are the same request. 0 = different. Shared content words
 * decide; a matching verb only breaks ties. A side with no content words matches weakly
 * (a card still waiting for its title accepts one).
 */
export function subjectScore(
  a: { tokens: string[]; verb?: string },
  b: { tokens: string[]; verb?: string }
): number {
  if (!a.tokens.length || !b.tokens.length) {
    if (!a.tokens.length && !b.tokens.length) return a.verb && a.verb === b.verb ? 0.5 : 0.3;
    return 0.3;
  }
  const other = new Set(b.tokens);
  const shared = a.tokens.filter((t) => other.has(t)).length;
  if (!shared) return 0;
  return shared + (a.verb && a.verb === b.verb ? 0.5 : 0);
}

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

/** Pure: the subject text of a whole beat (no items). */
export function beatSubjectText(p: IuiPayload): string {
  if (p.allowanceMemberName || p.allowanceAmountLabel) {
    return `${p.allowanceMemberName ?? ''} ${p.allowanceAmountLabel ?? ''}`;
  }
  return String(
    p.title ?? p.groceryName ?? p.placeName ?? p.rewardName ?? p.itineraryTitle ??
      (p.libraryTaskId ? p.libraryTaskId.replace(/_/g, ' ') : '') ?? ''
  );
}

function filled(value: unknown): boolean {
  return value != null && String(value).trim().length > 0;
}

/**
 * Pure: what a later plan may add to the owner's payload. Only empty slots, never a
 * spoken one, never a mangled word while a Narrow choice is still open.
 */
export function refinementPatch(current: IuiPayload, incoming: Partial<IuiPayload>): Partial<IuiPayload> {
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
  return [write, norm(subject), norm(p.assignee ?? p.allowanceMemberName), norm(p.due ?? p.date), items].join('|');
}

// ── Turn memory ────────────────────────────────────────────────────────────────────────

/** One registered act: a single beat, or one row of a batch beat. */
export type TurnAct = {
  key: string;
  beatId: string;
  itemId?: string;
  family: ActFamily;
  subject: { tokens: string[]; verb?: string };
  source: PlanSource;
  state: 'staged' | 'committed';
};

type TurnState = { id: number; startedAt: number; acts: TurnAct[] };

let turn: TurnState = { id: 0, startedAt: 0, acts: [] };
const recentCommits = new Map<string, number>();

/** The person started speaking or sent text: a new turn begins. Returns its id. */
export function beginTurn(now = Date.now()): number {
  turn = { id: turn.id + 1, startedAt: now, acts: [] };
  return turn.id;
}

export function currentTurnId(): number {
  return turn.id;
}

function turnFresh(now: number): boolean {
  return turn.startedAt > 0 && now - turn.startedAt <= TURN_OWNERSHIP_MS;
}

/** Pure: the acts a beat stands for — one per live row of a batch, else one. */
export function actsOfBeat(beat: IuiBeat, source: PlanSource): TurnAct[] {
  const family = actFamilyOfBeat(beat);
  if (!family) return [];
  const rows = (beat.payload.items ?? []).filter((item) => !item.dropped && item.label.trim());
  if (rows.length) {
    return rows.map((item) => ({
      key: `${beat.id}:${item.id}`,
      beatId: beat.id,
      itemId: item.id,
      family,
      subject: subjectOf(item.label),
      source,
      state: 'staged' as const,
    }));
  }
  return [
    {
      key: beat.id,
      beatId: beat.id,
      family,
      subject: subjectOf(beatSubjectText(beat.payload)),
      source,
      state: 'staged' as const,
    },
  ];
}

export function registerStaged(beats: IuiBeat[], source: PlanSource, now = Date.now()): void {
  if (!turnFresh(now)) return;
  const known = new Set(turn.acts.map((a) => a.key));
  for (const beat of beats) {
    for (const act of actsOfBeat(beat, source)) {
      if (!known.has(act.key)) turn.acts.push(act);
    }
  }
}

export function markCommitted(beatId: string): void {
  for (const act of turn.acts) if (act.beatId === beatId) act.state = 'committed';
}

/** Acts from this turn (if fresh), for matching. */
export function turnActs(now = Date.now()): TurnAct[] {
  return turnFresh(now) ? turn.acts : [];
}

/**
 * Pure: pick the best unclaimed candidate for an incoming subject in the same family.
 * Returns null when nothing shares the subject — the incoming act is new.
 */
export function bestMatch(
  family: ActFamily,
  subject: { tokens: string[]; verb?: string },
  candidates: TurnAct[],
  claimed: Set<string>,
  opts?: { requireOverlap?: boolean }
): TurnAct | null {
  if (SUBJECTLESS.has(family)) {
    return candidates.find((c) => c.family === family && !claimed.has(c.key)) ?? null;
  }
  let best: TurnAct | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    if (c.family !== family || claimed.has(c.key)) continue;
    const score = subjectScore(subject, c.subject);
    if (opts?.requireOverlap && score < 1) continue;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Does this turn already have the act a pending model confirmation is asking about?
 * Requires a real subject match — a confirmation for a different task is not "handled".
 */
export function turnHasPendingAct(
  tool: string,
  args: Record<string, unknown>,
  extraCandidates: TurnAct[] = []
): boolean {
  const family = toolFamily(tool);
  if (!family) return false;
  const candidates = [...turnActs(), ...extraCandidates];
  const text =
    family === 'allowance'
      ? `${String(args.memberName ?? args.member ?? '')} ${String(args.amount ?? args.amountLabel ?? '')}`
      : String(args.title ?? args.name ?? args.groceryName ?? args.taskId ?? args.task_id ?? '');
  return Boolean(bestMatch(family, subjectOf(text), candidates, new Set(), { requireOverlap: true }));
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

/** Pure: an incoming batch row's slots as a patch for the card that absorbs it. */
export function itemAsPayload(item: IuiGroupItem): Partial<IuiPayload> {
  return { title: item.label, assignee: item.assignee, due: item.due };
}

/** Test helper. */
export function resetTurnOwnership(): void {
  turn = { id: 0, startedAt: 0, acts: [] };
  recentCommits.clear();
}
