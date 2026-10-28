import AsyncStorage from '@react-native-async-storage/async-storage';

const MEMBER_INVITE_TOKEN_KEY = 'orbit.pendingMemberInviteToken';

export async function stashMemberInviteToken(token: string) {
  const trimmed = token.trim();
  if (!trimmed) return;
  await AsyncStorage.setItem(MEMBER_INVITE_TOKEN_KEY, trimmed);
}

export async function peekMemberInviteToken(): Promise<string | null> {
  const value = await AsyncStorage.getItem(MEMBER_INVITE_TOKEN_KEY);
  return value?.trim() || null;
}

export async function consumeMemberInviteToken(): Promise<string | null> {
  const value = await peekMemberInviteToken();
  if (value) {
    await AsyncStorage.removeItem(MEMBER_INVITE_TOKEN_KEY);
  }
  return value;
}

/** Post-auth: continue a stashed per-member invite on the redeem screen. */
export async function memberInviteRedeemHref(): Promise<string | null> {
  const token = await peekMemberInviteToken();
  if (!token) return null;
  return `/redeem-member-invite?token=${encodeURIComponent(token)}`;
}
