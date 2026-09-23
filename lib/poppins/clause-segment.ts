/**
 * Quiet clause segmentation — split compound utterances, parse per clause,
 * inherit slots L→R and apply trailing slots backwards (WO4 rule 4).
 *
 * Does not change beat / orchestrator / scene behaviour — intent layer only.
 */

import { parseHouseholdIntent, type HouseholdIntentOpts } from '@/lib/poppins/ui-intent';
import { parseItineraryIntent } from '@/lib/itinerary/itinerary-intent';

const INHERIT_SLOTS = ['assignee', 'due', 'category', 'repeat'] as const;
type InheritSlot = (typeof INHERIT_SLOTS)[number];

const CLAUSE_SPLIT =
  /\s+(?:then|also|plus|after\s+that)\s+|[.!?]+(?:\s+|$)/i;

/** Imperative / act-opening verbs that mark a new clause after `and`. */
const CLAUSE_VERB =
  /^(add|create|assign|set\s+up|setup|make|schedule|put|remind|open|clean|wash|tidy|vacuum|mop|tend|take|do|get|grab|buy|complete|finish)\b/i;

/** Capitalized name or known member cue after `and` → stay one clause (two assignees). */
function looksLikeNameList(afterAnd: string): boolean {
  const trimmed = afterAnd.trim();
  if (/^[A-Z][a-z]+(?:\s+and\s+[A-Z][a-z]+)?\b/.test(trimmed) && !CLAUSE_VERB.test(trimmed)) {
    // "Drako and Maya tomorrow" — names, not a new act
    if (!/\b(for|to the list|on the list|tomorrow|today|friday|monday)\b/i.test(trimmed.split(/\s+/).slice(0, 3).join(' '))) {
      return /^[A-Z]/.test(trimmed);
    }
  }
  return false;
}

/** Safe `and`: list items / two categories stay one clause. */
function isSafeAnd(before: string, after: string): boolean {
  const afterTrim = after.trim();
  const beforeTrim = before.trim();

  // "milk and eggs to the list" — bare values into one grocery act
  if (
    /\b(add|put|get|grab|buy|pick up)\b/i.test(beforeTrim) &&
    /\b(list|grocer|shopping)\b/i.test(afterTrim)
  ) {
    return true;
  }
  if (
    /\b(add|put|get|grab|buy|pick up)\b/i.test(beforeTrim) &&
    !CLAUSE_VERB.test(afterTrim) &&
    !/\bfor\s+[A-Z]/i.test(afterTrim)
  ) {
    // "add milk and eggs" without a new verb
    const afterFirst = afterTrim.split(/\s+/)[0] ?? '';
    if (afterFirst && !CLAUSE_VERB.test(afterFirst) && !/^[A-Z]/.test(afterFirst)) {
      return true;
    }
  }

  // "kitchen and bathroom" category pair
  if (
    /\b(kitchen|bathroom|bedroom|laundry|trash|dishes)\b/i.test(beforeTrim) &&
    /^(kitchen|bathroom|bedroom|laundry|trash|dishes)\b/i.test(afterTrim) &&
    !/\bfor\b/i.test(afterTrim)
  ) {
    // Only safe if the right side has no assignee / due of its own trailing later —
    // when followed by "for Name", this is two chores (not safe).
    return !/\bfor\s+[A-Za-z]/i.test(afterTrim);
  }

  if (looksLikeNameList(afterTrim)) return true;

  return false;
}

/**
 * Split on clause boundaries. Ambiguous `and` stays one clause (safe direction).
 */
export function splitClauses(utterance: string): string[] {
  const text = utterance.trim();
  if (!text) return [];

  const parts: string[] = [];
  let remaining = text;

  // First split on then/also/plus/after that / sentence ends
  const coarse = remaining
    .split(CLAUSE_SPLIT)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const chunk of coarse) {
    parts.push(...splitOnAnd(chunk));
  }

  return parts.map((p) => p.trim()).filter(Boolean);
}

function splitOnAnd(chunk: string): string[] {
  const segments: string[] = [];
  let start = 0;
  const re = /\band\b/gi;
  let match: RegExpExecArray | null;
  const cuts: number[] = [];

  while ((match = re.exec(chunk)) !== null) {
    const before = chunk.slice(start, match.index);
    const after = chunk.slice(match.index + match[0].length);
    if (isSafeAnd(before.length ? before : chunk.slice(0, match.index), after)) {
      continue;
    }
    // Clause boundary when a verb or a new slot-bearing chore noun follows
    const afterTrim = after.trim();
    if (CLAUSE_VERB.test(afterTrim) || /\bfor\s+[A-Za-z]/i.test(afterTrim) || looksLikeChoreNoun(afterTrim)) {
      cuts.push(match.index);
    }
  }

  if (cuts.length === 0) return [chunk];

  let prev = 0;
  for (const cut of cuts) {
    const piece = chunk.slice(prev, cut).trim();
    if (piece) segments.push(piece);
    prev = cut + 3; // len('and')
  }
  const tail = chunk.slice(prev).trim();
  if (tail) segments.push(tail);
  return segments.length ? segments : [chunk];
}

function looksLikeChoreNoun(after: string): boolean {
  const first = after.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return /^(dishes|trash|laundry|vacuum|floors|bathroom|kitchen|bedrooms?|toys|homework|recycling|dishwasher|garbage|bins?)$/.test(
    first
  );
}

