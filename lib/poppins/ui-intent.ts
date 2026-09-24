/**
 * Expo Go / text-twin fallback: turn a clear spoken or typed clause into ui_actions.
 * Live Luna/Realtime still win when they already returned ui_actions — AIUIC rewrites
 * leftover navigate_coach ("I can open that for you") into the stage.
 */

import { formatLocalDate } from '@/lib/streaks/local-date';
import { occurrenceDateForDueLabel } from '@/lib/tasks/due-label';
import {
  assigneeBlockedByMemory,
  getActiveHouseMemory,
  preferredStore,
} from '@/lib/poppins/house-memory';
import {
  completeTitleFromUtterance,
  dueLabelFromUtterance,
  extractItemName,
  extractSpokenChoreTitle,
  GROCERY_META_TASK_IDS,
  groceryAddActionsFromUtterance,
  isAssignSurfaceRoute,
  isChoreAssignIntent,
  isCompleteIntent,
  isGroceryAddIntent,
  isGrocerySurfaceRoute,
  isHomeworkIntent,
  isScheduleIntent,
  isShoppingIntent,
  matchLibraryIntent,
  parseReleaseDate,
  repeatFromUtterance,
  resolvePoppinsChoreTitle,
  scheduleTitleFromUtterance,
  timeFromUtterance,
  toChoreDisplayTitle,
  wantsFullEditor,
  looksLikeSpokenSentence,
  type ExistingChoreTitle,
} from '@/lib/poppins/catalog-match';

/** B4 — refuse these as grocery names / task titles. */
export const FILLER_ITEM_NAMES = new Set([
  'something',
  'stuff',
  'thing',
  'things',
  'it',
  'that',
  'some',
  'anything',
]);

export function isFillerItemName(name: string | undefined | null): boolean {
  const cleaned = name?.trim().toLowerCase().replace(/[.!?]+$/g, '') ?? '';
  return Boolean(cleaned) && FILLER_ITEM_NAMES.has(cleaned);
}

export type HouseholdIntentOpts = {
  memberNames?: string[];
  selfName?: string;
  existingTasks?: ExistingChoreTitle[];
};

export function parseHouseholdIntent(
  utterance: string,
  opts?: HouseholdIntentOpts
): Array<Record<string, unknown>> {
  const text = utterance.trim();
  if (!text) return [];
  const raw = parseHouseholdIntentRaw(text, opts);
  return raw.map((action) => {
    const type = String(action.type ?? '');
    if (type === 'create_task' || type === 'create_task_draft' || type === 'assign_task') {
      return enrichTaskDraft(action, text, opts);
    }
    if (type === 'add_grocery') {
      return enrichGrocery(action, text)[0] ?? action;
    }
    return action;
  });
}

