import type { HouseholdRole, NotificationItem } from '@/types/orbit';

/** Roles that can review task proof and approve rewards. */
export const PROOF_REVIEW_ROLES: HouseholdRole[] = ['owner', 'admin', 'adult'];

/** Admin / adult inbox for reward & allowance requests. */
export const REWARD_REVIEW_ROLES: HouseholdRole[] = ['owner', 'admin', 'adult'];

/** Whether a notification should appear in this member's inbox. */
export function isNotificationVisibleToRole(
  item: NotificationItem,
  role: HouseholdRole | undefined | null
): boolean {
  const audience = item.data?.audienceRoles;
  if (!Array.isArray(audience) || audience.length === 0) {
    return true;
  }
  if (!role) {
    return false;
  }
  return audience.some((entry) => typeof entry === 'string' && entry === role);
}

/**
 * Role audience + optional per-member targeting (e.g. Liam sees his approval,
 * Sarah/admins see his request).
 */
export function isNotificationVisibleToMember(
  item: NotificationItem,
  member: { id: string; role: HouseholdRole } | null | undefined
): boolean {
  const audienceIds = item.data?.audienceMemberIds;
  if (Array.isArray(audienceIds) && audienceIds.length > 0) {
    return Boolean(member && audienceIds.some((id) => id === member.id));
  }
  return isNotificationVisibleToRole(item, member?.role);
}
