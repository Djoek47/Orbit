/**
 * Match spoken/typed household intent to the Assign library and shopping lane.
 * Used by AIUIC so Poppins can narrow Kitchen (etc.) instead of dumping the full form.
 */

import { allCatalogProducts, type CatalogProduct } from '@/lib/grocery/catalog';
import { classifyGroceryItem, isClothingCategory } from '@/lib/grocery/classify';
import { bestFuzzyMatch, isConfidentFuzzy } from '@/lib/poppins/fuzzy-match';
import { formatLocalDate } from '@/lib/streaks/local-date';
import { allLibraryTasks, choreDomains, homeworkDomain, type LibraryTask } from '@/lib/tasks/task-library';

export type GroceryCatalogMatch = {
  productId: string;
  name: string;
  confident: boolean;
};

function singularizeToken(token: string): string {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
}

function pluralizeToken(token: string): string {
  if (token.endsWith('y') && token.length > 2 && !/[aeiou]y$/i.test(token)) {
    return `${token.slice(0, -1)}ies`;
  }
  if (token.endsWith('s')) return token;
  return `${token}s`;
}

function numberVariants(phrase: string): string[] {
  const normalized = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return [];
  const tokens = normalized.split(' ');
  const last = tokens[tokens.length - 1]!;
  const variants = new Set<string>([normalized]);
  const singularLast = singularizeToken(last);
  const pluralLast = pluralizeToken(singularLast === last ? last : singularLast);
  if (singularLast !== last) {
    variants.add([...tokens.slice(0, -1), singularLast].join(' ').trim());
  }
  if (pluralLast !== last) {
    variants.add([...tokens.slice(0, -1), pluralLast].join(' ').trim());
  }
  return [...variants].filter(Boolean);
}

let groceryCatalogIndex: Array<{ key: string; value: GroceryCatalogMatch }> | null = null;
let groceryCatalogMap: Map<string, GroceryCatalogMatch> | null = null;

function groceryCatalogCandidates(): Array<{ key: string; value: GroceryCatalogMatch }> {
  if (groceryCatalogIndex && groceryCatalogMap) return groceryCatalogIndex;
  const byKey = new Map<string, GroceryCatalogMatch>();

  const consider = (rawKey: string, product: CatalogProduct) => {
    for (const key of numberVariants(rawKey)) {
      if (key.length < 2) continue;
      const hit: GroceryCatalogMatch = {
        productId: product.id,
        name: product.name,
        confident: true,
      };
      const existing = byKey.get(key);
      // Prefer shorter / more generic display names when aliases collide.
      if (!existing || product.name.length < existing.name.length) {
        byKey.set(key, hit);
      }
    }
  };

  for (const product of allCatalogProducts()) {
    consider(product.name, product);
    for (const alias of product.aliases) consider(alias, product);
  }

  groceryCatalogMap = byKey;
  groceryCatalogIndex = [...byKey.entries()].map(([key, value]) => ({ key, value }));
  return groceryCatalogIndex;
}

function fuzzyCatalogCandidates(needle: string): Array<{ key: string; value: GroceryCatalogMatch }> {
  const tokens = needle.split(/\s+/).filter(Boolean);
  if (tokens.length > 3) return [];
  const candidates = groceryCatalogCandidates();
  const first = needle[0] ?? '';
  const len = needle.length;
  return candidates.filter((row) => {
    if (!row.key || row.key[0] !== first) return false;
    return Math.abs(row.key.length - len) <= 2;
  });
}

function isChoreCatalogTitle(name: string): boolean {
  const lower = name.trim().toLowerCase();
  if (!lower || lower.length < 3) return false;
  for (const task of allLibraryTasks()) {
    if (isGroceryMetaTask(task)) continue;
    if (task.name.toLowerCase() === lower) return true;
    if (task.searchTerms.some((term) => term.toLowerCase() === lower)) return true;
  }
  return false;
}

function matchGroceryCatalogOne(
  name: string,
  opts?: { excludeNames?: string[] }
): GroceryCatalogMatch | null {
  const needle = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!needle || needle.length < 2) return null;

  const excluded = (opts?.excludeNames ?? [])
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
  if (excluded.some((n) => n === needle || needle.split(/\s+/).includes(n))) return null;
  if (isChoreCatalogTitle(needle)) return null;

  groceryCatalogCandidates();
  const exact = groceryCatalogMap?.get(needle);
  if (exact) {
    return { ...exact, confident: true };
  }

  for (const variant of numberVariants(needle)) {
    const hit = groceryCatalogMap?.get(variant);
    if (hit) return { ...hit, confident: true };
  }

  const fuzzy = bestFuzzyMatch(needle, fuzzyCatalogCandidates(needle));
  if (!fuzzy || !isConfidentFuzzy(fuzzy)) return null;
  // Short needles (Maya → Mayo) are too ambiguous for edit-distance guesses.
  if (fuzzy.distance > 0 && needle.replace(/\s+/g, '').length <= 4) return null;
  return { ...fuzzy.value, confident: true };
}

/**
 * Confident match against the grocery catalog (name + aliases).
 * Singular/plural both match. Never matches member names or chore titles.
 */
const groceryIntentCache = new Map<string, boolean>();
const groceryMatchCache = new Map<string, GroceryCatalogMatch | null>();

