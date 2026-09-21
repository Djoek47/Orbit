import { nextXpMilestone } from '@/lib/game-levels';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import type { HouseholdMember, HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

export type HealthMetricKind = 'pct' | 'count' | 'streak' | 'trophy';

export type HealthMetricItem = {
  key: string;
  label: string;
  /** 0–100 for progress bars; ignored for count/streak display when valueLabel set. */
  val: number;
  valueLabel: string;
  color: string;
  icon: 'check-circle' | 'balance' | 'local-fire-department' | 'assignment' | 'emoji-events' | 'shopping-cart' | 'cleaning-services';
  kind: HealthMetricKind;
};

export type HomeHealthRole = 'admin' | 'kid';

export function resolveHomeHealthRole(
  member: HouseholdMember | undefined,
  opts?: { isAdmin?: boolean },
): HomeHealthRole {
  if (member?.role === 'child' || isSharedDeviceRole(member?.role ?? 'guest')) {
    return 'kid';
  }
  return 'admin';
}

/** Fairness: how evenly week XP is spread (100 = equal, lower = skewed). */
export function fairnessFromWeekXp(members: HouseholdMember[]): number {
  const active = members.filter(
    (m) => m.status === 'active' && m.role !== 'guest' && !isSharedDeviceRole(m.role),
  );
  if (active.length < 2) return 100;
  const xp = active.map((m) => m.weekXp ?? 0);
  const total = xp.reduce((a, b) => a + b, 0);
  if (total <= 0) return 100;
  const ideal = total / xp.length;
  const variance =
    xp.reduce((sum, v) => sum + Math.abs(v - ideal), 0) / (ideal * xp.length || 1);
  return Math.max(0, Math.min(100, Math.round(100 - variance * 50)));
}

export function householdStreakDays(members: HouseholdMember[]): number {
  const active = members.filter(
    (m) => m.status === 'active' && m.role !== 'guest' && !isSharedDeviceRole(m.role),
  );
  if (!active.length) return 0;
  return Math.max(...active.map((m) => m.streak ?? 0));
}

export function buildHomeHealthMetrics(opts: {
  role: HomeHealthRole;
  metrics: OrbitMetrics;
  household: HouseholdSnapshot;
  currentMember?: HouseholdMember;
}): HealthMetricItem[] {
  const { role, metrics, household, currentMember } = opts;
  const name = currentMember?.name;

  if (role === 'kid') {
    const myOpen = household.tasks.filter(
      (t) =>
        (t.assignee === name || t.assignees?.includes(name ?? '')) &&
        t.status !== 'Completed' &&
        t.status !== 'Cancelled',
    ).length;
    const streak = currentMember?.streak ?? 0;
    const xp = currentMember?.xp ?? 0;
    const next = nextXpMilestone(xp);
    const trophyPct = next
      ? Math.round(Math.min(100, (xp / next.xp) * 100))
      : 100;
    const trophyLabel = next ? `${trophyPct}%` : 'Max';
    return [
      {
        key: 'myTasks',
        label: 'My tasks',
        val: Math.min(100, myOpen === 0 ? 100 : Math.max(8, 100 - myOpen * 15)),
        valueLabel: String(myOpen),
        color: '#34D399',
        icon: 'assignment',
        kind: 'count',
      },
      {
        key: 'myStreak',
        label: 'My streak',
        val: Math.min(100, streak * 10),
        valueLabel: `${streak}d`,
        color: '#FB923C',
        icon: 'local-fire-department',
        kind: 'streak',
      },
      {
        key: 'nextTrophy',
        label: 'Next trophy',
        val: trophyPct,
        valueLabel: trophyLabel,
        color: '#FBBF24',
        icon: 'emoji-events',
        kind: 'trophy',
      },
    ];
  }

  // Household Health shows Completion + Streak only (§7.1 — Fairness removed).
  // Household streak: increments on any day where 100% of that day's due occurrences
  // across all members were completed by their deadlines (§7.2).
  const streak = metrics.householdStreak ?? householdStreakDays(household.members);
  return [
    {
      key: 'completion',
      label: 'Completion',
      val: metrics.taskCompletionRate,
      valueLabel: `${metrics.taskCompletionRate}%`,
      color: '#34D399',
      icon: 'check-circle',
      kind: 'pct',
    },
    {
      key: 'streak',
      label: 'Streak',
      val: Math.min(100, streak * 10),
      valueLabel: `${streak}d`,
      color: '#FB923C',
      icon: 'local-fire-department',
      kind: 'streak',
    },
  ];
}
