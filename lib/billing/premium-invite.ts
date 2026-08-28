/**
 * Invite joiners must never hit the subscription paywall.
 */
import { peekInviteCode } from '@/lib/invite/invite-code-store';
import { peekMemberInviteToken } from '@/lib/invite/member-invite-token-store';
import { peekPendingJoinHouseholdId } from '@/lib/invite/pending-join-store';
import { classifyInviteCode } from '@/lib/invites/invite-intent';

export type PremiumInviteContext = {
  inviteParam?: string | null;
  memberInviteParam?: string | null;
};

export async function shouldSkipPremiumForInvite(
  context: PremiumInviteContext = {}
): Promise<boolean> {
  const inviteParam = context.inviteParam?.trim();
  if (inviteParam && classifyInviteCode(inviteParam)) return true;

  const memberInvite = context.memberInviteParam?.trim();
  if (memberInvite) return true;

  try {
    const stashed = await peekInviteCode();
    if (stashed && classifyInviteCode(stashed) === 'household') return true;

    const memberToken = await peekMemberInviteToken();
    if (memberToken?.trim()) return true;

    const pendingJoin = await peekPendingJoinHouseholdId();
    if (pendingJoin?.trim()) return true;
  } catch {
    // AsyncStorage unavailable outside React Native — context params above still apply.
  }

  return false;
}
