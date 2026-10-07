/**
 * Pull latest household domains for Sidekick devices via edge function (no JWT).
 */

import { dataMode } from '@/config/data-mode';
import {
  mapCustomHouseRulesFromRows,
  mapHouseholdSettingsFromRow,
  type HouseholdSettingsRow,
} from '@/lib/household/map-household-settings';
import { mapEventRow, mapGroceryRow, mapMemberRow, mapRewardRow, mapTaskRow } from '@/lib/mappers/orbit-mappers';
import { getSupabaseClient } from '@/lib/supabase/client';
import { applyHouseholdTaskExpiry } from '@/lib/tasks/apply-household-expiry';
import { refreshStaleDueLabels } from '@/lib/tasks/due-label';
import type { HouseholdSnapshot, NotificationItem, RewardRedemption } from '@/types/orbit';

export type SidekickSyncResult = {
  householdId: string;
  householdName: string;
  member: ReturnType<typeof mapMemberRow>;
  members: ReturnType<typeof mapMemberRow>[];
  tasks: ReturnType<typeof mapTaskRow>[];
  events: ReturnType<typeof mapEventRow>[];
  notifications: NotificationItem[];
  rewards: ReturnType<typeof mapRewardRow>[];
  redemptions: RewardRedemption[];
  groceries: ReturnType<typeof mapGroceryRow>[];
  householdPatch: Partial<HouseholdSnapshot>;
  customHouseRules: NonNullable<HouseholdSnapshot['customHouseRules']>;
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

function mapRedemptionRow(row: {
  id: string;
  household_id: string;
  reward_id: string;
  member_id: string;
  status: RewardRedemption['status'];
  note: string | null;
  requested_at: string;
  decided_at: string | null;
}): RewardRedemption {
  return {
    id: row.id,
    householdId: row.household_id,
    rewardId: row.reward_id,
    memberId: row.member_id,
    status: row.status,
    note: row.note ?? undefined,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at ?? undefined,
  };
}

export type SidekickSyncFetch =
  | { status: 'ok'; sync: SidekickSyncResult }
  | { status: 'removed' }
  | { status: 'unavailable' };

/** Detailed sync so removed profiles can be kicked (vs network blips). */
export async function fetchSidekickSyncDetailed(
  profileInviteCode: string
): Promise<SidekickSyncFetch> {
  if (dataMode !== 'supabase') {
    return { status: 'unavailable' };
  }
  const supabase = getSupabaseClient();
  if (!supabase) return { status: 'unavailable' };

  let hostKind: string | undefined;
  let sharedDeviceId: string | undefined;
  let activeMemberId: string | undefined;
  try {
    const { loadDeviceSession } = await import('@/lib/device/device-session');
    const device = await loadDeviceSession();
    activeMemberId = device.activeMemberId ?? undefined;
    if (device.hostKind === 'shared-tablet' || device.mode === 'shared') {
      hostKind = 'shared-tablet';
      sharedDeviceId = device.sharedDeviceId ?? undefined;
    } else if (device.hostKind === 'sidekick') {
      hostKind = 'sidekick';
    }
  } catch {
    /* optional — sync still works without channel hints */
  }

  const { data, error } = await supabase.functions.invoke('sidekick-sync', {
    body: {
      code: profileInviteCode,
      ...(hostKind ? { hostKind } : {}),
      ...(sharedDeviceId ? { sharedDeviceId } : {}),
      ...(activeMemberId ? { activeMemberId } : {}),
    },
  });
  if (error || !data || typeof data !== 'object') {
    const message = error?.message?.toLowerCase() ?? '';
    if (message.includes('404') || message.includes('not_found') || message.includes('not found')) {
      return { status: 'removed' };
    }
    console.warn('fetchSidekickSync', error?.message ?? 'empty payload');
    return { status: 'unavailable' };
  }

  const payload = data as {
    error?: string;
    member?: Parameters<typeof mapMemberRow>[0];
    household?: HouseholdSettingsRow;
    customHouseRules?: { id?: string; body?: string; sort_order?: number }[];
    members?: Parameters<typeof mapMemberRow>[0][];
    tasks?: Parameters<typeof mapTaskRow>[0][];
    calendarEvents?: Parameters<typeof mapEventRow>[0][];
    notifications?: Parameters<typeof mapNotificationRow>[0][];
    rewards?: Parameters<typeof mapRewardRow>[0][];
    redemptions?: Parameters<typeof mapRedemptionRow>[0][];
    groceries?: Parameters<typeof mapGroceryRow>[0][];
  };

  if (payload.error) {
    const { isSidekickRemovedSyncError } = await import('@/lib/household/member-removal-protocol');
    return isSidekickRemovedSyncError(payload)
      ? { status: 'removed' }
      : { status: 'unavailable' };
  }
  if (!payload.member || !payload.household?.id) {
    return { status: 'unavailable' };
  }

  const member = mapMemberRow(payload.member);
  const members = (payload.members ?? []).map((row) => mapMemberRow(row));
  const tasks = (payload.tasks ?? []).map((row) => mapTaskRow(row));
  const events = (payload.calendarEvents ?? []).map((row) => mapEventRow(row));
  const notifications = (payload.notifications ?? []).map((row) => mapNotificationRow(row));
  const rewards = (payload.rewards ?? []).map((row) => mapRewardRow(row));
  const redemptions = (payload.redemptions ?? []).map((row) => mapRedemptionRow(row));
  const groceries = (payload.groceries ?? []).map((row) => mapGroceryRow(row));
  const household = payload.household;
  const customHouseRules = mapCustomHouseRulesFromRows(payload.customHouseRules) ?? [];
  const householdPatch = mapHouseholdSettingsFromRow(household);

  return {
    status: 'ok',
    sync: {
      householdId: household.id!,
      householdName: household.name ?? 'Household',
      member,
      members,
      tasks,
      events,
      notifications,
      rewards,
      redemptions,
      groceries,
      customHouseRules,
      householdPatch: {
        ...householdPatch,
        id: household.id,
        householdName: household.name ?? 'Household',
      },
    },
  };
}

/** Fetch tasks + notifications for a profile invite code (Supabase production path). */
export async function fetchSidekickSync(profileInviteCode: string): Promise<SidekickSyncResult | null> {
  const result = await fetchSidekickSyncDetailed(profileInviteCode);
  return result.status === 'ok' ? result.sync : null;
}

export function mergeSidekickSyncIntoHousehold(
  current: HouseholdSnapshot,
  sync: SidekickSyncResult,
  now = new Date()
): HouseholdSnapshot {
  const members =
    sync.members.length > 0
      ? sync.members
      : current.members.map((item) => (item.id === sync.member.id ? sync.member : item));

  const householdContext = {
    ...current,
    ...sync.householdPatch,
    members,
    recessPeriods: current.recessPeriods,
  };
  const expiredTasks = refreshStaleDueLabels(
    applyHouseholdTaskExpiry(sync.tasks, householdContext, now),
    now
  );

  return {
    ...current,
    ...sync.householdPatch,
    members,
    tasks: expiredTasks,
    events: sync.events,
    rewards: sync.rewards,
    groceries: sync.groceries,
    customHouseRules: sync.customHouseRules,
    greetingName: sync.member.name,
  };
}