function cacheGet<T>(map: Map<string, T>, key: string): T | undefined {
  return map.get(key);
}

function cacheSet<T>(map: Map<string, T>, key: string, value: T) {
  if (map.size > 80) map.clear();
  map.set(key, value);
}

export function matchGroceryCatalog(
  name: string,
  opts?: { excludeNames?: string[] }
): GroceryCatalogMatch | null {
  const cacheKey = `${name}\n${(opts?.excludeNames ?? []).join('|')}`;
  if (groceryMatchCache.has(cacheKey)) return groceryMatchCache.get(cacheKey) ?? null;
  const result = matchGroceryCatalogUncached(name, opts);
  cacheSet(groceryMatchCache, cacheKey, result);
  return result;
}

function matchGroceryCatalogUncached(
  name: string,
  opts?: { excludeNames?: string[] }
): GroceryCatalogMatch | null {
  const direct = matchGroceryCatalogOne(name, opts);
  if (direct) return direct;

  // "eggs and bread" — any catalog part is enough for intent; prefer first hit.
  const parts = name
    .split(/\s+and\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  if (parts.length > 1) {
    for (const part of parts) {
      const hit = matchGroceryCatalogOne(part, opts);
      if (hit) return hit;
    }
  }
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const tail2 = words.slice(-2).join(' ');
    const tailHit = matchGroceryCatalogOne(tail2, opts);
    if (tailHit) return tailHit;
  }
  if (words.length >= 1) {
    const last = words[words.length - 1]!;
    if (last !== name.trim().toLowerCase()) {
      const lastHit = matchGroceryCatalogOne(last, opts);
      if (lastHit) return lastHit;
    }
  }
  return null;
}

export type LibraryIntentMatch = {
  domainId?: string;
  domainLabel?: string;
  /** Filter kitchen tasks to dish-related, etc. */
  taskQuery?: string;
  task?: LibraryTask;
  assignee?: string;
};

/** Meta chores that describe list management — never auto-match from grocery-add speech. */
export const GROCERY_META_TASK_IDS = new Set(['T135']);

export const GROCERY_META_TASK_TITLES = [
  'add items to the grocery list',
  'add items to grocery list',
];

export function isGroceryMetaTask(task: Pick<LibraryTask, 'id' | 'name'>): boolean {
  if (GROCERY_META_TASK_IDS.has(task.id)) return true;
  const lower = task.name.trim().toLowerCase();
  return GROCERY_META_TASK_TITLES.some((title) => lower === title || lower.includes(title));
}

const LEADING_FILLER_RE =
  /^(?:poppins|hey|ok|okay|so|um|uh|alright|please)\b[,.]?\s*/i;

/** Drop a leading "Poppins," / "Hey," / "Okay," so intent sees the real request. */
export function stripLeadingFiller(text: string): string {
  let next = text.trim();
  for (let i = 0; i < 3; i += 1) {
    const stripped = next.replace(LEADING_FILLER_RE, '').trim();
    if (stripped === next) break;
    next = stripped;
  }
  return next;
}

function leadingNameBeforeComma(text: string): string | null {
  const match = text.trim().match(/^([A-Za-z][a-zA-Z]{1,20})\s*,/);
  return match?.[1] ?? null;
}

function isNamedMemberErrand(text: string, names: string[]): boolean {
  const lead = leadingNameBeforeComma(text);
  if (!lead || !names.length) return false;
  const needle = lead.toLowerCase();
  return names.some((name) => name.trim().toLowerCase() === needle);
}

