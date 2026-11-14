import { eventDateKey, householdCategoryToMakeType } from '@/lib/calendar/make-calendar';
import { isHomeworkTask, taskDueDateKey } from '@/lib/calendar/event-date';
import { resolveHomeworkSubject } from '@/lib/tasks/homework-subject';
import type { HouseholdEvent, HouseholdTask } from '@/types/orbit';

export type PlanItemKind = 'event' | 'homework' | 'grocery' | 'itinerary';

export type PlanItem = {
  id: string;
  kind: PlanItemKind;
  title: string;
  dateKey: string | null;
  time?: string;
  responsible?: string;
  homeworkSubject?: string;
  href: string;
  /** Underlying calendar category when kind === event */
  category?: HouseholdEvent['category'];
  approvalStatus?: HouseholdEvent['approvalStatus'];
};

function isHomeworkEvent(event: HouseholdEvent): boolean {
  return event.category === 'School';
}

/** Chore-style calendar rows (Routine) stay off Plan — homework tasks/events remain. */
export function calendarEventsForPlan(events: HouseholdEvent[]): HouseholdEvent[] {
  return events.filter((event) => event.category !== 'Routine');
}

export function homeworkTasksForPlan(tasks: HouseholdTask[], reference = new Date()): PlanItem[] {
  return tasks
    .filter((task) => task.status !== 'Completed' && isHomeworkTask(task))
    .map((task) => ({
      id: task.id,
      kind: 'homework' as const,
      title: task.title,
      dateKey: taskDueDateKey(task, reference),
      time: task.due,
      responsible: task.assignee,
      homeworkSubject: resolveHomeworkSubject(task) ?? undefined,
      href: `/task/${task.id}`,
    }))
    .filter((item) => Boolean(item.dateKey));
}

export function eventsToPlanItems(events: HouseholdEvent[], reference = new Date()): PlanItem[] {
  return calendarEventsForPlan(events).map((event) => ({
    id: event.id,
    kind: isHomeworkEvent(event) ? 'homework' : 'event',
    title: event.title,
    dateKey: eventDateKey(event, reference),
    time: event.time,
    responsible: event.responsible,
    href: `/event/${event.id}`,
    category: event.category,
    approvalStatus: event.approvalStatus,
  }));
}

export function buildPlanItems(
  events: HouseholdEvent[],
  tasks: HouseholdTask[],
  reference = new Date()
): PlanItem[] {
  return [...eventsToPlanItems(events, reference), ...homeworkTasksForPlan(tasks, reference)];
}

export function groupPlanItemsByDate(items: PlanItem[]): Record<string, PlanItem[]> {
  const map: Record<string, PlanItem[]> = {};
  for (const item of items) {
    if (!item.dateKey) continue;
    if (!map[item.dateKey]) map[item.dateKey] = [];
    map[item.dateKey].push(item);
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  }
  return map;
}

export function planItemTypeLabel(item: PlanItem): string {
  if (item.kind === 'homework') return 'Homework';
  if (item.category) {
    return householdCategoryToMakeType(item.category) === 'homework' ? 'Homework' : 'Event';
  }
  return 'Event';
}