function parseHouseholdIntentRaw(
  utterance: string,
  opts?: HouseholdIntentOpts
): Array<Record<string, unknown>> {
  const text = utterance.trim();
  if (!text) return [];
  const lower = text.toLowerCase();
  const memberNames = opts?.memberNames ?? [];
  const selfName = opts?.selfName;

  if (wantsFullEditor(lower)) {
    if (/\bevent|calendar|appointment|dentist/.test(lower)) {
      return [{ type: 'navigate', route: '/create-event', openEditor: true, reason: 'Opening the editor.' }];
    }
    if (/\bitinerary|trip|route/.test(lower)) {
      return [{ type: 'navigate', route: '/create-itinerary', openEditor: true, reason: 'Opening the editor.' }];
    }
    if (/\bgrocer|shopping|list\b/.test(lower)) {
      return [{ type: 'navigate', route: '/(tabs)/groceries', openEditor: true, reason: 'Opening the list.' }];
    }
    return [{ type: 'navigate', route: '/assign-task', openEditor: true, reason: 'Opening Assign so you can pick it yourself.' }];
  }

  if (/\bhouse rules\b/.test(lower)) {
    return [{ type: 'navigate', route: '/house-rules', reason: 'I can open House Rules for you.' }];
  }
  if (/\brecess\b/.test(lower)) {
    return [{ type: 'navigate', route: '/recess', reason: 'I can open Recess for you.' }];
  }
  if (/\b(billing|premium|subscription)\b/.test(lower)) {
    return [{ type: 'navigate', route: '/premium', reason: 'I can open billing for you.' }];
  }
  if (/\b(settings|account)\b/.test(lower)) {
    return [{ type: 'navigate', route: '/settings', reason: 'I can open Settings for you.' }];
  }

  // Ranks peek — read-only leaderboard on the stage (not a write).
  if (
    /\b(who('?s| is) ahead|show (me )?(the )?ranks|leaderboard|rankings|who('?s| is) winning)\b/i.test(
      text
    )
  ) {
    return [{ type: 'ranks_peek', rows: [] }];
  }

  // Save place — HOLD on the Places card.
  const savePlace = text.match(
    /\b(?:save|remember|add)\s+(?:(?:the|this|our)\s+)?(?:place|address|spot)\s+(?:as\s+)?(.+?)(?:\s+at\s+(.+))?$/i
  ) ?? text.match(
    /\b(?:save|remember)\s+(.+?)\s+(?:as\s+)?(?:a\s+)?(?:place|address|spot)(?:\s+at\s+(.+))?$/i
  );
  if (savePlace) {
    const placeName = (savePlace[1] ?? '').trim().replace(/[.!?]+$/, '');
    const placeAddress = (savePlace[2] ?? '').trim().replace(/[.!?]+$/, '');
    if (placeName && !isFillerItemName(placeName)) {
      return [
        {
          type: 'save_place',
          name: placeName,
          address: placeAddress || undefined,
          kind: 'custom',
        },
      ];
    }
  }

  // Grant allowance — confirm-only on stage.
  const allowance = text.match(
    /\b(?:grant|give|pay)\s+([A-Z][a-zA-Z]+)\s+(?:an?\s+)?(?:allowance\s+of\s+)?(?:\$\s*)?(\d+(?:\.\d{1,2})?)\b/i
  ) ?? text.match(
    /\b(?:grant|give)\s+([A-Z][a-zA-Z]+)\s+(?:\$\s*)?(\d+(?:\.\d{1,2})?)\s+(?:allowance|bucks|dollars|xp)\b/i
  );
  if (allowance) {
    const memberName = allowance[1]!.trim();
    const amount = allowance[2]!;
    return [
      {
        type: 'grant_allowance',
        memberName,
        amountLabel: `$${amount}`,
        kind: 'grant',
      },
    ];
  }

  if (isCompleteIntent(text)) {
    const title = completeTitleFromUtterance(text);
    return [{ type: 'complete_task', title: title || 'this task' }];
  }

  if (/\bclear\s+(the\s+)?(grocery\s+|shopping\s+)?list\b/i.test(text)) {
    return [{ type: 'clear_grocery_list' }];
  }

  const groceryFromSpeech = groceryAddActionsFromUtterance(text, {
    excludeNames: memberNames,
  });
  if (groceryFromSpeech?.length) {
    return groceryFromSpeech.flatMap((action) => enrichGrocery(action, text));
  }

  const wantsItineraryStop =
    /\b(store|shop|stop)\b/.test(lower) && /\b(itinerary|trip|route)\b/.test(lower);

  if (isScheduleIntent(text)) {
    const due = dueLabelFromUtterance(text);
    const eventAction: Record<string, unknown> = {
      type: 'create_calendar_event',
      title: scheduleTitleFromUtterance(text),
      date: due ? occurrenceDateForDueLabel(due) : formatLocalDate(new Date()),
      time: timeFromUtterance(text) ?? '',
    };
    if (wantsItineraryStop) {
      return [{ type: 'create_itinerary', title: 'Store' }, eventAction];
    }
    return [eventAction];
  }

  if (isChoreAssignIntent(text, { excludeNames: memberNames })) {
    const match = matchLibraryIntent(text, memberNames, selfName);
    const resolved = resolvePoppinsChoreTitle(text, { existingTasks: opts?.existingTasks });
    const rawTitle = resolved.title?.trim() ?? '';
    const domainOnly =
      Boolean(match.domainLabel) &&
      !resolved.libraryTaskId &&
      rawTitle.toLowerCase() === String(match.domainLabel).toLowerCase();
    const title =
      !rawTitle || /^(task|chore)$/i.test(rawTitle) || domainOnly || isFillerItemName(rawTitle)
        ? ''
        : rawTitle;
    const due = dueLabelFromUtterance(text);
    const named =
      match.assignee ??
      text.match(/\b(?:for|to)\s+([A-Z][a-zA-Z]+)\b/)?.[1];
    const assignee = named && named.toLowerCase() !== 'me' ? named : match.assignee;
    const useCatalog = Boolean(resolved.libraryTaskId);
    const homework = isHomeworkIntent(text) || resolved.category === 'homework_education';
    return [
      {
        type: 'create_task_draft',
        title,
        assignee,
        due,
        category:
          homework
            ? 'homework_education'
            : resolved.category ?? match.domainId ?? (useCatalog ? match.task?.domainId : undefined),
        libraryTaskId: resolved.libraryTaskId,
        taskQuery: useCatalog ? undefined : match.taskQuery,
        repeat: repeatFromUtterance(text),
        provisional: resolved.provisional === true,
      },
    ];
  }

  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function groceryRewriteFromDraft(
  action: Record<string, unknown>,
  utterance: string
): Array<Record<string, unknown>> | null {
  if (isGroceryAddIntent(utterance)) {
    const itemName = extractItemName(utterance);
    if (itemName && !/\btask\b/i.test(itemName)) {
      return enrichGrocery({ type: 'add_grocery', name: itemName }, utterance);
    }
  }
  const libraryTaskId = String(action.libraryTaskId ?? '');
  if (libraryTaskId && GROCERY_META_TASK_IDS.has(libraryTaskId)) {
    const itemName = extractItemName(utterance) || (typeof action.title === 'string' ? action.title.trim() : '') || undefined;
    if (!itemName) return null;
    return enrichGrocery({ type: 'add_grocery', name: itemName }, utterance);
  }
  const title = String(action.title ?? '').trim().toLowerCase();
  if (title.includes('add items to the grocery list') || title.includes('add items to grocery list')) {
    const itemName = extractItemName(utterance);
    if (itemName) return enrichGrocery({ type: 'add_grocery', name: itemName }, utterance);
    return null;
  }
  return null;
}

function enrichTaskDraft(
  action: Record<string, unknown>,
  utterance: string,
  opts?: HouseholdIntentOpts
): Record<string, unknown> {
  // Person-assigned errands stay chores — don't rewrite "Drako, buy milk" into a grocery add.
  const namedAssignee =
    typeof action.assignee === 'string' && action.assignee.trim()
      ? action.assignee
      : utterance.match(/\b([A-Z][a-zA-Z]{1,20})\s*,/)?.[1];
  const groceryRewrite = namedAssignee ? null : groceryRewriteFromDraft(action, utterance);
  if (groceryRewrite?.length) {
    return groceryRewrite[0]!;
  }

  const match = matchLibraryIntent(utterance, opts?.memberNames, opts?.selfName);
  const next = { ...action };
  if (match.assignee && !next.assignee) next.assignee = match.assignee;
  if (match.domainId && !next.category) next.category = match.domainId;
  const due = dueLabelFromUtterance(utterance);
  if (due && !next.due) next.due = due;
  const spoken = repeatFromUtterance(utterance);
  if (spoken && !next.repeat) next.repeat = spoken;
  const existingTitle = String(next.title ?? '').trim();
  const heard = extractSpokenChoreTitle(utterance);
  const resolved = resolvePoppinsChoreTitle(existingTitle || heard || utterance, {
    existingTasks: opts?.existingTasks,
  });
  if (heard) {
    // Prefer a confident catalog match over a free-text extract.
    if (resolved.libraryTaskId && resolved.title && !resolved.provisional) {
      next.title = resolved.title;
      next.libraryTaskId = resolved.libraryTaskId;
      next.category = resolved.category ?? next.category;
    } else {
      next.title = heard;
      if (resolved.libraryTaskId && !resolved.provisional) {
        next.libraryTaskId = resolved.libraryTaskId;
        next.category = resolved.category ?? next.category;
      }
    }
  } else if (resolved.title && !looksLikeSpokenSentence(resolved.title) && !resolved.provisional) {
    next.title = resolved.title;
    if (resolved.libraryTaskId && !next.libraryTaskId) {
      next.libraryTaskId = resolved.libraryTaskId;
      next.category = resolved.category ?? next.category;
    }
  } else if (!existingTitle || looksLikeSpokenSentence(existingTitle)) {
    next.title = '';
    if (match.task && !next.libraryTaskId && !match.taskQuery) {
      next.libraryTaskId = match.task.id;
      next.title = match.task.name;
      next.category = match.task.domainId;
    } else if (match.taskQuery) {
      next.taskQuery = match.taskQuery;
      // Domain-only queries (kitchen, laundry) stay empty — pick from catalog.
      const domainOnly =
        Boolean(match.domainLabel) &&
        match.taskQuery.toLowerCase() === String(match.domainLabel).toLowerCase();
      if (!domainOnly) {
        next.title = toChoreDisplayTitle(match.taskQuery);
      }
    }
  }
  if (match.taskQuery && !next.taskQuery) next.taskQuery = match.taskQuery;
  // Prefer the spoken object over a provisional fuzzy library miss.
  if (match.taskQuery && (resolved.provisional || looksLikeSpokenSentence(String(next.title ?? '')))) {
    const domainOnly =
      Boolean(match.domainLabel) &&
      match.taskQuery.toLowerCase() === String(match.domainLabel).toLowerCase();
    if (!domainOnly) {
      next.title = toChoreDisplayTitle(match.taskQuery);
    }
    if (resolved.provisional) {
      delete next.libraryTaskId;
    }
  }
  if (typeof next.title !== 'string') next.title = '';
  if (isFillerItemName(String(next.title))) {
    next.title = '';
    next.ask = 'What should I add?';
    next.thinkingLine = 'What should I add?';
  }
  const assignee = typeof next.assignee === 'string' ? next.assignee : undefined;
  const title = typeof next.title === 'string' ? next.title : undefined;
  if (assigneeBlockedByMemory(getActiveHouseMemory(), assignee, title)) {
    next.assignee = undefined;
  }
  if (isHomeworkIntent(utterance) || next.category === 'homework_education') {
    next.category = 'homework_education';
  }
  if (!namedAssignee) {
    const postRewrite = groceryRewriteFromDraft(next, utterance);
    if (postRewrite?.length) return postRewrite[0]!;
  }
  return next;
}

function enrichGrocery(
  action: Record<string, unknown>,
  utterance: string
): Array<Record<string, unknown>> {
  const rawName = String(action.name ?? '').trim() || extractItemName(utterance) || undefined;
  if (isFillerItemName(rawName)) {
    return [
      {
        type: 'add_grocery',
        name: '',
        ask: 'What should I add?',
        thinkingLine: 'What should I add?',
        sourceUtterance: utterance,
      },
    ];
  }
  const name = rawName;
  if (!name) {
    return [
      {
        type: 'add_grocery',
        name: '',
        ask: 'What should I add?',
        thinkingLine: 'What should I add?',
        sourceUtterance: utterance,
      },
    ];
  }
  const shopping = isShoppingIntent(utterance) || action.lane === 'clothing';
  const releaseDate =
    (action.releaseDate ? String(action.releaseDate) : undefined) || parseReleaseDate(utterance);
  const storeHint = preferredStore(getActiveHouseMemory());
  const grocery: Record<string, unknown> = {
    ...action,
    type: 'add_grocery',
    name,
    category: shopping ? String(action.category ?? 'Clothing') : action.category,
    lane: shopping ? 'clothing' : action.lane ?? 'grocery',
    storeHint: shopping ? action.storeHint : action.storeHint ?? storeHint,
  };
  const out = [grocery];
  if (releaseDate) {
    out.push({
      type: 'create_calendar_event',
      title: `${name} drop`,
      date: releaseDate,
      category: 'Family',
    });
  }
  return out;
}

/**
 * AIUIC rewrite: leftover navigate_coach ("I can open that for you") becomes
 * the Assign / grocery stage unless the person asked to drive the full screen.
 */
export function rewriteAiuicActions(
  actions: Array<Record<string, unknown>>,
  utterance = '',
  opts?: HouseholdIntentOpts
): Array<Record<string, unknown>> {
  const parsed = parseHouseholdIntent(utterance, opts);
  const editor = wantsFullEditor(utterance);

  if (!actions.length) return parsed;

  const out: Array<Record<string, unknown>> = [];

  for (const action of actions) {
    const type = String(action.type ?? '');
    const route = String(action.route ?? asRecord(action.payload).route ?? '');

    if (type === 'navigate' && isAssignSurfaceRoute(route)) {
      if (editor || action.openEditor === true) {
        out.push({
          type: 'navigate',
          route: '/assign-task',
          openEditor: true,
          reason: action.reason ?? 'Opening Assign so you can pick it yourself.',
        });
        continue;
      }
      const fromSpeech = parsed.filter((item) => item.type === 'create_task_draft');
      if (fromSpeech.length) {
        out.push(...fromSpeech.map((item) => enrichTaskDraft(item, utterance, opts)));
        continue;
      }
      out.push(enrichTaskDraft({ type: 'create_task_draft', title: '' }, utterance, opts));
      continue;
    }

    if (type === 'navigate' && isGrocerySurfaceRoute(route)) {
      if (editor || action.openEditor === true) {
        out.push({
          ...action,
          route: route.includes('shopping') ? '/shopping-mode' : '/(tabs)/groceries',
        });
        continue;
      }
      const fromSpeech = parsed.filter(
        (item) => item.type === 'add_grocery' || item.type === 'create_calendar_event'
      );
      if (fromSpeech.length) {
        out.push(...fromSpeech);
        continue;
      }
      const name = extractItemName(utterance);
      if (name) out.push(...enrichGrocery({ type: 'add_grocery', name }, utterance));
      continue;
    }

    if (type === 'create_task' || type === 'create_task_draft' || type === 'assign_task') {
      const groceryRewrite = groceryRewriteFromDraft(action, utterance);
      if (groceryRewrite?.length) {
        out.push(...groceryRewrite);
        continue;
      }
      out.push(enrichTaskDraft(action, utterance, opts));
      continue;
    }

    if (type === 'add_grocery') {
      out.push(...enrichGrocery(action, utterance));
      continue;
    }

    out.push(action);
  }

  if (isCompleteIntent(utterance) && !out.some((item) => item.type === 'complete_task')) {
    const fromSpeech = parsed.filter((item) => item.type === 'complete_task');
    if (fromSpeech.length) return fromSpeech;
  }

  return out.filter((item, index, list) => {
    if (item.type !== 'navigate' || item.openEditor === true) return true;
    const route = String(item.route ?? '');
    const coveredAssign =
      isAssignSurfaceRoute(route) &&
      list.some(
        (row) =>
          row.type === 'create_task_draft' ||
          row.type === 'assign_task' ||
          row.type === 'create_task'
      );
    const coveredGrocery = isGrocerySurfaceRoute(route) && list.some((row) => row.type === 'add_grocery');
    if (coveredAssign || coveredGrocery) return false;
    return true;
  });
}

export function attachIntentActions(
  question: string,
  answer: { ui_actions?: Array<Record<string, unknown>> } & Record<string, unknown>,
  opts?: HouseholdIntentOpts
) {
  const rewritten = rewriteAiuicActions(answer.ui_actions ?? [], question, opts);
  return rewritten.length ? { ...answer, ui_actions: rewritten } : answer;
}
