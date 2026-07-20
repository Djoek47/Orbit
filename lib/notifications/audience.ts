import type { HouseholdRole, NotificationItem } from '@/types/orbit';

/** Roles that can review task proof and approve rewards. */
export const PROOF_REVIEW_ROLES: HouseholdRole[] = ['owner', 'admin', 'adult'];

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
