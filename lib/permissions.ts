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
};

export function getPermissionsForRole(role: HouseholdRole): HouseholdPermissions {
  return permissionsByRole[role];
}

export function formatHouseholdRole(role: HouseholdRole) {
  return role
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
