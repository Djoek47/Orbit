/**
 * Late vs missed display helpers (§5.2).
 * `late` is derived client-side between dueAt and local midnight.
 * `missed` is a persisted transition written by the 00:00 rollover job.
 */

export type OccurrenceClockStatus = 'pending' | 'late' | 'completed' | 'missed';

/** True when now is after dueAt but still on the same local calendar day. */
export function isLateWindow(dueAt: string | undefined, now = new Date()): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime()) || now.getTime() <= due.getTime()) return false;
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

export function completedLateFlag(
  completedAt: string | undefined,
  dueAt: string | undefined
): { completedLate: boolean; latenessMinutes?: number } {
  if (!completedAt || !dueAt) return { completedLate: false };
  const completed = new Date(completedAt).getTime();
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(completed) || Number.isNaN(due) || completed <= due) {
    return { completedLate: false };
  }
  return {
    completedLate: true,
    latenessMinutes: Math.max(1, Math.round((completed - due) / 60_000)),
  };
}
