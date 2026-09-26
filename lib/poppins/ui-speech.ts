/**
 * Barge-in / HOLD steer — rewind a beat, do not restart the playlist.
 */

import type { IuiPayload } from '@/lib/poppins/ui-scenes';
import { parseHouseholdIntent } from '@/lib/poppins/ui-intent';
import {
  dueLabelFromUtterance,
  matchLibraryIntent,
  wantsSelfAssignee,
} from '@/lib/poppins/catalog-match';
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

/** The coming weekday — said on that very day it means today, same as parseWhen. */
export function nextDateForWeekday(name: string, now = new Date()): string {
  const target = WEEKDAYS.indexOf(name as (typeof WEEKDAYS)[number]);
  const d = new Date(now);
  const diff = (target + 7 - d.getDay()) % 7;
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
  } else if (/\btoday\b/.test(lower)) {
    patch.due = 'Today';
  } else if (/\bthis week\b/.test(lower)) {
    patch.due = 'This week';
  }
  const lib = matchLibraryIntent(text, names);
  if (lib.domainId) {
    patch.category = lib.domainId;
    patch.selectedChipId = lib.domainId;
  }
  return patch;
}

export function interpretStageSpeech(
  text: string,
  ctx: { memberNames?: string[]; live?: boolean; frozen?: boolean; selfName?: string } = {}
): SpeechSteer {
  const lower = text.toLowerCase().trim();
  if (!lower) return { kind: 'none' };

  if (/\b(wait|hold on|pause|freeze)\b/.test(lower)) return { kind: 'freeze' };

  // "No, Mia" / "actually tomorrow" is a correction, not a veto — when the rest steers.
  if (ctx.live && /^(?:no|nope|actually|sorry|oops)[,.!\s]+\S/.test(lower)) {
    const inner = interpretStageSpeech(text.replace(/^(?:no|nope|actually|sorry|oops)[,.!\s]+/i, ''), ctx);
    if (inner.kind === 'revise' || inner.kind === 'splice') return inner;
  }

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

  // WO11 §2.6 — mid-chain "and bananas" / "plus milk" / "also walk the dog" appends, never
  // resets. The sentence is parsed as said first ("walk the dog for Mia" is a task); only a
  // bare item with no verb of its own ("bananas") is read as "add bananas". Rewriting every
  // "and" to "add" titled tasks "Add Walk the Dog".
  const splice = (rest: string): Array<Record<string, unknown>> => {
    const intentOpts = { memberNames: ctx.memberNames, selfName: ctx.selfName };
    const asSaid = rest.trim() ? parseHouseholdIntent(rest, intentOpts) : [];
    if (asSaid.length) return asSaid;
    return rest.trim() ? parseHouseholdIntent(`add ${rest.trim()}`, intentOpts) : [];
  };

  if (/\balso\b/.test(lower) && ctx.live) {
    const extra = splice(text.replace(/\balso\b[,\s]*/i, ' ').trim());
    if (extra.length) return { kind: 'splice', actions: extra };
  }

  if (ctx.live && /^(and|plus|as well as)\b/.test(lower)) {
    const extra = splice(text.replace(/^(and|plus|as well as)\b[,\s]*/i, ''));
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

  const lib = matchLibraryIntent(text, names, ctx.selfName);
  const patch: Partial<IuiPayload> = {};
  if (ctx.selfName && wantsSelfAssignee(lower)) {
    patch.assignee = ctx.selfName;
    patch.spokenName = ctx.selfName;
  } else if (lib.assignee) {
    patch.assignee = lib.assignee;
    patch.spokenName = lib.assignee;
  }
  if (ctx.live && lib.domainId) {
    patch.category = lib.domainId;
    patch.selectedChipId = lib.domainId;
    if (lib.task) {
      patch.libraryTaskId = lib.task.id;
      patch.title = lib.task.name;
    } else if (lib.taskQuery) {
      patch.taskQuery = lib.taskQuery;
      patch.title = '';
      patch.libraryTaskId = undefined;
    }
  }
  const due = dueLabelFromUtterance(text);
  if (due && ctx.live) {
    patch.due = due;
    if (due === 'Tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      patch.date = formatLocalDate(d);
      patch.dayNumber = d.getDate();
    }
  }
  const weekday = WEEKDAYS.find((day) => lower.includes(day));
  if (weekday && (/\bnot\b/.test(lower) || ctx.live) && !due) {
    patch.due = capitalize(weekday);
    patch.date = nextDateForWeekday(weekday);
  }

  if (ctx.live && /\b(this is the task|that one|this one|that task)\b/.test(lower)) {
    if (lib.task) {
      return {
        kind: 'revise',
        patch: {
          ...patch,
          libraryTaskId: lib.task.id,
          title: lib.task.name,
          category: lib.task.domainId,
        },
      };
    }
    if (!Object.keys(patch).length) return { kind: 'confirm' };
  }

  if (Object.keys(patch).length) return { kind: 'revise', patch };

  return { kind: 'none' };
}
