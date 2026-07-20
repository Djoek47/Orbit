/** Rankings / XP helpers ported from Figma Make `gameData.ts` (v4+). */

import type { HouseholdSnapshot } from '@/types/orbit';

export type GameLevel = {
  name: string;
  minXP: number;
  maxXP: number;
  color: string;
  emoji: string;
};

export const LEVELS: GameLevel[] = [
  { name: 'Seedling', minXP: 0, maxXP: 99, color: '#34D399', emoji: '🌱' },
  { name: 'Helper', minXP: 100, maxXP: 299, color: '#38BDF8', emoji: '⭐' },
  { name: 'Contributor', minXP: 300, maxXP: 599, color: '#A78BFA', emoji: '💎' },
  { name: 'Champion', minXP: 600, maxXP: 999, color: '#FB923C', emoji: '🏆' },
  { name: 'Legend', minXP: 1000, maxXP: 9999, color: '#F59E0B', emoji: '👑' },
];

export function getLevel(xp: number): GameLevel {
  return [...LEVELS].reverse().find((level) => xp >= level.minXP) ?? LEVELS[0];
}

export function xpProgress(xp: number): number {
  const level = getLevel(xp);
  const range = level.maxXP - level.minXP || 1;
  return Math.min((xp - level.minXP) / range, 1);
}

export type AchievementBadge = {
  id: string;
  emoji: string;
  label: string;
  description: string;
  earned: boolean;
};

export const ACHIEVEMENT_DEFINITIONS: Omit<AchievementBadge, 'earned'>[] = [
  {
    id: 'first_task',
    emoji: '✅',
    label: 'First Step',
    description: 'Completed your first task',
  },
  {
    id: 'streak_7',
    emoji: '🔥',
    label: 'Week Warrior',
    description: '7-day task streak',
  },
  {
    id: 'homework_ace',
    emoji: '📚',
    label: 'Homework Ace',
    description: 'Completed 5 homework / school tasks',
  },
  {
    id: 'team_player',
    emoji: '🤝',
    label: 'Team Player',
    description: 'At least two members earned XP this week',
  },
  {
    id: 'clean_sweep',
    emoji: '🧹',
    label: 'Clean Sweep',
    description: 'No open tasks left',
  },
  {
    id: 'early_bird',
    emoji: '🌅',
    label: 'Early Bird',
    description: 'Complete 3+ tasks due today',
  },
  {
    id: 'streak_30',
    emoji: '⚡',
    label: 'Month Master',
    description: '30-day consecutive streak',
  },
  {
    id: 'nova_fav',
    emoji: '🤖',
    label: "Nova's Favorite",
    description: 'Chat with Nova 5 times this session',
  },
];

/** @deprecated Prefer evaluateAchievements — kept for imports that still expect the array shape. */
export const ACHIEVEMENT_BADGES: AchievementBadge[] = ACHIEVEMENT_DEFINITIONS.map((badge) => ({
  ...badge,
  earned: false,
}));

export function evaluateAchievements(
  household: HouseholdSnapshot,
  options?: { novaAskCount?: number; focusMemberName?: string }
): AchievementBadge[] {
  const completed = household.tasks.filter((task) => task.status === 'Completed');
  const open = household.tasks.filter((task) => task.status !== 'Completed');
  const homeworkDone = completed.filter((task) =>
    /homework|school/i.test(`${task.category} ${task.title}`)
  ).length;
  const todayDone = completed.filter((task) => /today|completed today/i.test(task.due)).length;
  const focus =
    household.members.find((member) => member.name === options?.focusMemberName) ?? household.members[0];
  const weeklyHelpers = household.members.filter((member) => (member.weekXp ?? 0) > 0).length;
  const novaAskCount = options?.novaAskCount ?? 0;

  const earnedMap: Record<string, boolean> = {
    first_task: completed.length >= 1,
    streak_7: (focus?.streak ?? 0) >= 7,
    homework_ace: homeworkDone >= 5 || completed.filter((t) => /homework/i.test(t.category)).length >= 1,
    team_player: weeklyHelpers >= 2,
    clean_sweep: household.tasks.length > 0 && open.length === 0,
    early_bird: todayDone >= 3 || completed.length >= 3,
    streak_30: (focus?.streak ?? 0) >= 30,
    nova_fav: novaAskCount >= 5,
  };

  return ACHIEVEMENT_DEFINITIONS.map((badge) => ({
    ...badge,
    earned: Boolean(earnedMap[badge.id]),
  }));
}

export const MEMBER_ACCENTS: Record<string, { color: string; emoji: string }> = {
  Sarah: { color: '#38BDF8', emoji: '👩' },
  David: { color: '#A78BFA', emoji: '👨' },
  Emma: { color: '#FB923C', emoji: '🦋' },
  Liam: { color: '#34D399', emoji: '🌟' },
  Jordan: { color: '#F472B6', emoji: '✨' },
  Casey: { color: '#94A3B8', emoji: '👋' },
  'Shared tablet': { color: '#06B6D4', emoji: '📱' },
};

/** Prefer stored member.avatar over hardcoded Make demo emoji. */
export function isAvatarImageUri(avatar?: string | null) {
  if (!avatar) return false;
  return /^(file|content|https?):\/\//i.test(avatar) || avatar.startsWith('data:image');
}

export function memberDisplayEmoji(member: { name: string; avatar?: string }) {
  const avatar = member.avatar?.trim();
  if (avatar && isAvatarImageUri(avatar)) {
    return MEMBER_ACCENTS[member.name]?.emoji ?? '👤';
  }
  if (avatar && !/^[A-Za-z0-9]{1,3}$/.test(avatar)) {
    return avatar;
  }
  return MEMBER_ACCENTS[member.name]?.emoji ?? avatar ?? '👤';
}
