/**
 * Expo Go / text-twin fallback: turn a clear spoken or typed clause into ui_actions.
 * Live Luna/Realtime still win when they already returned ui_actions — AIUIC rewrites
 * leftover navigate_coach ("I can open that for you") into the stage.
 */

import { formatLocalDate } from '@/lib/streaks/local-date';
import {
  completeTitleFromUtterance,
  extractItemName,
  isAssignSurfaceRoute,
  isChoreAssignIntent,
  isCompleteIntent,
  isGrocerySurfaceRoute,
  isShoppingIntent,
  matchLibraryIntent,
  parseReleaseDate,
  wantsFullEditor,
} from '@/lib/poppins/catalog-match';

export function parseHouseholdIntent(utterance: string): Array<Record<string, unknown>> {
  const text = utterance.trim();
  if (!text) return [];
  const lower = text.toLowerCase();

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

  if (isCompleteIntent(text)) {
    const title = completeTitleFromUtterance(text);
    return [{ type: 'complete_task', title: title || 'this task' }];
  }

  const itemName = extractItemName(text);
  const shopping = isShoppingIntent(text);
  const groceryAsk =
    (/\badd\b/.test(lower) &&
      /\b(milk|eggs|bread|grocery|groceries|shopping list|to the list)\b/.test(lower)) ||
    shopping;
  if (groceryAsk && itemName && !/\btask\b/.test(itemName) && !isChoreAssignIntent(text)) {
    const releaseDate = parseReleaseDate(text);
    const actions: Array<Record<string, unknown>> = [
      {
        type: 'add_grocery',
        name: itemName.replace(/\b(please|thanks)\b/g, '').trim() || itemName,
        category: shopping ? 'Clothing' : undefined,
        lane: shopping ? 'clothing' : 'grocery',
      },
    ];
    if (releaseDate) {
      actions.push({
        type: 'create_calendar_event',
        title: `${itemName} drop`,
        date: releaseDate,
      });
    }
    return actions;
  }

  const actions: Array<Record<string, unknown>> = [];
  const wantsItineraryStop =
    /\b(store|shop|stop)\b/.test(lower) && /\b(itinerary|trip|route)\b/.test(lower);
  const wantsDentist = /\bdentist\b/.test(lower);
  const wantsAppointment = /\bappointment\b/.test(lower) && /\b(add|create|book)\b/.test(lower);

  if (wantsItineraryStop) {
    actions.push({ type: 'create_itinerary', title: 'Store' });
  }
  if (wantsDentist || (wantsAppointment && !wantsItineraryStop)) {
    actions.push({
      type: 'create_calendar_event',
      title: wantsDentist ? 'Dentist' : 'Appointment',
      date: formatLocalDate(new Date()),
    });
  }
  if (wantsItineraryStop && (wantsDentist || wantsAppointment)) {
    return actions;
  }
  if (actions.length) return actions;

  if (isChoreAssignIntent(text)) {
    const match = matchLibraryIntent(text);
    const titled =
      match.task?.name ??
      text.match(/\b(?:add|create|make)\s+(?:a |an )?(.+?)\s+task\b/i)?.[1] ??
      text.match(/\b(?:add|create|make)\s+(?:a |an )?(.+?)\s+for\b/i)?.[1] ??
      '';
    const due = /\btomorrow\b/i.test(text)
      ? 'Tomorrow'
      : /\btoday\b/i.test(text)
        ? 'Today'
        : undefined;
    return [
      {
        type: 'create_task_draft',
        title: titled.replace(/\b(a|an|the)\b/gi, '').replace(/\s+/g, ' ').trim(),
        assignee: match.assignee ?? text.match(/\bfor\s+([A-Z][a-zA-Z]+)\b/)?.[1],
        due,
        category: match.domainId,
        libraryTaskId: match.task?.id,
        taskQuery: match.task ? undefined : match.taskQuery,
      },
    ];
  }

  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function enrichTaskDraft(
  action: Record<string, unknown>,
  utterance: string
): Record<string, unknown> {
  const match = matchLibraryIntent(utterance);
  const next = { ...action };
  if (match.assignee && !next.assignee) next.assignee = match.assignee;
  if (match.domainId && !next.category) next.category = match.domainId;
  if (match.task && !next.libraryTaskId && !String(next.title ?? '').trim()) {
    next.libraryTaskId = match.task.id;
    next.title = match.task.name;
    next.category = match.task.domainId;
  } else if (match.taskQuery && !next.taskQuery) {
    next.taskQuery = match.taskQuery;
  }
  if (typeof next.title !== 'string') next.title = '';
  return next;
}

function enrichGrocery(
  action: Record<string, unknown>,
  utterance: string
): Array<Record<string, unknown>> {
  const name = String(action.name ?? '').trim() || extractItemName(utterance) || 'Item';
  const shopping = isShoppingIntent(utterance) || action.lane === 'clothing';
  const releaseDate =
    (action.releaseDate ? String(action.releaseDate) : undefined) || parseReleaseDate(utterance);
  const grocery: Record<string, unknown> = {
    ...action,
    type: 'add_grocery',
    name,
    category: shopping ? String(action.category ?? 'Clothing') : action.category,
    lane: shopping ? 'clothing' : action.lane ?? 'grocery',
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
  utterance = ''
): Array<Record<string, unknown>> {
  const parsed = parseHouseholdIntent(utterance);
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
        out.push(...fromSpeech.map((item) => enrichTaskDraft(item, utterance)));
        continue;
      }
      out.push(enrichTaskDraft({ type: 'create_task_draft', title: '' }, utterance));
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

    if (type === 'create_task' || type === 'create_task_draft') {
      out.push(enrichTaskDraft(action, utterance));
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
    const coveredAssign = isAssignSurfaceRoute(route) && list.some((row) => row.type === 'create_task_draft');
    const coveredGrocery = isGrocerySurfaceRoute(route) && list.some((row) => row.type === 'add_grocery');
    if (coveredAssign || coveredGrocery) return false;
    return true;
  });
}

export function attachIntentActions(
  question: string,
  answer: { ui_actions?: Array<Record<string, unknown>> } & Record<string, unknown>
) {
  const rewritten = rewriteAiuicActions(answer.ui_actions ?? [], question);
  return rewritten.length ? { ...answer, ui_actions: rewritten } : answer;
}
