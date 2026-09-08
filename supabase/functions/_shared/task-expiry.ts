/**
 * Server-side task expiry for Sidekick sync (service role).
 * Mirrors lib/tasks/expire-at-boundary.ts — keep logic aligned.
 */

const OPEN = new Set(['pending', 'in_progress', 'overdue']);
const EXPIRED = new Set(['expired', 'missed']);
const DEFAULT_EXPIRY_HM = '23:59';

export type DbTaskRow = {
  id: string;
  status: string;
  assignee_name: string;
  due_label: string;
  due_at?: string | null;
  occurrence_date?: string | null;
  expired_at?: string | null;
};

export type DbMemberRow = {
  id: string;
  display_name?: string | null;
};

export type DbRecessRow = {
  member_id: string;
  start_date: string;
  end_date?: string | null;
};

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalHm(hm: string): { hours: number; minutes: number } {
  const [h, m] = hm.split(':').map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

function expiryInstantLocal(dateKey: string, expiryHm: string): Date {
  const { hours, minutes } = parseLocalHm(expiryHm);
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hours, minutes, 59, 999);
}

function resolveOccurrenceDate(task: DbTaskRow, now: Date): string | null {
  if (task.occurrence_date?.trim()) return task.occurrence_date.trim();
  if (task.due_at?.trim()) {
    const due = new Date(task.due_at);
    if (!Number.isNaN(due.getTime())) return formatLocalDate(due);
  }
  if (/tomorrow/i.test(task.due_label)) {
    const d = new Date(now);
    d.setDate(now.getDate() + 1);
    return formatLocalDate(d);
  }
  if (/today/i.test(task.due_label)) return formatLocalDate(now);
  if (/yesterday/i.test(task.due_label)) {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return formatLocalDate(y);
  }
  return null;
}

function isOnRecess(
  periods: DbRecessRow[],
  memberId: string,
  localDate: string
): boolean {
  return periods.some(
    (p) =>
      p.member_id === memberId &&
      localDate >= p.start_date &&
      (p.end_date == null || localDate <= p.end_date)
  );
}

function memberNameToId(members: DbMemberRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const member of members) {
    const name = member.display_name?.trim();
    if (name) map.set(name, member.id);
  }
  return map;
}

/** Returns task rows that should be persisted as expired. */
export function expireOpenDbTasksAtBoundary(
  tasks: DbTaskRow[],
  now: Date,
  input: {
    expiryHm?: string;
    members: DbMemberRow[];
    recessPeriods: DbRecessRow[];
  }
): { expired: DbTaskRow[]; expiredAt: string } {
  const expiryHm = input.expiryHm ?? DEFAULT_EXPIRY_HM;
  const expiredAt = now.toISOString();
  const nameToId = memberNameToId(input.members);
  const todayKey = formatLocalDate(now);
  const expired: DbTaskRow[] = [];

  for (const task of tasks) {
    const status = task.status.toLowerCase();
    if (!OPEN.has(status) || EXPIRED.has(status)) continue;

    const dateKey = resolveOccurrenceDate(task, now);
    if (!dateKey || dateKey > todayKey) continue;
    if (now.getTime() <= expiryInstantLocal(dateKey, expiryHm).getTime()) continue;

    const assigneeName = task.assignee_name?.trim();
    if (assigneeName) {
      const memberId = nameToId.get(assigneeName);
      if (memberId && isOnRecess(input.recessPeriods, memberId, dateKey)) {
        continue;
      }
    }

    expired.push({
      ...task,
      status: 'expired',
      expired_at: task.expired_at ?? expiredAt,
    });
  }

  return { expired, expiredAt };
}
