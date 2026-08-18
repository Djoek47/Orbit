/**
 * Barge-in / HOLD steer — rewind a beat, do not restart the playlist.
 */

import type { IuiPayload } from '@/lib/poppins/ui-scenes';
import { parseHouseholdIntent } from '@/lib/poppins/ui-intent';
import { matchLibraryIntent } from '@/lib/poppins/catalog-match';
import { formatLocalDate } from '@/lib/streaks/local-date';

export type SpeechSteer =
  | { kind: 'freeze' }
  | { kind: 'unfreeze' }
  | { kind: 'veto' }
  | { kind: 'confirm' }
  | { kind: 'revise'; patch: Partial<IuiPayload> }
  | { kind: 'splice'; actions: Array<Record<string, unknown>> }
  | { kind: 'none' };

export const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function nextDateForWeekday(name: string): string {
  const target = WEEKDAYS.indexOf(name as (typeof WEEKDAYS)[number]);
  const d = new Date();
  const diff = (target + 7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return formatLocalDate(d);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Assistant-delta lip-sync: names, weekdays, title catch-up. Does not restart HOLD. */
export function matchSpokenTokens(
  text: string,
  ctx: { memberNames?: string[]; title?: string } = {}
): Partial<IuiPayload> {
  const patch: Partial<IuiPayload> = {};
  if (!text.trim()) return patch;
  const names = (ctx.memberNames ?? []).filter(Boolean);
  const spokenName = names.find((name) =>
    new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(text)
  );
  if (spokenName) {
    patch.assignee = spokenName;
    patch.spokenName = spokenName;
  }
  const lower = text.toLowerCase();
  const weekday = WEEKDAYS.find((day) => lower.includes(day));
  if (weekday) {
    patch.due = capitalize(weekday);
    patch.date = nextDateForWeekday(weekday);
    const d = new Date(patch.date);
    patch.dayNumber = d.getDate();
    patch.monthLabel = d.toLocaleString('en', { month: 'long' });
  }
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    patch.due = 'Tomorrow';
    patch.date = formatLocalDate(d);
    patch.dayNumber = d.getDate();
  }
  return patch;
}

export function interpretStageSpeech(
  text: string,
  ctx: { memberNames?: string[]; live?: boolean; frozen?: boolean } = {}
): SpeechSteer {
  const lower = text.toLowerCase().trim();
  if (!lower) return { kind: 'none' };

  if (/\b(wait|hold on|pause|freeze)\b/.test(lower)) return { kind: 'freeze' };

  if (
    /^(no|nope|veto)\b/.test(lower) ||
    /\b(cancel|never mind|nevermind|stop that|don't|do not)\b/.test(lower)
  ) {
    return { kind: 'veto' };
  }

  if (ctx.frozen && /^(go|continue|keep going|unfreeze)\b/.test(lower)) {
    return { kind: 'unfreeze' };
  }

  if (/^(yes|yeah|yep|yup|ok|okay|go|go ahead|do it|confirm|please)\b/.test(lower)) {
    return { kind: 'confirm' };
  }

  if (/\balso\b/.test(lower) && ctx.live) {
    const extra = parseHouseholdIntent(text.replace(/\balso\b/i, 'add'));
    if (extra.length) return { kind: 'splice', actions: extra };
  }

  const names = (ctx.memberNames ?? []).filter(Boolean);
  const rejected = lower.match(/\bnot\s+([a-z]+)\b/)?.[1];
  if (rejected && names.length) {
    const picked = names.find(
      (name) => name.toLowerCase() !== rejected && lower.includes(name.toLowerCase())
    );
    if (picked) return { kind: 'revise', patch: { assignee: picked, spokenName: picked } };
  }

  const bare = names.find((name) => lower === name.toLowerCase());
  if (bare) return { kind: 'revise', patch: { assignee: bare, spokenName: bare } };

  const weekday = WEEKDAYS.find((day) => lower.includes(day));
  if (weekday && (/\bnot\b/.test(lower) || ctx.live)) {
    return {
      kind: 'revise',
      patch: { due: capitalize(weekday), date: nextDateForWeekday(weekday) },
    };
  }

  if (/\btomorrow\b/.test(lower) && ctx.live) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return { kind: 'revise', patch: { due: 'Tomorrow', date: d.toISOString().slice(0, 10) } };
  }

  const lib = matchLibraryIntent(text, names);
  if (ctx.live && lib.domainId) {
    const patch: Partial<IuiPayload> = {
      category: lib.domainId,
      selectedChipId: lib.domainId,
    };
    if (lib.assignee) {
      patch.assignee = lib.assignee;
      patch.spokenName = lib.assignee;
    }
    if (lib.task) {
      patch.libraryTaskId = lib.task.id;
      patch.title = lib.task.name;
    } else if (lib.taskQuery) {
      patch.taskQuery = lib.taskQuery;
      patch.title = '';
      patch.libraryTaskId = undefined;
    }
    return { kind: 'revise', patch };
  }

  if (ctx.live && /\b(this is the task|that one|this one|that task)\b/.test(lower)) {
    if (lib.task) {
      return {
        kind: 'revise',
        patch: {
          libraryTaskId: lib.task.id,
          title: lib.task.name,
          category: lib.task.domainId,
        },
      };
    }
    return { kind: 'confirm' };
  }

  return { kind: 'none' };
}
