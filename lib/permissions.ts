import type { HouseholdRole } from '@/types/orbit';

export type HouseholdPermissions = {
  canManageHousehold: boolean;
  canCreateTask: boolean;
  canAssignTask: boolean;
  canApproveReward: boolean;
  canInviteMembers: boolean;
  canManageGroceries: boolean;
  canViewAnalytics: boolean;
};

const permissionsByRole: Record<HouseholdRole, HouseholdPermissions> = {
  owner: {
    canManageHousehold: true,
    canCreateTask: true,
    canAssignTask: true,
    canApproveReward: true,
    canInviteMembers: true,
    canManageGroceries: true,
    canViewAnalytics: true,
  },
  admin: {
    canManageHousehold: true,
    canCreateTask: true,
    canAssignTask: true,
    canApproveReward: true,
    canInviteMembers: true,
    canManageGroceries: true,
    canViewAnalytics: true,
  },
  adult: {
    canManageHousehold: false,
    canCreateTask: true,
    canAssignTask: true,
    canApproveReward: true,
    canInviteMembers: false,
    canManageGroceries: true,
    canViewAnalytics: false,
  },
  child: {
    canManageHousehold: false,
    canCreateTask: false,
    canAssignTask: false,
    canApproveReward: false,
    canInviteMembers: false,
    canManageGroceries: false,
    canViewAnalytics: false,
  },
  guest: {
    canManageHousehold: false,
    canCreateTask: false,
    canAssignTask: false,
    canApproveReward: false,
    canInviteMembers: false,
    canManageGroceries: false,
    canViewAnalytics: false,
  },
  /** Shared phone/tablet — confirm tasks for linked people; no admin powers. */
  'shared-device': {
    canManageHousehold: false,
    canCreateTask: false,
    canAssignTask: false,
    canApproveReward: false,
    canInviteMembers: false,
    canManageGroceries: false,
    canViewAnalytics: false,
  },
};

export function getPermissionsForRole(role: HouseholdRole): HouseholdPermissions {
  return permissionsByRole[role];
}

/**
 * Display label for a household role.
 * Sidekick is stored as `child` — Appendix A.2. Do not rename the storage token.
 */
export function formatHouseholdRole(role: HouseholdRole) {
  if (role === 'child') return 'Sidekick';
  return role
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Admin vs Sidekick (draft / v2 role display). Storage key for Sidekick remains `member` / `child`. */
export function formatV2RoleLabel(role: 'admin' | 'member'): string {
  return role === 'admin' ? 'Admin' : 'Sidekick';
}
