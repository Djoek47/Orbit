/**
 * Membership pickers for household join / Check status.
 * A pending join must never be treated as "approved" just because the user
 * still owns a different household.
 */

export type MembershipLike = {
  household_id: string;
  status: string;
};

export function isPendingStatus(status: string) {
  return status === 'pending' || status === 'invited';
}

/** Whether a new join should wait for admin approval. */
export function joinNeedsApproval(
  joinApprovalRequired: boolean | null | undefined,
  memberPreApproved?: boolean | null
): boolean {
  if (joinApprovalRequired === false) return false;
  if (memberPreApproved) return false;
  return true;
}

/** Status after accepting an invite or completing a profile join. */
export function resolveJoinStatus(
  joinApprovalRequired: boolean | null | undefined,
  memberPreApproved?: boolean | null
): 'pending' | 'active' {
  return joinNeedsApproval(joinApprovalRequired, memberPreApproved) ? 'pending' : 'active';
}

/** Pending joiners get a preview snapshot — they cannot read tasks/groceries yet. */
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
 * Check approval: if any pending join exists, that is the answer.
 * Owning another household is not approval.
 */
export function resolveJoinApprovalMembership<T extends MembershipLike>(
  rows: T[],
  householdId?: string | null
): { status: 'approved' | 'pending' | 'missing'; membership: T | null } {
  const targeted = householdId
    ? rows.find((row) => row.household_id === householdId)
    : undefined;

  if (targeted && isPendingStatus(targeted.status)) {
    return { status: 'pending', membership: targeted };
  }

  const pendingElse = rows.find((row) => isPendingStatus(row.status));
  if (pendingElse) {
    return { status: 'pending', membership: pendingElse };
  }

  if (targeted?.status === 'active') {
    return { status: 'approved', membership: targeted };
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
