/**
 * Match spoken/typed household intent to the Assign library and shopping lane.
 * Used by AIUIC so Poppins can narrow Kitchen (etc.) instead of dumping the full form.
 */

import { classifyGroceryItem, isClothingCategory } from '@/lib/grocery/classify';
import { formatLocalDate } from '@/lib/streaks/local-date';
import { allLibraryTasks, choreDomains, homeworkDomain, type LibraryTask } from '@/lib/tasks/task-library';

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

/** True when the person is adding a product to the grocery/shopping list (not assigning a chore). */
export function isGroceryAddIntent(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return false;
  if (/\btask\b/.test(lower) && /\b(chore|assign)\b/.test(lower)) return false;
  const itemName = extractItemName(text);
  const listCue =
    /\b(grocery list|groceries|shopping list|to the list|on the list|grocery)\b/.test(lower);
  const addCue = /\b(add|put|get|grab|pick up|buy)\b/.test(lower);
  if (addCue && listCue && itemName && !/\btask\b/i.test(itemName)) return true;
  if (addCue && itemName && /\b(milk|eggs|bread|butter|cheese|yogurt|fruit|vegetable)\b/.test(lower)) {
    return true;
  }
  if (addCue && itemName && isShoppingIntent(text)) return true;
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
]);

export type ExistingChoreTitle = {
  title: string;
  status?: string;
};

export type ResolvedChoreTitle = {
  title: string;
  libraryTaskId?: string;
  category?: string;
};

/** Spoken wrapper (“I’ll set a task to…”) rather than the chore name itself. */
export function looksLikeSpokenSentence(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    /^(i['’]?ll|i will|i am going to|i['’]?m going to|can you|could you|would you|please)\b/.test(
      lower
    ) ||
    /\b(set|create|add|make|schedule)\s+(up\s+)?(a |an |the |my )?(task|desk|chore|todo)s?\b/.test(
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

/** Phrase the person said when it is not a catalog chore name. */
export function extractSpokenChoreTitle(text: string): string | undefined {
  let t = text.trim();
  t = t.replace(/^(hey[, ]+|ok[, ]+|okay[, ]+)?(poppins|nova)[, ]+/i, '');
  t = t.replace(/^(please\s+)/i, '');
  t = t.replace(/^(can you|could you|would you)\s+/i, '');
  t = t.replace(/^(i['’]?ll|i will|i am going to|i['’]?m going to)\s+/i, '');
  t = t.replace(
    /^(i(?:['’]d| would) like to|i wanted to|i want to|i needed to|i need to)\s+/i,
    ''
  );
  t = t.replace(/^(let'?s)\s+/i, '');
  t = t.replace(
    /^(set|create|add|make|schedule|put)\s+(up\s+)?(a |an |the |my )?(task|desk|chore|todo)s?\s+((for\s+to|for|to)\s+)?/i,
    ''
  );
  t = t.replace(/^(set\s+)?desk\s+for\s+to\s+/i, '');
  t = t
    .replace(
      /\b(can you|could you|please|i (?:wanted to|want to|need to|would like to)|let'?s|i'?m going to|i am going to)\b/gi,
      ' '
    )
    .replace(/\b(assign(?: them| it| this| that)?(?: to me)?|for me|to me)\b/gi, ' ')
    .replace(/\bfor\s+[A-Z][a-zA-Z]{1,20}\b/g, ' ')
    .replace(/\b(today|tomorrow|this week|every day|daily|tonight)\b/gi, ' ')
    .replace(/\b(a task|a chore|the task|task called|called|schedule|set up|setup|create|add|make)\b/gi, ' ')
    .replace(/\b(task|desk|chore|todo)s?\b/gi, ' ')
    .replace(/\bfor\s+(kitchen|bathroom|laundry|the house|homework)\b/gi, ' ')
    .replace(/[?.!,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  t = t.replace(/^(to|and|just|a|an|the)\s+/i, '').trim();
  if (t.length < 3) return undefined;
  if (
    /^(kitchen|dishes|bathroom|laundry|chore|task|desk|the dishes|kitchen dining)$/i.test(t)
  ) {
    return undefined;
  }
  return t;
}

export function matchAssigneeName(
  text: string,
  memberNames: string[] = [],
  selfName?: string
): string | undefined {
  if (selfName && wantsSelfAssignee(text)) return selfName;
  const named = text.match(/\bfor\s+([A-Z][a-zA-Z]{1,20})\b/)?.[1];
  if (named && named.toLowerCase() !== 'me') return named;
  const lower = text.toLowerCase();
  return memberNames.find((name) => hasWord(lower, name.toLowerCase()));
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
  if (isGroceryAddIntent(text)) {
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
 * Chore name for Tasks: catalog match, else a close open list item, else a short title.
 * Never keep “I’ll set a task to wash my car” as the row title.
 */
export function resolvePoppinsChoreTitle(
  raw: string,
  opts?: { existingTasks?: ExistingChoreTitle[] }
): ResolvedChoreTitle {
  const trimmed = raw.trim();
  if (!trimmed) return { title: '' };
  const extracted = extractSpokenChoreTitle(trimmed);
  if (!extracted) {
    if (looksLikeSpokenSentence(trimmed)) return { title: '' };
    return { title: toChoreDisplayTitle(trimmed) };
  }
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
  const match =
    cleaned.match(
      /\b(?:add|buy|get|grab|pick up)\s+(?:some |the |a |an )?(?:new )?(.+?)(?:\s+to (?:the )?(?:list|grocer(?:y|ies)|shopping).*)?$/i
    )?.[1] ??
    cleaned.match(/\bwant(?: to)?\s+(?:the |a |an )?(.+)$/i)?.[1];
  const name = match?.replace(/\b(please|thanks)\b/gi, '').trim();
  if (!name || name.length < 2 || /\btask\b/i.test(name)) return undefined;
  return name.replace(/\s+/g, ' ').slice(0, 48);
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

export function isChoreAssignIntent(text: string): boolean {
  const lower = text.toLowerCase();
  if (isCompleteIntent(text) || wantsFullEditor(text)) return false;
  if (isGroceryAddIntent(text)) return false;
  if (isScheduleIntent(text)) return false;
  if (
    /\b(add|create|make|set up|setup|schedule|set)\b/.test(lower) &&
    (/\btask\b/.test(lower) || /\bdesk\b/.test(lower) || /\bchore\b/.test(lower) || /\bfor\b/.test(lower))
  ) {
    return true;
  }
  if (/\bassign\b/.test(lower)) return true;
  if (/\b(clean|wash|tidy|vacuum|mop|laundry|dishes|chore|tend)\b/.test(lower)) return true;
  const domainId = matchLibraryIntent(text).domainId;
  if (domainId === 'meals_groceries' && isGroceryAddIntent(text)) return false;
  return Boolean(domainId);
}

export function groceryAddActionsFromUtterance(
  text: string
): Array<Record<string, unknown>> | null {
  if (!isGroceryAddIntent(text)) return null;
  const itemName = extractItemName(text);
  if (!itemName || /\btask\b/i.test(itemName)) return null;
  const shopping = isShoppingIntent(text);
  const actions: Array<Record<string, unknown>> = [
    {
      type: 'add_grocery',
      name: itemName.replace(/\b(please|thanks)\b/g, '').trim() || itemName,
      category: shopping ? 'Clothing' : undefined,
      lane: shopping ? 'clothing' : 'grocery',
    },
  ];
  const releaseDate = parseReleaseDate(text);
  if (releaseDate) {
    actions.push({
      type: 'create_calendar_event',
      title: `${itemName} drop`,
      date: releaseDate,
    });
  }
  return actions;
}
