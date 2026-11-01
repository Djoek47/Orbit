import AsyncStorage from '@react-native-async-storage/async-storage';

const INVITE_CODE_KEY = 'orbit.pendingInviteCode';

export async function stashInviteCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;
  await AsyncStorage.setItem(INVITE_CODE_KEY, normalized);
}

export async function peekInviteCode(): Promise<string | null> {
  const value = await AsyncStorage.getItem(INVITE_CODE_KEY);
  return value?.trim() || null;
}

export async function consumeInviteCode(): Promise<string | null> {
  const value = await peekInviteCode();
  if (value) {
    await AsyncStorage.removeItem(INVITE_CODE_KEY);
  }
  return value;
}

export async function clearInviteCode() {
  await AsyncStorage.removeItem(INVITE_CODE_KEY);
}
