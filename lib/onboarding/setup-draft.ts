/**
 * Persist partial household setup across kills (§3.4 / §3.5).
 * Draft lives in AsyncStorage until Create household / Save and finish later.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RewardModel } from '@/lib/rewards/reward-model';
import type { RewardFrequency } from '@/lib/rewards/reward-presets';
import type { RewardMode } from '@/lib/rewards/reward-mode';
import type { HouseholdRole } from '@/types/orbit';

export type DraftMemberReward = {
  presetId: string;
  title: string;
  frequency: RewardFrequency;
  quantity?: string;
};

export type DraftMemberAllowance = {
  amount: number;
  frequency: RewardFrequency;
};

export type DraftMember = {
  id: string;
  name: string;
  /** Admin / Helper (draft `member`) — first household creator is always admin in store. */
  role: 'admin' | 'member';
  avatarColor?: string;
  /** Photo URI or emoji chosen during onboarding. */
  avatar?: string;
  taskLibraryIds: string[];
  rewards: DraftMemberReward[];
  allowance?: DraftMemberAllowance | null;
  /** True after Step D Confirm. */
  setupComplete: boolean;
};

export type DraftPlace = {
  kind: 'home' | 'school' | 'shop' | 'clothing';
  name: string;
  address: string;
  lat?: number;
  lng?: number;
};

export type HouseholdSetupDraft = {
  version: 1;
  householdName: string;
  rewardModel: RewardModel;
  /** Meritocracy (weighted) vs Equity (flat). */
  scoringMode: RewardMode;
  members: DraftMember[];
  places?: DraftPlace[];
  updatedAt: string;
};

const KEY = 'choremaxx.household.setup.draft.v1';

export const AVATAR_SWATCHES = [
  '#3BB5F0',
  '#34D399',
  '#F59E0B',
  '#A78BFA',
  '#F472B6',
  '#2DD4BF',
] as const;

export function createEmptyDraft(
  partial?: Partial<Pick<HouseholdSetupDraft, 'householdName' | 'rewardModel' | 'scoringMode'>>
): HouseholdSetupDraft {
  return {
    version: 1,
    householdName: partial?.householdName ?? '',
    rewardModel: partial?.rewardModel ?? 'full',
    scoringMode: partial?.scoringMode ?? 'weighted',
    members: [],
    places: [],
    updatedAt: new Date().toISOString(),
  };
}

export function memberIsComplete(member: DraftMember): boolean {
  return member.setupComplete && member.name.trim().length > 0 && member.taskLibraryIds.length > 0;
}

export function draftHasCompleteMember(draft: HouseholdSetupDraft): boolean {
  return draft.members.some(memberIsComplete);
}

export function memberStatusLine(member: DraftMember): string {
  if (!member.name.trim()) return 'Unnamed';
  if (!member.setupComplete) {
    if (member.taskLibraryIds.length === 0) return 'No tasks yet';
    return 'Finish setup';
  }
  const tasks = `${member.taskLibraryIds.length} task${member.taskLibraryIds.length === 1 ? '' : 's'}`;
  if (member.allowance) return `${tasks} · Allowance set`;
  if (member.rewards.length > 0) return `${tasks} · Rewards set`;
  return `${tasks} · Ready`;
}

export async function loadSetupDraft(): Promise<HouseholdSetupDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HouseholdSetupDraft;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSetupDraft(draft: HouseholdSetupDraft): Promise<HouseholdSetupDraft> {
  const next = { ...draft, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function clearSetupDraft(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export function newDraftMemberId(): string {
  return `draft-member-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function draftRoleToHouseholdRole(role: 'admin' | 'member'): HouseholdRole {
  return role === 'admin' ? 'admin' : 'child';
}
