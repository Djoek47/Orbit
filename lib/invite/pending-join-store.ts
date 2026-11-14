import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'orbit.pendingJoinHouseholdId';

export async function stashPendingJoinHouseholdId(householdId: string) {
  const id = householdId.trim();
  if (!id) return;
  await AsyncStorage.setItem(KEY, id);
}

export async function peekPendingJoinHouseholdId(): Promise<string | null> {
  const value = await AsyncStorage.getItem(KEY);
  return value?.trim() || null;
}

export async function clearPendingJoinHouseholdId() {
  await AsyncStorage.removeItem(KEY);
}
