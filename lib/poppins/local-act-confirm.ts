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
]);

export function isLocalWriteBeat(beat: IuiBeat | null | undefined): boolean {
  if (!beat) return false;
  const write = beat.payload.write ?? 'none';
  if (LOCAL_WRITE_KINDS.has(write)) return true;
  if (beat.scene === 'grocery_add') return true;
  if (beat.scene === 'task_compose' || beat.scene === 'homework_compose') return true;
  if (beat.scene === 'task_done') return true;
  if (beat.scene === 'calendar_zoom') return true;
  return false;
}

/** First write-capable beat in the current playlist (or current index). */
export function findLocalWriteBeat(playlist: IuiBeat[], index = 0): IuiBeat | null {
  const current = playlist[index];
  if (isLocalWriteBeat(current)) return current!;
  return playlist.find((beat) => isLocalWriteBeat(beat)) ?? null;
}

export function confirmationForLocalWrite(beat: IuiBeat): string {
  const write = beat.payload.write ?? 'none';
  const grocery =
    beat.payload.groceryName?.trim() ||
    (write === 'add_grocery' || beat.scene === 'grocery_add'
      ? beat.payload.title?.trim()
      : undefined);
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
  // create_task / create_homework / task_compose
  const title = beat.payload.title?.trim() || 'that task';
  const who = beat.payload.assignee?.trim();
  const due = beat.payload.due?.trim();
  if (who && due) return `Assigned ${title} to ${who} for ${due}.`;
  if (who) return `Assigned ${title} to ${who}.`;
  if (due) return `Staged ${title} for ${due}.`;
  return `Staged ${title}.`;
}
