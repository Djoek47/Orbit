/**
 * Occurrence clock helpers — Revision D §1.3.
 * `expired` replaces `missed`. Late Credit window = after dueAt, before 23:59.
 */

export type OccurrenceClockStatus = 'pending' | 'late' | 'completed' | 'expired';

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

/** Migrate legacy 'missed' → 'expired'. */
export function normalizeOccurrenceStatus(status: string): OccurrenceClockStatus {
  if (status === 'missed') return 'expired';
  if (status === 'pending' || status === 'late' || status === 'completed' || status === 'expired') {
    return status;
  }
  return 'pending';
}
