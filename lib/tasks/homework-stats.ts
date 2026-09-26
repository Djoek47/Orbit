/**
 * Homework numbers for the homework board — pure, so they're tested, not eyeballed.
 *
 * "This week" is Monday → Sunday in local time. A homework belongs to the day it's due
 * (its occurrence date). Reading is counted from Reading-subject homework, plus minutes
 * and pages when the assignment names them ("Read for 20 minutes", "Read pages 10 to 20").
 */
import { resolveOccurrenceDate } from '@/lib/tasks/due-label';
import { isHomeworkCategory, resolveHomeworkSubject } from '@/lib/tasks/homework-subject';
import { formatLocalDate } from '@/lib/streaks/local-date';
import type { HouseholdTask } from '@/types/orbit';

export type SubjectStat = { subject: string; done: number; total: number };
export type ChildStat = { name: string; done: number; total: number; dueToday: number };

export type HomeworkStats = {
  week: { assigned: number; done: number; onTime: number; late: number };
  /** 0..1, or null when nothing finished this week yet. */
  onTimeRate: number | null;
  dueToday: number;
  overdue: number;
  bySubject: SubjectStat[];
  byChild: ChildStat[];
  reading: {
    /** Reading homework finished this week. */
    sessions: number;
    minutes: number;
    pages: number;
    /** Days in a row, ending today or yesterday, with reading homework finished. */
    streak: number;
    /** Monday → Sunday of this week: was reading finished that day? */
    days: boolean[];
  };
};

const DONE = new Set(['Completed']);
const CLOSED = new Set(['Completed', 'Cancelled', 'Expired', 'Missed']);

function isReading(task: HouseholdTask): boolean {
  const subject = (resolveHomeworkSubject(task) ?? '').toLowerCase();
  return subject === 'reading' || /\bread(ing)?\b|\bchapter\b|\bbook report\b/i.test(task.title);
}

/** "Read for 20 minutes" → 20; "30 min reading" → 30. */
export function minutesIn(title: string): number {
  const m = title.match(/(\d{1,3})\s*(?:minutes?|mins?)\b/i);
  return m ? Number(m[1]) : 0;
}

/** "pages 10 to 20" / "pages 10-20" → 11; "read 15 pages" → 15. */
export function pagesIn(title: string): number {
  const range = title.match(/\bpages?\s+(\d{1,4})\s*(?:-|–|to|through)\s*(\d{1,4})\b/i);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return b >= a ? b - a + 1 : 0;
  }
  const count = title.match(/\b(\d{1,4})\s+pages?\b/i);
  return count ? Number(count[1]) : 0;
}

function mondayOf(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function homeworkStats(tasks: HouseholdTask[], now = new Date()): HomeworkStats {
  const homework = tasks.filter(
    (task) => isHomeworkCategory(task.category, task.title) && task.status !== 'Cancelled'
  );
  const today = formatLocalDate(now);
  const weekStart = formatLocalDate(mondayOf(now));
  const weekEnd = formatLocalDate(addDays(mondayOf(now), 6));
  const inWeek = (task: HouseholdTask) => {
    const day = resolveOccurrenceDate(task, now);
    return Boolean(day && day >= weekStart && day <= weekEnd);
  };

  const week = homework.filter(inWeek);
  const done = week.filter((task) => DONE.has(task.status));
  const late = done.filter((task) => task.completedLate === true).length;

  const subjects = new Map<string, SubjectStat>();
  const children = new Map<string, ChildStat>();
  for (const task of week) {
    const subject = resolveHomeworkSubject(task) ?? 'Homework';
    const s = subjects.get(subject) ?? { subject, done: 0, total: 0 };
    s.total += 1;
    if (DONE.has(task.status)) s.done += 1;
    subjects.set(subject, s);

    const names = (task.assignees?.length ? task.assignees : [task.assignee]).filter(Boolean) as string[];
    for (const name of names) {
      const c = children.get(name) ?? { name, done: 0, total: 0, dueToday: 0 };
      c.total += 1;
      const share = task.shares?.find((item) => item.name === name);
      if (share ? share.status === 'Completed' : DONE.has(task.status)) c.done += 1;
      if (!CLOSED.has(task.status) && resolveOccurrenceDate(task, now) === today) c.dueToday += 1;
      children.set(name, c);
    }
  }

  const open = homework.filter((task) => !CLOSED.has(task.status));
  const dueToday = open.filter((task) => resolveOccurrenceDate(task, now) === today).length;
  const overdue = open.filter((task) => {
    const day = resolveOccurrenceDate(task, now);
    return Boolean(day && day < today);
  }).length;

  // Reading.
  const readingDone = homework.filter((task) => DONE.has(task.status) && isReading(task));
  const readingWeek = readingDone.filter(inWeek);
  const readDays = new Set(
    readingDone
      .map((task) => (task.completedAt ? formatLocalDate(new Date(task.completedAt)) : resolveOccurrenceDate(task, now)))
      .filter((day): day is string => Boolean(day))
  );
  let streak = 0;
  // A streak still counts if today's reading isn't done yet.
  let cursor = readDays.has(today) ? now : addDays(now, -1);
  while (readDays.has(formatLocalDate(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    week: { assigned: week.length, done: done.length, onTime: done.length - late, late },
    onTimeRate: done.length ? (done.length - late) / done.length : null,
    dueToday,
    overdue,
    bySubject: [...subjects.values()].sort((a, b) => b.total - a.total || a.subject.localeCompare(b.subject)),
    byChild: [...children.values()].sort((a, b) => a.name.localeCompare(b.name)),
    reading: {
      sessions: readingWeek.length,
      minutes: readingWeek.reduce((sum, task) => sum + minutesIn(task.title), 0),
      pages: readingWeek.reduce((sum, task) => sum + pagesIn(task.title), 0),
      streak,
      days: Array.from({ length: 7 }, (_, i) => readDays.has(formatLocalDate(addDays(mondayOf(now), i)))),
    },
  };
}