const NEED_OUT_LOW_RE =
  /\b(?:we\s+need|we(?:['’]re| are)\s+(?:out\s+of|low\s+on)|(?:ran\s+)?out\s+of|low\s+on)\b/i;

/** True when the person is adding a product to the grocery/shopping list (not assigning a chore). */
export function isGroceryAddIntent(
  text: string,
  opts?: { excludeNames?: string[] }
): boolean {
  const cacheKey = `${text}\n${(opts?.excludeNames ?? []).join('|')}`;
  if (groceryIntentCache.has(cacheKey)) return groceryIntentCache.get(cacheKey) === true;
  const result = groceryAddIntentUncached(text, opts);
  cacheSet(groceryIntentCache, cacheKey, result);
  return result;
}

function groceryAddIntentUncached(
  text: string,
  opts?: { excludeNames?: string[] }
): boolean {
  const names = opts?.excludeNames ?? [];
  if (isNamedMemberErrand(text, names)) return false;
  const stripped = stripLeadingFiller(text);
  if (isNamedMemberErrand(stripped, names)) return false;
  const lower = stripped.toLowerCase().trim();
  if (!lower) return false;

  // Explicit task/chore framing wins — "add a task to buy milk" stays a task.
  const listTail = /\b(to|on|onto)\s+(the\s+)?(list|grocer(?:y|ies)|shopping(\s+list)?)\b/.test(
    lower
  );
  if (
    (/\btask\b/.test(lower) || /\bchore\b/.test(lower) || /\bassign\b/.test(lower)) &&
    !listTail
  ) {
    return false;
  }

  const itemName = extractItemName(stripped);
  const listCue =
    /\b(grocery list|groceries|shopping list|to the list|on the list|onto the list|grocery)\b/.test(
      lower
    );
  const addCue = /\b(add|put|get|grab|pick up|buy)\b/.test(lower);
  const catalogOpts = opts?.excludeNames?.length
    ? { excludeNames: opts.excludeNames }
    : undefined;

  // Rule 1: add verb + list cue + item
  if (addCue && listCue && itemName && !/\btask\b/i.test(itemName)) return true;

  // Rule 2: add verb + catalog-confident item
  if (addCue && itemName && matchGroceryCatalog(itemName, catalogOpts)?.confident) return true;

  // Rule 3: need / out / low phrasing + catalog item, or a short product phrase
  if (NEED_OUT_LOW_RE.test(lower)) {
    const needItem = itemName;
    if (needItem && matchGroceryCatalog(needItem, catalogOpts)?.confident) return true;
    if (
      needItem &&
      !/\btask\b/i.test(needItem) &&
      needItem.split(/\s+/).length <= 4
    ) {
      return true;
    }
  }

  // Rule 4: existing shopping-intent path (clothing / drops)
  if (addCue && itemName && isShoppingIntent(stripped)) return true;
  return false;
}

export function isHomeworkIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(homework|schoolwork|school work|study|math|english|science|history|reading)\b/.test(lower);
}

export function isScheduleIntent(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\b(dentist|doctor|appointment|practice|lesson|meeting|conference|recital)\b/.test(lower)) {
    return true;
  }
  if (/\b(schedule|book|calendar)\b/.test(lower) && /\b(at|on|tomorrow|today|next)\b/.test(lower)) {
    return true;
  }
  return false;
}

export function scheduleTitleFromUtterance(text: string): string {
  const lower = text.toLowerCase();
  if (/\bdentist\b/.test(lower)) return 'Dentist';
  if (/\bdoctor\b/.test(lower)) return 'Doctor';
  if (/\bpractice\b/.test(lower)) return 'Practice';
  if (/\blesson\b/.test(lower)) return 'Lesson';
  if (/\bmeeting\b/.test(lower)) return 'Meeting';
  if (/\brecital\b/.test(lower)) return 'Recital';
  if (/\bconference\b/.test(lower)) return 'Conference';
  return 'Appointment';
}

export function timeFromUtterance(text: string): string | undefined {
  const match = text.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  return match?.[1]?.trim();
}

const DOMAIN_ALIASES: Record<string, string[]> = {
  kitchen_dining: ['kitchen', 'dishes', 'dishwasher', 'dining', 'sink', 'stove', 'fridge', 'microwave'],
  trash_recycling: ['trash', 'garbage', 'recycling', 'bins', 'compost', 'rubbish'],
  bathroom: ['bathroom', 'toilet', 'shower', 'bathtub', 'bath', 'mirror'],
  laundry: ['laundry', 'washer', 'dryer', 'fold laundry'],
  bedroom: ['bedroom', 'bed', 'closet', 'room'],
  living_shared: ['living room', 'living', 'couch', 'shared space', 'tv'],
  floors_deep_cleaning: ['floors', 'vacuum', 'mop', 'sweep'],
  pets: ['pets', 'dog', 'cat', 'litter'],
  car: ['car', 'garage', 'vehicle'],
  yard_outdoors: ['outdoors', 'yard', 'lawn', 'garden', 'outside'],
  personal_hygiene: ['hygiene', 'teeth', 'brush'],
  daily_routine: ['routine', 'morning', 'bedtime'],
  meals_groceries: ['groceries', 'grocery', 'meal prep'],
  home_maintenance: ['maintenance', 'repair', 'fix'],
  homework_education: ['homework', 'schoolwork', 'study'],
};

const WORD_NUM: Record<string, number> = {
  a: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWord(haystack: string, needle: string) {
  return new RegExp(`\\b${escapeRegExp(needle)}\\b`, 'i').test(haystack);
}

export function wantsFullEditor(utterance: string): boolean {
  const lower = utterance.toLowerCase();
  return (
    /\bi('ll| will) do it\b/.test(lower) ||
    /\bshow me\b/.test(lower) ||
    /\bfull editor\b/.test(lower) ||
    /\bopen the (editor|form|assign)\b/.test(lower) ||
    /\bopen (it|that) (so i can|for me)\b/.test(lower) ||
    /\bassign (it )?myself\b/.test(lower) ||
    /\bi('ll| will) assign (it )?myself\b/.test(lower) ||
    /\bso i can assign\b/.test(lower)
  );
}

export function isAssignSurfaceRoute(route: string): boolean {
  return (
    route.startsWith('/assign-task') ||
    route.startsWith('/create-task') ||
    route.includes('assign-task')
  );
}

export function isGrocerySurfaceRoute(route: string): boolean {
  return (
    route.includes('groceries') ||
    route.includes('shopping-mode') ||
    route.includes('grocery-browse')
  );
}

export function wantsSelfAssignee(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\bit'?s for me\b/.test(lower) ||
    /\bthe task is for me\b/.test(lower) ||
    /\bassign (?:it |them |this |that )?(?:to )?me\b/.test(lower) ||
    /\bfor me\b/.test(lower)
  );
}

export function dueLabelFromUtterance(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/\btomorrow\b/.test(lower)) return 'Tomorrow';
  if (/\btoday\b/.test(lower) || /\bevery day\b/.test(lower) || /\bdaily\b/.test(lower)) return 'Today';
  if (/\bthis week\b/.test(lower)) return 'This week';
  return undefined;
}

export function repeatFromUtterance(text: string): 'Daily' | undefined {
  const lower = text.toLowerCase();
  if (/\bevery day\b/.test(lower) || /\bdaily\b/.test(lower)) return 'Daily';
  return undefined;
}

const TITLE_STOP = new Set([
  'a',
  'an',
  'the',
  'my',
  'our',
  'your',
  'to',
  'for',
  'of',
  'and',
  'or',
  'on',
  'in',
  'at',
  'it',
  'them',
  'this',
  'that',
  'please',
  'just',
  'up',
  'me',
  'i',
  'task',
  'tasks',
  'desk',
  'chore',
  'chores',
  'todo',
  'todos',
  'today',
  'tomorrow',
  'tonight',
  'week',
  'add',
  'create',
  'make',
  'set',
  'schedule',
  'put',
]);

export type ExistingChoreTitle = {
  title: string;
  status?: string;
};

export type ResolvedChoreTitle = {
  title: string;
  libraryTaskId?: string;
  category?: string;
  /** Marginal fuzzy match — stage may NARROW / delay HOLD. */
  provisional?: boolean;
  confidence?: number;
};

/** Spoken wrapper (“I’ll set a task to…”) rather than the chore name itself. */
export function looksLikeSpokenSentence(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    /^(i['’]?ll|i will|i am going to|i['’]?m going to|can you|could you|would you|please)\b/.test(
      lower
    ) ||
    // Optional indirect object ("me") + adjectives between verb and task noun.
    /\b(set|create|add|make|schedule)\s+(up\s+)?(me\s+)?(a |an |the |my )?(?:\w+\s+){0,3}(task|desk|chore|todo)s?\b/.test(
      lower
    ) ||
    /\bdesk\s+for\s+to\b/.test(lower)
  );
}

function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !TITLE_STOP.has(word));
}

