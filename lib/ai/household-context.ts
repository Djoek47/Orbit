import { resolveMajordomoProfileId } from '@/lib/ai/majordomo-profiles';
import { formatMemoryHint, getActiveHouseMemory } from '@/lib/poppins/house-memory';
import type { HouseholdSnapshot, OrbitMetrics, PoppinsRecommendation } from '@/types/orbit';

function isAway(member: { awayFrom?: string; awayTo?: string }, now = new Date()) {
  if (!member.awayFrom || !member.awayTo) return false;
  const t = now.toISOString().slice(0, 10);
  return t >= member.awayFrom && t <= member.awayTo;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function isOverdueTask(task: { status?: string; due?: string }) {
  return (
    task.status === 'Overdue' ||
    task.status === 'overdue' ||
    /overdue|expired/i.test(String(task.due ?? ''))
  );
}

/** Compact desk brief for prompts — situation awareness without dumping the whole house. */
export function buildPoppinsDeskBrief(
  household: HouseholdSnapshot,
  metrics: OrbitMetrics,
  recommendations: PoppinsRecommendation[] = []
) {
  const now = new Date();
  const today = dayKey(now);
  const horizon = dayKey(addDays(now, 2));

  const openTasks = household.tasks.filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled');
  const overdue = openTasks.filter(isOverdueTask);
  const activeMembers = household.members.filter(
    (m) => m.status === 'active' && m.role !== 'guest' && m.role !== 'shared-device'
  );
  const weekXp = activeMembers.map((m) => ({
    name: m.name,
    weekXp: m.weekXp ?? 0,
    loadShare: m.loadShare,
  }));
  const sortedXp = [...weekXp].sort((a, b) => b.weekXp - a.weekXp);
  const top = sortedXp[0];
  const bottom = sortedXp[sortedXp.length - 1];
  const xpGap = top && bottom ? top.weekXp - bottom.weekXp : 0;

  const holidays = household.members
    .filter((m) => isAway(m, now))
    .map((m) => ({ name: m.name, awayFrom: m.awayFrom, awayTo: m.awayTo }));

  const nextEvents = household.events
    .filter((e) => {
      const key = String(e.date ?? '').slice(0, 10);
      return key >= today && key <= horizon;
    })
    .slice(0, 6)
    .map((e) => ({
      title: e.title,
      date: e.date,
      time: e.time,
      responsible: e.responsible,
    }));

  const missingGroceries = household.groceries
    .filter((g) => g.status === 'Missing' || g.status === 'Low')
    .slice(0, 6)
    .map((g) => g.name);

  const pendingPlanProposals = recommendations
    .filter((r) => /plan|trip|itinerary/i.test(`${r.title} ${r.detail}`))
    .slice(0, 3)
    .map((r) => ({ title: r.title, detail: r.detail }));

  return {
    asOf: now.toISOString(),
    momentum: metrics.momentum,
    openTasks: metrics.openTasks ?? openTasks.length,
    overdueCount: overdue.length,
    overdueSample: overdue.slice(0, 5).map((t) => ({
      id: t.id,
      title: t.title,
      assignee: t.assignee,
      due: t.due,
    })),
    xpSkew: {
      gap: xpGap,
      top: top ?? null,
      bottom: bottom ?? null,
      uneven: xpGap >= 40,
    },
    holidays,
    next48hEvents: nextEvents,
    missingGroceries,
    pendingPlanProposals,
  };
}

/** Compact snapshot sent to Poppins edge functions / Monitor Agent. */
export function buildPoppinsHouseholdPayload(
  household: HouseholdSnapshot,
  metrics: OrbitMetrics,
  recommendations: PoppinsRecommendation[] = [],
  options?: {
    majordomoProfileId?: string | null;
    memberProfileId?: string | null;
    memoryHint?: string | null;
  }
) {
  const desk = buildPoppinsDeskBrief(household, metrics, recommendations);
  const majordomoProfileId = resolveMajordomoProfileId({
    householdProfileId: options?.majordomoProfileId ?? household.majordomoProfileId,
    memberProfileId: options?.memberProfileId,
  });
  return {
    householdName: household.householdName,
    greetingName: household.greetingName,
    majordomoProfileId,
    metrics,
    desk,
    memoryHint:
      options?.memoryHint?.trim() || formatMemoryHint(getActiveHouseMemory()) || undefined,
    tasks: household.tasks
      .filter((task) => task.status !== 'Completed')
      .slice(0, 12)
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
    events: household.events.slice(0, 10).map((event) => ({
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
    holidays: desk.holidays,
  };
}
