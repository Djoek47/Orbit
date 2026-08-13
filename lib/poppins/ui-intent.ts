/**
 * Expo Go / text-twin fallback: turn a clear spoken or typed clause into ui_actions.
 * Live Luna/Realtime still win when they already returned ui_actions.
 */

import { formatLocalDate } from '@/lib/streaks/local-date';

export function parseHouseholdIntent(utterance: string): Array<Record<string, unknown>> {
  const text = utterance.trim();
  if (!text) return [];
  const lower = text.toLowerCase();

  if (/\bi('ll| will) do it\b|\bshow me\b|\bfull editor\b|\bopen the (editor|form)\b/.test(lower)) {
    if (/\bevent|calendar|appointment|dentist/.test(lower)) {
      return [{ type: 'navigate', route: '/create-event', reason: 'Opening the editor.' }];
    }
    if (/\bitinerary|trip|route/.test(lower)) {
      return [{ type: 'navigate', route: '/create-itinerary', reason: 'Opening the editor.' }];
    }
    return [{ type: 'navigate', route: '/create-task', reason: 'Opening the editor.' }];
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

  if (/\badd\b/.test(lower) && /\b(milk|eggs|bread|grocery|groceries)\b/.test(lower)) {
    const grocery =
      lower.match(/\badd (?:some )?([a-z][a-z ]{1,24}?)(?: to (?:the )?(?:list|grocer)|$)/)?.[1] ??
      'Milk';
    return [
      {
        type: 'add_grocery',
        name: grocery.replace(/\b(please|thanks)\b/g, '').trim() || 'Milk',
      },
    ];
  }

  if (/\b(add|create|make)\b/.test(lower) && (/\btask\b/.test(lower) || /\bfor\b/.test(lower))) {
    const titled =
      text.match(/\b(?:add|create|make)\s+(?:a |an )?(.+?)\s+task\b/i)?.[1] ??
      text.match(/\b(?:add|create|make)\s+(?:a |an )?(.+?)\s+for\b/i)?.[1] ??
      'New task';
    const assignee = text.match(/\bfor\s+([A-Z][a-z]+)\b/)?.[1];
    const due = /\btomorrow\b/i.test(text)
      ? 'Tomorrow'
      : /\btoday\b/i.test(text)
        ? 'Today'
        : undefined;
    return [
      {
        type: 'create_task_draft',
        title: titled.replace(/\b(a|an|the)\b/gi, '').replace(/\s+/g, ' ').trim() || 'New task',
        assignee,
        due,
      },
    ];
  }

  return [];
}

export function attachIntentActions(
  question: string,
  answer: { ui_actions?: Array<Record<string, unknown>> } & Record<string, unknown>
) {
  if (Array.isArray(answer.ui_actions) && answer.ui_actions.length) return answer;
  const parsed = parseHouseholdIntent(question);
  return parsed.length ? { ...answer, ui_actions: parsed } : answer;
}
