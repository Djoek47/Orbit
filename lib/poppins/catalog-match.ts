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
    /\bassign (?:it )?to me\b/.test(lower) ||
    /\bfor me\b/.test(lower)
  );
}

export function dueLabelFromUtterance(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/\btomorrow\b/.test(lower)) return 'Tomorrow';
  if (/\btoday\b/.test(lower)) return 'Today';
  if (/\bthis week\b/.test(lower)) return 'This week';
  return undefined;
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
  let best: { task: LibraryTask; score: number } | undefined;
  for (const task of tasks) {
    const name = task.name.toLowerCase();
    if (hasWord(lower, name) || lower.includes(name)) {
      const score = name.length + 50;
      if (!best || score > best.score) best = { task, score };
      continue;
    }
    for (const term of task.searchTerms) {
      const t = term.toLowerCase();
      if (t.length < 4) continue;
      if (hasWord(lower, t) || lower.includes(t)) {
        const score = t.length;
        if (!best || score > best.score) best = { task, score };
      }
    }
  }

  const specific =
    best &&
    (best.score >= 12 || (best.task.name.toLowerCase().length >= 10 && lower.includes(best.task.name.toLowerCase())));

  if (specific && best) {
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
  if (
    /\b(add|create|make|set up|setup|schedule)\b/.test(lower) &&
    (/\btask\b/.test(lower) || /\bchore\b/.test(lower) || /\bfor\b/.test(lower))
  ) {
    return true;
  }
  if (/\bassign\b/.test(lower)) return true;
  if (/\b(clean|wash|tidy|vacuum|mop|laundry|dishes|chore)\b/.test(lower)) return true;
  return Boolean(matchLibraryIntent(text).domainId);
}
