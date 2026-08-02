/**
 * ChoreMaxx v2 Admin vs Member permissions (§1.6).
 * Legacy roles map: owner/admin → admin; everyone else → member.
 * Enforce in store actions — do not only hide UI.
 */

import type { HouseholdRole } from '@/types/orbit';

export type V2Role = 'admin' | 'member';

export type V2Permissions = {
  canAssignOrEditTask: boolean;
  canApproveCompletion: boolean;
  canRequestProof: boolean;
  canSendAllowance: boolean;
  canGrantOrRevokeReward: boolean;
  canCreateOrEditRewards: boolean;
  canChangeRewardModel: boolean;
  canAddOrRemoveMembers: boolean;
  canMarkOwnTaskComplete: boolean;
  canSubmitProof: boolean;
  canViewOwnProgress: boolean;
  canViewLeaderboard: boolean;
};

const ADMIN: V2Permissions = {
  canAssignOrEditTask: true,
  canApproveCompletion: true,
  canRequestProof: true,
  canSendAllowance: true,
  canGrantOrRevokeReward: true,
  canCreateOrEditRewards: true,
  canChangeRewardModel: true,
  canAddOrRemoveMembers: true,
  canMarkOwnTaskComplete: true,
  canSubmitProof: true,
  canViewOwnProgress: true,
  canViewLeaderboard: true,
};

const MEMBER: V2Permissions = {
  canAssignOrEditTask: false,
  canApproveCompletion: false,
  canRequestProof: false,
  canSendAllowance: false,
  canGrantOrRevokeReward: false,
  canCreateOrEditRewards: false,
  canChangeRewardModel: false,
  canAddOrRemoveMembers: false,
  canMarkOwnTaskComplete: true,
  canSubmitProof: true,
  canViewOwnProgress: true,
  canViewLeaderboard: true,
};

export function toV2Role(role: HouseholdRole | null | undefined): V2Role {
  if (role === 'owner' || role === 'admin') return 'admin';
  return 'member';
}

export function getV2Permissions(role: HouseholdRole | null | undefined): V2Permissions {
  return toV2Role(role) === 'admin' ? ADMIN : MEMBER;
}

/**
 * An admin cannot approve their own proof-required completion when another
 * admin exists. Single-admin households auto-confirm.
 * // TODO(product): single-admin auto-approve policy confirmed in §1.6
 */
export function canAdminSelfApproveProof(opts: {
  actorId: string;
  assigneeId: string;
  adminCount: number;
}): boolean {
  if (opts.actorId !== opts.assigneeId) return true;
  return opts.adminCount <= 1;
}
