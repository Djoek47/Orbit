/**
 * Pull latest household domains for Sidekick devices via edge function (no JWT).
 */

import { dataMode } from '@/config/data-mode';
import { mapEventRow, mapGroceryRow, mapMemberRow, mapRewardRow, mapTaskRow } from '@/lib/mappers/orbit-mappers';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { HouseholdSnapshot, NotificationItem } from '@/types/orbit';

export type SidekickSyncResult = {
  householdId: string;
  householdName: string;
  member: ReturnType<typeof mapMemberRow>;
  members: ReturnType<typeof mapMemberRow>[];
  tasks: ReturnType<typeof mapTaskRow>[];
  events: ReturnType<typeof mapEventRow>[];
  notifications: NotificationItem[];
  rewards: ReturnType<typeof mapRewardRow>[];
  groceries: ReturnType<typeof mapGroceryRow>[];
  householdPatch: Partial<HouseholdSnapshot>;
};

function mapNotificationRow(row: {
  id: string;
  household_id: string;
  title: string;
  body: string;
  category: NotificationItem['category'];
  priority: NotificationItem['priority'];
  is_read: boolean;
  created_at: string;
  data: unknown;
}): NotificationItem {
  return {
    id: row.id,
    householdId: row.household_id,
    title: row.title,
    body: row.body,
    category: row.category,
    priority: row.priority,
    isRead: row.is_read,
    createdAt: row.created_at,
    data:
      row.data && typeof row.data === 'object' && !Array.isArray(row.data)
        ? (row.data as Record<string, unknown>)
        : undefined,
  };
}

/** Fetch tasks + notifications for a profile invite code (Supabase production path). */
export async function fetchSidekickSync(profileInviteCode: string): Promise<SidekickSyncResult | null> {
  if (dataMode !== 'supabase') {
    return null;
  }
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.functions.invoke('sidekick-sync', {
    body: { code: profileInviteCode },
  });
  if (error || !data || typeof data !== 'object') {
    console.warn('fetchSidekickSync', error?.message ?? 'empty payload');
    return null;
  }

  const payload = data as {
    error?: string;
    member?: Parameters<typeof mapMemberRow>[0];
    household?: {
      id?: string;
      name?: string;
      daily_deadline?: string | null;
      reward_model?: string | null;
      sidekick_grocery_add?: boolean | null;
      join_approval_required?: boolean | null;
    };
    members?: Parameters<typeof mapMemberRow>[0][];
    tasks?: Parameters<typeof mapTaskRow>[0][];
    calendarEvents?: Parameters<typeof mapEventRow>[0][];
    notifications?: Parameters<typeof mapNotificationRow>[0][];
    rewards?: Parameters<typeof mapRewardRow>[0][];
    groceries?: Parameters<typeof mapGroceryRow>[0][];
  };

  if (payload.error || !payload.member || !payload.household?.id) {
    return null;
  }

  const member = mapMemberRow(payload.member);
  const members = (payload.members ?? []).map((row) => mapMemberRow(row));
  const tasks = (payload.tasks ?? []).map((row) => mapTaskRow(row));
  const events = (payload.calendarEvents ?? []).map((row) => mapEventRow(row));
  const notifications = (payload.notifications ?? []).map((row) => mapNotificationRow(row));
  const rewards = (payload.rewards ?? []).map((row) => mapRewardRow(row));
  const groceries = (payload.groceries ?? []).map((row) => mapGroceryRow(row));
  const household = payload.household;

  return {
    householdId: household.id!,
    householdName: household.name ?? 'Household',
    member,
    members,
    tasks,
    events,
    notifications,
    rewards,
    groceries,
    householdPatch: {
      id: household.id,
      householdName: household.name ?? 'Household',
      dailyDeadline: household.daily_deadline ?? undefined,
      rewardModel: (household.reward_model as HouseholdSnapshot['rewardModel']) ?? undefined,
      sidekickGroceryAdd: household.sidekick_grocery_add === true,
      joinApprovalRequired: household.join_approval_required === true,
    },
  };
}

export function mergeSidekickSyncIntoHousehold(
  current: HouseholdSnapshot,
  sync: SidekickSyncResult
): HouseholdSnapshot {
  const members =
    sync.members.length > 0
      ? sync.members
      : current.members.map((item) => (item.id === sync.member.id ? sync.member : item));

  return {
    ...current,
    ...sync.householdPatch,
    members,
    tasks: sync.tasks,
    events: sync.events,
    rewards: sync.rewards.length ? sync.rewards : current.rewards,
    groceries: sync.groceries.length ? sync.groceries : current.groceries,
    greetingName: sync.member.name,
  };
}
