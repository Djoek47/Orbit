import type { HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

function isAway(member: { awayFrom?: string; awayTo?: string }, now = new Date()) {
  if (!member.awayFrom || !member.awayTo) return false;
  const t = now.toISOString().slice(0, 10);
  return t >= member.awayFrom && t <= member.awayTo;
}

/** Compact snapshot sent to Nova edge functions / Monitor Agent. */
export function buildNovaHouseholdPayload(household: HouseholdSnapshot, metrics: OrbitMetrics) {
  return {
    householdName: household.householdName,
    greetingName: household.greetingName,
    metrics,
    tasks: household.tasks
      .filter((task) => task.status !== 'Completed')
      .slice(0, 10)
      .map((task) => ({
        id: task.id,
        title: task.title,
        assignee: task.assignee,
        due: task.due,
        status: task.status,
        category: task.category,
        xp: task.xp,
      })),
    groceries: household.groceries
      .filter((item) => item.status === 'Missing' || item.status === 'Low')
      .slice(0, 8)
      .map((item) => ({ name: item.name, category: item.category, status: item.status })),
    events: household.events.slice(0, 8).map((event) => ({
      title: event.title,
      date: event.date,
      time: event.time,
      responsible: event.responsible,
      category: event.category,
    })),
    members: household.members
      .filter((member) => member.status === 'active')
      .map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role,
        weekXp: member.weekXp ?? 0,
        xp: member.xp,
        streak: member.streak ?? 0,
        loadShare: member.loadShare,
        away: isAway(member),
        awayFrom: member.awayFrom,
        awayTo: member.awayTo,
      })),
    holidays: household.members
      .filter((member) => isAway(member))
      .map((member) => ({
        name: member.name,
        awayFrom: member.awayFrom,
        awayTo: member.awayTo,
      })),
  };
}
