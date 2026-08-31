import { isHomeworkTask } from '@/lib/calendar/event-date';
import { taskMatchesAssignee } from '@/lib/tasks/split-assign';
import type { HouseholdEvent, HouseholdMember, HouseholdRole, HouseholdTask } from '@/types/orbit';

function isAdminCalendarRole(role: HouseholdRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

/** Non-admin members see a focused calendar — not the full household picture. */
export function usesFocusedCalendar(role: HouseholdRole | null | undefined): boolean {
  return !isAdminCalendarRole(role);
}

export function eventVisibleToMember(event: HouseholdEvent, member: HouseholdMember | null | undefined): boolean {
  if (!member) return true;
  if (isAdminCalendarRole(member.role)) return true;

  if (event.householdWide) return true;

  const memberId = member.id;
  const memberName = member.name.trim().toLowerCase();

  if (event.attendeeMemberIds?.includes(memberId)) return true;
  if (event.responsibleMemberId === memberId) return true;

  const responsible = event.responsible.trim().toLowerCase();
  if (responsible && (responsible === memberName || event.responsible.includes(member.name))) {
    return true;
  }

  return false;
}

export function taskVisibleToMember(task: HouseholdTask, member: HouseholdMember | null | undefined): boolean {
  if (!member) return true;
  if (isAdminCalendarRole(member.role)) return true;
  return taskMatchesAssignee(task, member.name);
}

export function visibleEventsForMember(events: HouseholdEvent[], member: HouseholdMember | null | undefined) {
  if (!member || !usesFocusedCalendar(member.role)) return events;
  return events.filter((event) => eventVisibleToMember(event, member));
}

export function visibleTasksForMember(tasks: HouseholdTask[], member: HouseholdMember | null | undefined) {
  if (!member || !usesFocusedCalendar(member.role)) return tasks;
  return tasks.filter((task) => taskVisibleToMember(task, member));
}

export function nextEventForMember(events: HouseholdEvent[], member: HouseholdMember | null | undefined) {
  const scoped = visibleEventsForMember(events, member);
  return scoped[0] ?? null;
}

export function homeworkTasksForMember(tasks: HouseholdTask[], member: HouseholdMember | null | undefined) {
  return visibleTasksForMember(tasks, member).filter((task) => isHomeworkTask(task));
}
