/**
 * Post-join routing — sign-out rules, approval landing, display-name gate.
 */

export function joinSessionSignOutRequired(_hasActiveLiveHome: boolean, _joiningNewHousehold: boolean): boolean {
  return false;
}

/** Where a logged-out invitee lands to create a fresh account. */
export function hrefForLoggedOutInvite(inviteCode: string): string {
  const code = inviteCode.trim().toUpperCase();
  return `/welcome?invite=${encodeURIComponent(code)}`;
}

/** After admin approval — rename if still using the old account name. */
export function hrefAfterJoinApproval(options: {
  needsDisplayName: boolean;
  previousAccountName?: string | null;
  memberDisplayName?: string | null;
}): '/join-display-name' | '/join-welcome' | '/(tabs)/tasks' {
  const prev = options.previousAccountName?.trim().toLowerCase() ?? '';
  const member = options.memberDisplayName?.trim().toLowerCase() ?? '';
  if (options.needsDisplayName) return '/join-display-name';
  if (prev && member && prev === member) return '/join-display-name';
  return '/join-welcome';
}

/** Admin inbox copy when someone requests to join. */
export function adminJoinRequestNotification(input: { requesterName: string }) {
  return {
    title: 'Poppins · Members',
    body: `${input.requesterName} asked to join this household.`,
    category: 'members' as const,
    priority: 'high' as const,
    data: { surface: 'members' },
  };
}
