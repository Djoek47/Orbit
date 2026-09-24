/**
 * Local confirmation lines when Quiet/typed already staged a write beat (WO10 A4).
 * Prefer these over calling poppins-chat — and over "I could not answer".
 */

import type { IuiBeat, IuiWriteKind } from '@/lib/poppins/ui-scenes';

const LOCAL_WRITE_KINDS = new Set<IuiWriteKind>([
  'add_grocery',
  'create_task',
  'create_homework',
  'complete_task',
  'create_event',
  'upsert_place',
  'grant_allowance',
  'clear_grocery',
  'create_itinerary_stop',
  'advance_itinerary',
  'claim_reward',
]);

/**
 * A beat that represents a real write — never a question (`commit: 'none'`).
 * WO16 §2.1 — commit:'none' grocery_add is a prompt, not a write.
 */
export function isLocalWriteBeat(beat: IuiBeat | null | undefined): boolean {
  if (!beat) return false;
  if (beat.commit === 'none') return false;
  const write = beat.payload.write ?? 'none';
  if (LOCAL_WRITE_KINDS.has(write)) return true;
  if (beat.scene === 'grocery_add') return true;
  if (beat.scene === 'task_compose' || beat.scene === 'homework_compose') return true;
  if (beat.scene === 'task_done') return true;
  if (beat.scene === 'calendar_zoom') return true;
  if (beat.scene === 'place_save') return true;
  if (beat.scene === 'allowance_act') return true;
  if (beat.scene === 'itinerary_stage') return true;
  if (beat.scene === 'confirm' && write !== 'none') return true;
  return false;
}

/** True when the beat can settle without more slots (WO16 §2.4 contract). */
export function isCommittableLocalWrite(beat: IuiBeat | null | undefined): boolean {
  if (!isLocalWriteBeat(beat)) return false;
  const b = beat!;
  if (b.payload.composeReady === false) return false;
  if (b.payload.provisional === true) return false;
  if (b.payload.narrow === true && !b.payload.selectedChipId) return false;
  const write = b.payload.write ?? 'none';
  if (write === 'add_grocery' || b.scene === 'grocery_add') {
    const name =
      b.payload.groceryName?.trim() ||
      b.payload.title?.trim() ||
      b.payload.items?.find((item) => !item.dropped && item.label.trim())?.label;
    if (!name) return false;
  }
  return true;
}

/** First write-capable beat in the current playlist (or current index). */
export function findLocalWriteBeat(playlist: IuiBeat[], index = 0): IuiBeat | null {
  const current = playlist[index];
  if (isLocalWriteBeat(current)) return current!;
  return playlist.find((beat) => isLocalWriteBeat(beat)) ?? null;
}

export function findCommittableLocalWriteBeat(playlist: IuiBeat[], index = 0): IuiBeat | null {
  const current = playlist[index];
  if (isCommittableLocalWrite(current)) return current!;
  return playlist.find((beat) => isCommittableLocalWrite(beat)) ?? null;
}

export function confirmationForLocalWrite(beat: IuiBeat): string {
  const write = beat.payload.write ?? 'none';
  const grocery =
    beat.payload.groceryName?.trim() ||
    (write === 'add_grocery' || beat.scene === 'grocery_add'
      ? beat.payload.title?.trim()
      : undefined);
  if (write === 'clear_grocery') {
    return 'Cleared the grocery list.';
  }
  if (write === 'create_itinerary_stop') {
    const title = beat.payload.itineraryTitle?.trim() || beat.payload.title?.trim() || 'the trip';
    return `Added a stop to ${title}.`;
  }
  if (write === 'advance_itinerary') {
    return 'Advanced to the next stop.';
  }
  if (write === 'claim_reward') {
    const name = beat.payload.rewardName?.trim() || beat.payload.title?.trim() || 'that reward';
    return `Claimed ${name}.`;
  }
  if (write === 'add_grocery' || beat.scene === 'grocery_add') {
    const name = grocery || 'that';
    const lane = beat.payload.shoppingLane === 'clothing' ? 'Clothing' : 'Groceries';
    return `Added ${name} to ${lane}.`;
  }
  if (write === 'complete_task' || beat.scene === 'task_done') {
    const title = beat.payload.title?.trim() || 'that task';
    return `Marked ${title} done.`;
  }
  if (write === 'create_event' || beat.scene === 'calendar_zoom') {
    const title = beat.payload.title?.trim() || 'that event';
    const when = [beat.payload.date, beat.payload.time].filter(Boolean).join(' ');
    return when ? `Scheduled ${title} for ${when}.` : `Scheduled ${title}.`;
  }
  if (write === 'upsert_place' || beat.scene === 'place_save') {
    const name = beat.payload.placeName?.trim() || beat.payload.title?.trim() || 'that place';
    return `Saved ${name}.`;
  }
  if (write === 'grant_allowance' || beat.scene === 'allowance_act') {
    const amount = beat.payload.allowanceAmountLabel?.trim() || 'allowance';
    const who = beat.payload.allowanceMemberName?.trim() || 'them';
    return `Granted ${amount} to ${who}.`;
  }
  // create_task / create_homework / task_compose
  const title = beat.payload.title?.trim() || 'that task';
  const who = beat.payload.assignee?.trim();
  const due = beat.payload.due?.trim();
  if (who && due) return `Assigned ${title} to ${who} for ${due}.`;
  if (who) return `Assigned ${title} to ${who}.`;
  if (due) return `Staged ${title} for ${due}.`;
  return `Staged ${title}.`;
}
