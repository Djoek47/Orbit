import type { HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

/** Compact snapshot sent to Nova edge functions. */
export function buildNovaHouseholdPayload(household: HouseholdSnapshot, metrics: OrbitMetrics) {
  return {
    householdName: household.householdName,
    greetingName: household.greetingName,
    metrics,
    tasks: household.tasks
      .filter((task) => task.status !== 'Completed')
      .slice(0, 10)
      .map((task) => ({
        title: task.title,
        assignee: task.assignee,
        due: task.due,
        status: task.status,
        category: task.category,
      })),
    groceries: household.groceries
      .filter((item) => item.status === 'Missing')
      .slice(0, 8)
      .map((item) => ({ name: item.name, category: item.category })),
    events: household.events.slice(0, 6).map((event) => ({
      title: event.title,
      date: event.date,
      time: event.time,
      responsible: event.responsible,
    })),
    members: household.members
      .filter((member) => member.status === 'active')
      .map((member) => ({
        name: member.name,
        role: member.role,
        weekXp: member.weekXp ?? 0,
        xp: member.xp,
        streak: member.streak ?? 0,
        loadShare: member.loadShare,
      })),
  };
}