function readSlot(action: Record<string, unknown>, slot: InheritSlot): string | undefined {
  const value = action[slot];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isNavigate(action: Record<string, unknown>): boolean {
  return String(action.type) === 'navigate';
}

function isAct(action: Record<string, unknown>): boolean {
  const type = String(action.type ?? '');
  return (
    type === 'create_task_draft' ||
    type === 'add_grocery' ||
    type === 'create_calendar_event' ||
    type === 'create_itinerary' ||
    type === 'complete_task' ||
    type === 'create_task'
  );
}

/** Same-family acts only inherit slots; grocery never gets or donates chore slots. */
function actFamily(type: string): string {
  switch (type) {
    case 'create_task_draft':
    case 'create_task':
    case 'assign_task':
      return 'task';
    case 'add_grocery':
      return 'grocery';
    case 'create_calendar_event':
    case 'create_event':
      return 'calendar';
    case 'create_itinerary':
      return 'itinerary';
    case 'complete_task':
      return 'complete';
    default:
      return type;
  }
}

function canInheritBetween(
  from: Record<string, unknown>,
  to: Record<string, unknown>
): boolean {
  const fromFamily = actFamily(String(from.type ?? ''));
  const toFamily = actFamily(String(to.type ?? ''));
  if (fromFamily !== toFamily) return false;
  // Groceries are household-wide — never inherit assignee/due/category/repeat.
  if (fromFamily === 'grocery' || toFamily === 'grocery') return false;
  return true;
}

function stripGroceryChoreSlots(action: Record<string, unknown>): void {
  if (String(action.type) !== 'add_grocery') return;
  delete action.assignee;
  delete action.due;
  delete action.category;
  delete action.repeat;
}

/**
 * Apply L→R inherit, then rule-4 backwards for slots never filled explicitly.
 * Navigates are deferred to the end of the batch (after acts).
 * Slots inherit only between acts of the same type; grocery never gets/donates
 * assignee, due, category, or repeat.
 */
export function inheritSlotsAcrossActions(
  actions: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  const acts = actions.filter(isAct).map((a) => ({ ...a }));
  const navigates = actions.filter(isNavigate).map((a) => ({ ...a }));
  const other = actions.filter((a) => !isAct(a) && !isNavigate(a)).map((a) => ({ ...a }));

  for (const act of acts) stripGroceryChoreSlots(act);

  // Track which slots were explicitly present before inheritance
  const explicit: Array<Partial<Record<InheritSlot, boolean>>> = acts.map((action) => {
    const flags: Partial<Record<InheritSlot, boolean>> = {};
    for (const slot of INHERIT_SLOTS) {
      if (readSlot(action, slot)) flags[slot] = true;
    }
    return flags;
  });

  // L→R: fill unfilled from previous (same act family only)
  for (let i = 1; i < acts.length; i++) {
    const prev = acts[i - 1]!;
    const cur = acts[i]!;
    if (!canInheritBetween(prev, cur)) continue;
    for (const slot of INHERIT_SLOTS) {
      if (!readSlot(cur, slot) && readSlot(prev, slot)) {
        cur[slot] = readSlot(prev, slot);
      }
    }
  }

  // Rule 4: trailing explicit slot applies backwards within the same family
  for (const slot of INHERIT_SLOTS) {
    let trailing: string | undefined;
    let trailingFamily: string | undefined;
    for (let i = acts.length - 1; i >= 0; i--) {
      if (explicit[i]?.[slot]) {
        trailing = readSlot(acts[i]!, slot);
        trailingFamily = actFamily(String(acts[i]!.type ?? ''));
        break;
      }
    }
    if (!trailing || !trailingFamily || trailingFamily === 'grocery') continue;
    for (let i = 0; i < acts.length; i++) {
      if (explicit[i]?.[slot]) continue;
      if (actFamily(String(acts[i]!.type ?? '')) !== trailingFamily) continue;
      acts[i]![slot] = trailing;
    }
  }

  for (const act of acts) stripGroceryChoreSlots(act);

  return [...acts, ...other, ...navigates];
}

/**
 * Quiet compound entry: segment → parse each → inherit → navigates last.
 */
export function parseCompoundHouseholdIntent(
  utterance: string,
  opts?: HouseholdIntentOpts
): Array<Record<string, unknown>> {
  const text = utterance.trim();
  if (!text) return [];

  const trip = parseItineraryIntent(text);
  if (trip) {
    return [
      {
        type: 'create_itinerary',
        title: trip.title,
        date: trip.date,
        stops: trip.stops,
        sourceUtterance: text,
      },
    ];
  }

  const clauses = splitClauses(text);
  if (clauses.length <= 1) {
    return parseHouseholdIntent(text, opts).map((action) => ({
      ...action,
      sourceUtterance: text,
    }));
  }

  const parsed: Array<Record<string, unknown>> = [];
  for (const clause of clauses) {
    const actions = parseHouseholdIntent(clause, opts);
    for (const action of actions) {
      parsed.push({ ...action, sourceUtterance: text });
    }
  }

  if (parsed.length === 0) {
    return parseHouseholdIntent(text, opts).map((action) => ({
      ...action,
      sourceUtterance: text,
    }));
  }

  return inheritSlotsAcrossActions(parsed);
}