function isOpenTaskStatus(status?: string): boolean {
  const value = (status ?? '').toLowerCase();
  return value !== 'completed' && value !== 'cancelled' && value !== 'expired' && value !== 'missed';
}

function toChoreDisplayTitle(extracted: string): string {
  const cleaned = extracted
    .replace(/\b(my|our|your)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return extracted.trim();
  const titled = cleaned.replace(/\b[a-z]/gi, (char) => char.toUpperCase());
  return titled
    .replace(/\b(To|For|And|Of|On|In|At|The|A|An)\b/g, (word) => word.toLowerCase())
    .replace(/^[a-z]/, (char) => char.toUpperCase());
}

const CHORE_VERBS =
  'clean|wash|tend|load|unload|vacuum|sweep|mop|wipe|fold|put|take|empty|fill|water|feed|walk|mow|rake|organize|sort|pack|unpack|cook|prep|make|do|finish|start|check|fix';

/**
 * Additive title extract: find a verb + object and compose `Verb object`.
 * Returns undefined when nothing is confidently found (prefer empty over debris).
 */
export function extractSpokenChoreTitle(text: string): string | undefined {
  let raw = text.trim();
  raw = raw.replace(/^(hey[, ]+|ok[, ]+|okay[, ]+)?(poppins|nova)[, ]+/i, '');
  raw = raw.replace(/^(please\s+)/i, '');
  raw = raw.replace(/^(can you|could you|would you)\s+/i, '');
  raw = raw.replace(/^(i['’]?ll|i will|i am going to|i['’]?m going to)\s+/i, '');
  raw = raw.replace(
    /^(i(?:['’]d| would) like to|i wanted to|i want to|i needed to|i need to)\s+/i,
    ''
  );
  raw = raw.replace(/^(let'?s)\s+/i, '');
  raw = raw.replace(/^(set\s+)?desk\s+for\s+to\s+/i, '');

  // "… task to clean the dishes" / "… chore to wash car"
  const toVerb = raw.match(
    new RegExp(
      `\\b(?:task|desk|chore|todo)s?\\s+(?:for\\s+to\\s+|to\\s+)(${CHORE_VERBS})\\b([\\s\\w'-]+)?`,
      'i'
    )
  );
  if (toVerb) {
    const verb = toVerb[1];
    const object = (toVerb[2] ?? '')
      .replace(
        /\b(for\s+[A-Z][a-zA-Z]{1,20}|today|tomorrow|this week|tonight|every day|daily|assign(?: them| it| this| that)?(?: to me)?|for me|to me)\b/gi,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();
    if (object.length >= 2) return toChoreDisplayTitle(`${verb} ${object}`);
  }

  // "add me a cleaning task for dishes" → Clean dishes (gerund → verb)
  // "add a dishwasher task for Alex" → Dishwasher (noun before task)
  const framed = raw.match(
    /\b(?:set|create|add|make|schedule|put)\s+(?:up\s+)?(?:me\s+)?(?:a |an |the |my )?(?:(?:quick|new|small|simple)\s+)?(?:(\w+)\s+)?(?:task|desk|chore|todo)s?(?:\s+(?:for|to)\s+(.+))?$/i
  );
  if (framed) {
    const before = framed[1]?.trim();
    let after = (framed[2] ?? '')
      .replace(
        /\b(for\s+[A-Z][a-zA-Z]{1,20}|assign(?: them| it| this| that)?(?: to me)?|for me|to me)\b/gi,
        ' '
      )
      .replace(/\b(today|tomorrow|this week|tonight|every day|daily)\b/gi, ' ')
      .replace(/[?.!,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    after = after.replace(/^(to|and|just|a|an|the)\s+/i, '').trim();
    // Trailing assignee-only ("for Alex") is not a chore object.
    if (/^[A-Z][a-zA-Z]{1,20}$/.test(after)) after = '';

    const gerund = before?.toLowerCase();
    if (after.length >= 2) {
      if (gerund && gerund.endsWith('ing') && gerund.length > 4) {
        const stem = gerund.replace(/ning$/i, 'n').replace(/ing$/i, '');
        return toChoreDisplayTitle(`${stem} ${after}`);
      }
      if (gerund && new RegExp(`^(?:${CHORE_VERBS})$`, 'i').test(gerund)) {
        return toChoreDisplayTitle(`${gerund} ${after}`);
      }
      if (
        /^(kitchen|bathroom|laundry|bedroom|garage|yard|homework|car|dishes)$/i.test(after)
      ) {
        return undefined;
      }
      if (!/^(me|a|an|the|my|quick|new)\b/i.test(after) && after.split(/\s+/).length <= 6) {
        return toChoreDisplayTitle(after);
      }
    }
    // Noun before task: "dishwasher task", "homework task"
    if (
      before &&
      !/^(a|an|the|my|me|quick|new|small|simple)$/i.test(before) &&
      !/^(kitchen|bathroom|laundry)$/i.test(before)
    ) {
      if (gerund && gerund.endsWith('ing') && gerund.length > 4) {
        return undefined; // "cleaning task" with no object — not confident
      }
      return toChoreDisplayTitle(before);
    }
  }

  // Bare chore verb + object: "clean the dishes", "tend to the dishes", "wash my car"
  const bare = raw.match(new RegExp(`^(${CHORE_VERBS})(?:\\s+to)?\\s+(.+)$`, 'i'));
  if (bare) {
    const object = bare[2]
      .replace(
        /\b(for\s+[A-Z][a-zA-Z]{1,20}|assign(?: them| it| this| that)?(?: to me)?|for me|to me)\b/gi,
        ' '
      )
      .replace(/\b(today|tomorrow|this week|tonight|every day|daily)\b/gi, ' ')
      .replace(/[?.!,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (object.length >= 2) return toChoreDisplayTitle(`${bare[1]} ${object}`);
  }

  return undefined;
}

export function matchAssigneeName(
  text: string,
  memberNames: string[] = [],
  selfName?: string
): string | undefined {
  if (selfName && wantsSelfAssignee(text)) return selfName;
  const named = text.match(/\bfor\s+([A-Z][a-zA-Z]{1,20})\b/)?.[1];
  if (named && named.toLowerCase() !== 'me') {
    const exact = memberNames.find((name) => name.toLowerCase() === named.toLowerCase());
    if (exact) return exact;
    const fuzzy = bestFuzzyMatch(
      named,
      memberNames.map((name) => ({ key: name, value: name }))
    );
    if (fuzzy && isConfidentFuzzy(fuzzy)) return fuzzy.value;
    // Named person not on roster — keep literal only if it looks like a name token.
    if (!memberNames.length) return named;
  }
  const lower = text.toLowerCase();
  const exactWord = memberNames.find((name) => hasWord(lower, name.toLowerCase()));
  if (exactWord) return exactWord;

  // Fuzzy closed-set against roster tokens in the utterance.
  const tokens = lower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length >= 3);
  for (const token of tokens) {
    const hit = bestFuzzyMatch(
      token,
      memberNames.map((name) => ({ key: name, value: name }))
    );
    if (hit && isConfidentFuzzy(hit)) return hit.value;
  }
  return undefined;
}

export function matchLibraryIntent(
  text: string,
  memberNames: string[] = [],
  selfName?: string
): LibraryIntentMatch {
  const lower = text.toLowerCase().trim();
  if (!lower) return {};

  const assignee = matchAssigneeName(text, memberNames, selfName);
  const domains = [...choreDomains(), homeworkDomain()].filter(Boolean);
  let domainId: string | undefined;
  let domainLabel: string | undefined;
  let aliasHit: string | undefined;

  for (const domain of domains) {
    if (!domain) continue;
    const aliases = [
      domain.id.replace(/_/g, ' '),
      domain.shortName ?? '',
      domain.name,
      ...(DOMAIN_ALIASES[domain.id] ?? []),
    ]
      .map((item) => item.toLowerCase().trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    const hit = aliases.find((alias) => hasWord(lower, alias) || lower.includes(alias));
    if (hit) {
      domainId = domain.id;
      domainLabel = domain.shortName ?? domain.name.replace(/\s*&\s*.+$/, '');
      aliasHit = hit;
      break;
    }
  }

  const tasks = allLibraryTasks().filter((task) => !domainId || task.domainId === domainId);
  const scored: Array<{ task: LibraryTask; score: number }> = [];
  if (isGroceryAddIntent(text, { excludeNames: memberNames })) {
    return { assignee };
  }

  for (const task of tasks) {
    if (isGroceryMetaTask(task)) continue;
    let score = 0;
    const name = task.name.toLowerCase();
    if (hasWord(lower, name) || lower.includes(name)) score += name.length + 50;
    for (const term of task.searchTerms) {
      const t = term.toLowerCase();
      const minLen = domainId && task.domainId === domainId ? 3 : 4;
      if (t.length < minLen) continue;
      if (hasWord(lower, t) || lower.includes(t)) {
        score += t.length + (domainId && task.domainId === domainId ? 8 : 0);
      }
    }
    if (score > 0) scored.push({ task, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const tied =
    best &&
    scored.some((row) => row.score === best.score && row.task.id !== best.task.id);
  const specific =
    Boolean(best) &&
    !tied &&
    (best!.score >= 12 ||
      (best!.task.name.toLowerCase().length >= 10 && lower.includes(best!.task.name.toLowerCase())));

  if (specific && best && !isGroceryMetaTask(best.task)) {
    const domain = domains.find((item) => item?.id === best.task.domainId);
    return {
      domainId: best.task.domainId,
      domainLabel: domain?.shortName ?? domain?.name,
      task: best.task,
      assignee,
    };
  }

  return {
    domainId,
    domainLabel,
    taskQuery: aliasHit && aliasHit.length >= 4 ? aliasHit : undefined,
    assignee,
  };
}

function scoreLibraryTask(task: LibraryTask, tokens: string[], domainId?: string) {
  const hay = new Set([
    ...contentTokens(task.name),
    ...task.searchTerms
      .flatMap((term) => term.toLowerCase().split(/\s+/))
      .filter((term) => term.length >= 3 && !TITLE_STOP.has(term)),
  ]);
  const matched = tokens.filter((token) => hay.has(token));
  const unmatched = tokens.filter((token) => !matched.includes(token));
  let score = matched.reduce((sum, token) => sum + token.length, 0);
  if (domainId && task.domainId === domainId) score += 6;
  return { score, unmatched };
}

function matchCatalogForChore(chore: string, utterance?: string): LibraryTask | undefined {
  const fromIntent = matchLibraryIntent(utterance || chore).task;
  if (fromIntent && !isGroceryMetaTask(fromIntent)) return fromIntent;
  const tokens = contentTokens(chore);
  if (!tokens.length) return undefined;
  const domainId = matchLibraryIntent(utterance || chore).domainId;
  const ranked = allLibraryTasks()
    .filter((task) => !isGroceryMetaTask(task))
    .map((task) => ({ task, ...scoreLibraryTask(task, tokens, domainId) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.unmatched.length > 0) return undefined;
  const tied = ranked.some((row) => row.score === best.score && row.task.id !== best.task.id);
  if (tied) return undefined;
  const matchedCount = tokens.length - best.unmatched.length;
  if (tokens.length >= 2 && matchedCount < 2) return undefined;
  return best.task;
}

function matchExistingChoreTitle(
  chore: string,
  existing: ExistingChoreTitle[]
): string | undefined {
  const tokens = contentTokens(chore);
  if (!tokens.length) return undefined;
  const need = Math.min(2, tokens.length);
  const hits: Array<{ title: string; score: number; extra: number }> = [];
  for (const row of existing) {
    if (!row.title.trim() || !isOpenTaskStatus(row.status)) continue;
    const hay = contentTokens(row.title);
    if (!hay.length) continue;
    const overlap = tokens.filter((token) => hay.includes(token));
    if (overlap.length < need) continue;
    hits.push({
      title: row.title,
      score: overlap.length,
      extra: tokens.length - overlap.length,
    });
  }
  hits.sort((a, b) => b.score - a.score || a.extra - b.extra);
  const best = hits[0];
  if (!best) return undefined;
  const tied = hits.some(
    (row) => row.score === best.score && row.title.toLowerCase() !== best.title.toLowerCase()
  );
  if (tied) return undefined;
  return best.title;
}

/**
 * Chore name for Tasks: additive extract first; fuzzy closed-set only when extract fails.
 * Fuzzy never corrects free-text invented titles — catalog/roster only.
 */
export function resolvePoppinsChoreTitle(
  raw: string,
  opts?: { existingTasks?: ExistingChoreTitle[] }
): ResolvedChoreTitle {
  const trimmed = raw.trim();
  if (!trimmed) return { title: '' };

  const extracted = extractSpokenChoreTitle(trimmed);
  if (extracted) {
    const existing = matchExistingChoreTitle(extracted, opts?.existingTasks ?? []);
    if (existing) {
      const lib = matchCatalogForChore(existing, trimmed);
      return {
        title: existing,
        libraryTaskId: lib?.id,
        category: lib?.domainId,
      };
    }
    if (isGroceryAddIntent(trimmed)) {
      return { title: '' };
    }
    const lib = matchCatalogForChore(extracted, trimmed);
    if (lib && !isGroceryMetaTask(lib)) {
      return { title: lib.name, libraryTaskId: lib.id, category: lib.domainId };
    }
    return { title: toChoreDisplayTitle(extracted) };
  }

  // Extract failed — fuzzy recovery for mangled single terms (diches → dishes).
  const verbSet = new Set(CHORE_VERBS.split('|'));
  const termKeys = new Map<string, string>();
  for (const task of allLibraryTasks()) {
    if (isGroceryMetaTask(task)) continue;
    for (const key of [task.name, ...task.searchTerms]) {
      for (const part of contentTokens(key)) {
        if (!termKeys.has(part)) termKeys.set(part, part);
      }
      const whole = key.trim().toLowerCase();
      if (whole && !/\s/.test(whole) && !termKeys.has(whole)) {
        termKeys.set(whole, key.trim());
      }
    }
  }
  const catalogCandidates = [...termKeys.entries()].map(([k, v]) => ({ key: k, value: v }));
  const tokens = contentTokens(trimmed);
  const fuzzyNeedles =
    tokens.length > 0
      ? tokens.filter((token) => token.length >= 4 && !verbSet.has(token) && !TITLE_STOP.has(token))
      : [trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')].filter((t) => t.length >= 4);

  // Domain-only words (kitchen, laundry…) are categories — never invent a title from them
  // when the user said the word cleanly. Mangled hits (diches → dishes) still recover.
  const domainAliasTerms = new Set(
    Object.values(DOMAIN_ALIASES)
      .flat()
      .map((alias) => alias.toLowerCase())
      .filter((alias) => !/\s/.test(alias) && alias.length >= 4)
  );

  for (const token of fuzzyNeedles) {
    if (domainAliasTerms.has(token)) {
      continue;
    }
    const hit = bestFuzzyMatch(token, catalogCandidates);
    if (hit && isConfidentFuzzy(hit)) {
      const corrected = hit.value;
      const exactTermTasks = allLibraryTasks().filter(
        (task) =>
          !isGroceryMetaTask(task) &&
          (task.name.toLowerCase() === corrected.toLowerCase() ||
            task.searchTerms.some((term) => term.toLowerCase() === corrected.toLowerCase()))
      );
      if (exactTermTasks.length === 1) {
        const lib = exactTermTasks[0]!;
        return {
          title: lib.name,
          libraryTaskId: lib.id,
          category: lib.domainId,
          provisional: hit.distance > 0,
          confidence: hit.confidence,
        };
      }
      // Mangled transcript → known closed-set term, but several chores share it.
      // Prefer a provisional corrected word over inventing a free-text title.
      if (hit.distance > 0) {
        return {
          title: toChoreDisplayTitle(corrected),
          provisional: true,
          confidence: hit.confidence,
        };
      }
    }
  }

  if (looksLikeSpokenSentence(trimmed)) return { title: '' };
  // Bare clean domain word with no chore verb → empty title (category via matchLibraryIntent).
  if (fuzzyNeedles.length === 1 && domainAliasTerms.has(fuzzyNeedles[0]!)) {
    return { title: '' };
  }
  return { title: toChoreDisplayTitle(trimmed) };
}

export function isCompleteIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\bi('ve| have) (just )?(done|finished|completed)\b/.test(lower) ||
    /\bmark(ed)? (.{0,40} )?(as )?done\b/.test(lower) ||
    /\bthis task (is |has been )?done\b/.test(lower) ||
    /\bi finished\b/.test(lower) ||
    /\btask (has been )?done\b/.test(lower)
  );
}

export function completeTitleFromUtterance(text: string): string | undefined {
  const lower = text.toLowerCase();
  const fromDone =
    lower.match(
      /\b(?:done|finished|completed)\s+(?:the |my |this )?(?:task )?([a-z][a-z0-9 &'-]{1,40})$/
    )?.[1] ??
    lower.match(/\bmark(?:ed)?\s+(.+?)\s+(?:as )?done\b/)?.[1];
  if (fromDone) {
    return fromDone.replace(/\b(the|this|my|task)\b/g, '').replace(/\s+/g, ' ').trim();
  }
  const lib = matchLibraryIntent(text);
  return lib.task?.name ?? lib.taskQuery ?? lib.domainLabel;
}

export function isShoppingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\b(shopping list|want to (buy|get)|pick up|sneakers?|hoodie|jordan|nike|clothes|clothing)\b/.test(lower)) {
    return true;
  }
  if (/\bbuy\b/.test(lower) && !/\bbuy (milk|eggs|bread|grocer)/.test(lower)) return true;
  const classified = classifyGroceryItem(extractItemName(text) || text);
  return isClothingCategory(classified.categoryId);
}

function cleanExtractedItemName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const name = raw
    .replace(/\b(please|thanks|thank you)\b/gi, '')
    .replace(/\b(today|tomorrow|tonight|this week)\b/gi, '')
    .replace(/\bon the way home\b/gi, '')
    .replace(/[?.!,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    name.length < 2 ||
    /\btask\b/i.test(name) ||
    /\bgo to store\b/i.test(name) ||
    /\b(list|grocery|shopping)\b/i.test(name)
  ) {
    return undefined;
  }
  return name.slice(0, 48);
}

export function extractItemName(text: string): string | undefined {
  const cleaned = text
    .replace(/\b(please|thanks|thank you)\b/gi, '')
    .replace(/\bthat'?s releasing\b.*$/i, '')
    .replace(/\bthat is releasing\b.*$/i, '')
    .replace(/\breleasing in .+$/i, '')
    .replace(/\bcoming out .+$/i, '')
    .replace(/\bin \d+ weeks?\b/gi, '')
    .replace(/\bin (a|one|two|three|four|five) weeks?\b/gi, '')
    .trim();

  // Additive: verb + item noun. List preposition (to|on|onto|in|into) strips the tail.
  const framed = cleaned.match(
    /\b(?:add|buy|get|grab|pick\s+up|put)\s+(?:some |the |a |an |my )?(?:new )?(.+?)(?:\s+(?:to|on|onto|in|into)\s+(?:the\s+)?(?:list|grocer(?:y|ies)|shopping(?:\s+list)?))\b/i
  );
  if (framed?.[1]) {
    return cleanExtractedItemName(framed[1]);
  }

  // Need / out / low: "we need milk", "we're out of eggs", "low on coffee", "ran out of paper towels"
  const needOut = cleaned.match(
    /\b(?:we\s+need|we(?:['’]re| are)\s+(?:out\s+of|low\s+on)|(?:ran\s+)?out\s+of|low\s+on)\s+(?:some |the |a |an |my )?(.+)$/i
  );
  if (needOut?.[1]) {
    return cleanExtractedItemName(needOut[1]);
  }

  // No list-word: still try a short "add X" when confident.
  const bare = cleaned.match(
    /\b(?:add|buy|get|grab|pick\s+up)\s+(?:some |the |a |an |my )?(?:new )?((?:[0-9%]|[a-z])[\w\s'%.+-]{0,40})$/i
  );
  if (bare?.[1]) {
    const name = cleanExtractedItemName(bare[1]);
    if (name && name.split(/\s+/).length <= 5) return name;
  }

  const want = cleaned.match(/\bwant(?: to)?\s+(?:the |a |an )?([a-z][\w\s'-]{1,40})$/i)?.[1];
  if (want) {
    return cleanExtractedItemName(want);
  }
  return undefined;
}

export function parseReleaseDate(text: string, now = new Date()): string | undefined {
  const lower = text.toLowerCase();
  if (!/\b(releas|coming out|comes out|drop(?:s|ping)?|in \d+ weeks?|in (a|one|two|three) weeks?)\b/.test(lower)) {
    return undefined;
  }
  const weekMatch = lower.match(/\bin (\d+|a|one|two|three|four|five) weeks?\b/);
  if (weekMatch) {
    const n = WORD_NUM[weekMatch[1]!] ?? Number(weekMatch[1]);
    if (Number.isFinite(n) && n > 0) {
      const d = new Date(now);
      d.setDate(d.getDate() + n * 7);
      return formatLocalDate(d);
    }
  }
  const dayMatch = lower.match(/\bin (\d+) days?\b/);
  if (dayMatch) {
    const n = Number(dayMatch[1]);
    if (Number.isFinite(n) && n > 0) {
      const d = new Date(now);
      d.setDate(d.getDate() + n);
      return formatLocalDate(d);
    }
  }
  return undefined;
}

export function isChoreAssignIntent(
  text: string,
  opts?: { excludeNames?: string[] }
): boolean {
  const lower = text.toLowerCase();
  if (isCompleteIntent(text) || wantsFullEditor(text)) return false;
  if (isGroceryAddIntent(text, opts)) return false;
  if (isScheduleIntent(text)) return false;
  // "Drako, buy milk on the way home" — named errand stays a task, not grocery.
  // Fillers (Poppins, Hey, Okay) are not member names.
  const lead = leadingNameBeforeComma(text);
  const filler = lead ? LEADING_FILLER_RE.test(`${lead},`) : false;
  if (
    lead &&
    !filler &&
    /\b(buy|get|grab|pick\s+up|add|do|clean|wash)\b/.test(lower)
  ) {
    return true;
  }
  if (
    /\b(add|create|make|set up|setup|schedule|set)\b/.test(lower) &&
    (/\btask\b/.test(lower) || /\bdesk\b/.test(lower) || /\bchore\b/.test(lower) || /\bfor\b/.test(lower))
  ) {
    return true;
  }
  if (/\bassign\b/.test(lower)) return true;
  if (/\b(clean|wash|tidy|vacuum|mop|laundry|dishes|chore|tend)\b/.test(lower)) return true;
  const domainId = matchLibraryIntent(text).domainId;
  if (domainId === 'meals_groceries' && isGroceryAddIntent(text, opts)) return false;
  return Boolean(domainId);
}

function titleCaseGroceryName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

export function groceryAddActionsFromUtterance(
  text: string,
  opts?: { excludeNames?: string[] }
): Array<Record<string, unknown>> | null {
  if (!isGroceryAddIntent(text, opts)) return null;
  const itemName = extractItemName(text);
  if (!itemName || /\btask\b/i.test(itemName)) return null;
  if (opts?.excludeNames?.length && matchGroceryCatalog(itemName, opts) === null) {
    const memberItem = opts.excludeNames.some(
      (name) => name.trim().toLowerCase() === itemName.trim().toLowerCase()
    );
    if (memberItem && !isShoppingIntent(text) && !/\b(list|grocer)/i.test(text)) return null;
  }
  const shopping = isShoppingIntent(text);
  const displayName = titleCaseGroceryName(itemName);
  const actions: Array<Record<string, unknown>> = [
    {
      type: 'add_grocery',
      name: displayName,
      category: shopping ? 'Clothing' : undefined,
      lane: shopping ? 'clothing' : 'grocery',
    },
  ];
  const releaseDate = parseReleaseDate(text);
  if (releaseDate) {
    actions.push({
      type: 'create_calendar_event',
      title: `${displayName} drop`,
      date: releaseDate,
    });
  }
  return actions;
}
