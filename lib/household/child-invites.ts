import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureProfileInviteCode } from '@/lib/household/profile-codes';
import { normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import type { HouseholdMember } from '@/types/orbit';

const KEY = 'choremaxx.childInvites.v1';

export type ChildInviteRecord = {
  code: string;
  member: HouseholdMember;
  householdId: string;
  householdName: string;
  createdAt: string;
};

async function readAll(): Promise<ChildInviteRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChildInviteRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(records: ChildInviteRecord[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(records));
}

export async function saveChildInviteRecord(
  input: Omit<ChildInviteRecord, 'createdAt' | 'code'> & { code?: string },
): Promise<ChildInviteRecord> {
  const code = normalizeInviteCode(input.code || ensureProfileInviteCode(input.member));
  const record: ChildInviteRecord = {
    code,
    member: { ...input.member, profileInviteCode: code, role: 'child' },
    householdId: input.householdId,
    householdName: input.householdName,
    createdAt: new Date().toISOString(),
  };
  const current = await readAll();
  const next = [record, ...current.filter((item) => item.code !== code)];
  await writeAll(next);
  return record;
}

export async function loadChildInviteRecord(raw: string): Promise<ChildInviteRecord | null> {
  const code = parseInvitePayload(raw) ?? (raw.trim() ? normalizeInviteCode(raw) : null);
  if (!code) return null;
  const all = await readAll();
  return all.find((item) => item.code === code) ?? null;
}

export function childInviteEmoji(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  const map: Record<string, string> = {
    A: '🌟',
    B: '🚀',
    C: '🎯',
    D: '🌈',
    E: '⭐',
    F: '🦊',
    G: '🍀',
    H: '🎮',
    I: '💎',
    J: '⚡',
    K: '🦁',
    L: '🌙',
    M: '🎨',
    N: '🌻',
    O: '🔥',
    P: '🦄',
    Q: '🎵',
    R: '🏆',
    S: '☀️',
    T: '🐢',
    U: '✨',
    V: '💜',
    W: '🌊',
    X: '✖️',
    Y: '💛',
    Z: '⚡',
  };
  return map[first] ?? '⭐';
}
