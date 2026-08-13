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
 * Revision C §3: v2 `member` (stored as `child`) shows as **Helper**.
 * Permission keys / `toV2Role` are unchanged.
 */
export function formatHouseholdRole(role: HouseholdRole) {
  if (role === 'child') return 'Helper';
  return role
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Revision C §3 — Admin vs Helper (draft / v2 role display). */
export function formatV2RoleLabel(role: 'admin' | 'member'): string {
  return role === 'admin' ? 'Admin' : 'Helper';
}
