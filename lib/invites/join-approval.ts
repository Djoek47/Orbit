/**
 * Membership pickers for household join / Check status.
 * Join approval was removed — every invite connects immediately as active.
 */

export type MembershipLike = {
  household_id: string;
  status: string;
};

export function isPendingStatus(status: string) {
  return status === 'pending' || status === 'invited';
}

/** @deprecated Sidekicks and all roles join immediately — kept for call-site compatibility. */
export function isSidekickJoinRole(_role: string | null | undefined): boolean {
  return false;
}

/** Whether a new join should wait for admin approval — always false. */
export function joinNeedsApproval(
  _joinApprovalRequired?: boolean | null,
  _memberPreApproved?: boolean | null,
  _memberRole?: string | null
): boolean {
  return false;
}

/** Status after accepting an invite or completing a profile join — always active. */
export function resolveJoinStatus(
  _joinApprovalRequired?: boolean | null,
  _memberPreApproved?: boolean | null,
  _memberRole?: string | null
): 'pending' | 'active' {
  return 'active';
}

/** Pending joiners get a preview snapshot — legacy only; new joins are active immediately. */
export function shouldLoadPendingPreview(status: string | null | undefined): boolean {
  return isPendingStatus(status ?? '');
}

/** True when this household is only a waiting-to-be-approved join, not a live home. */
export function isPendingJoinSnapshot(household: {
  members?: { status?: string | null }[] | null;
} | null | undefined): boolean {
  const members = household?.members ?? [];
  if (members.length === 0) return false;
  const hasActive = members.some((member) => member.status === 'active');
  const hasPending = members.some((member) => isPendingStatus(member.status ?? ''));
  return hasPending && !hasActive;
}

/** Which household to show after sign-in / reload. */
export function resolveHydrateMembership<T extends MembershipLike>(
  rows: T[],
  pendingJoinId?: string | null
): T | null {
  if (pendingJoinId) {
    const targeted = rows.find((row) => row.household_id === pendingJoinId);
    if (targeted) return targeted;
  }
  return (
    rows.find((row) => row.status === 'active') ??
    rows.find((row) => isPendingStatus(row.status)) ??
    null
  );
}

/**
 * Check approval: pending memberships are treated as approved (approval flow removed).
 */
export function resolveJoinApprovalMembership<T extends MembershipLike>(
  rows: T[],
  householdId?: string | null
): { status: 'approved' | 'pending' | 'missing'; membership: T | null } {
  const targeted = householdId
    ? rows.find((row) => row.household_id === householdId)
    : undefined;

  if (targeted && (targeted.status === 'active' || isPendingStatus(targeted.status))) {
    return { status: 'approved', membership: targeted };
  }

  const pendingElse = rows.find((row) => isPendingStatus(row.status));
  if (pendingElse) {
    return { status: 'approved', membership: pendingElse };
  }

  if (householdId) {
    return { status: 'missing', membership: null };
  }

  const active = rows.find((row) => row.status === 'active');
  if (active) {
    return { status: 'approved', membership: active };
  }

  return { status: 'missing', membership: null };
}
