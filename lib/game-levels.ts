/** Rankings / XP helpers — levels + trophies through 1,000,000 XP. */

import type { HouseholdSnapshot } from '@/types/orbit';

export type GameLevel = {
  name: string;
  minXP: number;
  maxXP: number;
  color: string;
  emoji: string;
};

/** Progression ladder — final tier crowns Most Glorious at 1M XP. */
export const LEVELS: GameLevel[] = [
  { name: 'Seedling', minXP: 0, maxXP: 99, color: '#34D399', emoji: '🌱' },
  { name: 'Helper', minXP: 100, maxXP: 299, color: '#38BDF8', emoji: '⭐' },
  { name: 'Contributor', minXP: 300, maxXP: 599, color: '#A78BFA', emoji: '💎' },
  { name: 'Champion', minXP: 600, maxXP: 999, color: '#FB923C', emoji: '🏆' },
  { name: 'Legend', minXP: 1000, maxXP: 2499, color: '#F59E0B', emoji: '👑' },
  { name: 'Titan', minXP: 2500, maxXP: 4999, color: '#F472B6', emoji: '🛡️' },
  { name: 'Mythic', minXP: 5000, maxXP: 9999, color: '#C084FC', emoji: '🔮' },
  { name: 'Celestial', minXP: 10000, maxXP: 24999, color: '#22D3EE', emoji: '🌌' },
  { name: 'Immortal', minXP: 25000, maxXP: 49999, color: '#FBBF24', emoji: '⚔️' },
  { name: 'Dynasty', minXP: 50000, maxXP: 99999, color: '#FB7185', emoji: '🏛️' },
  { name: 'Ascendant', minXP: 100000, maxXP: 249999, color: '#A3E635', emoji: '🚀' },
  { name: 'Sovereign', minXP: 250000, maxXP: 499999, color: '#38BDF8', emoji: '💠' },
  { name: 'Eternal', minXP: 500000, maxXP: 999999, color: '#E879F9', emoji: '✨' },
  { name: 'Most Glorious', minXP: 1000000, maxXP: 9999999, color: '#FFD700', emoji: '🏅' },
];

export type XpMilestoneTrophy = {
  id: string;
  xp: number;
  emoji: string;
  label: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'glorious';
};

/** Hard XP awards / trophies members unlock as lifetime XP climbs to 1M. */
export const XP_MILESTONE_TROPHIES: XpMilestoneTrophy[] = [
  {
    id: 'xp_100',
    xp: 100,
    emoji: '🥉',
    label: 'First Hundred',
    description: 'Earn 100 lifetime XP',
    tier: 'bronze',
  },
  {
    id: 'xp_500',
    xp: 500,
    emoji: '🥈',
    label: 'Rising Star',
    description: 'Earn 500 lifetime XP',
    tier: 'silver',
  },
  {
    id: 'xp_1000',
    xp: 1000,
    emoji: '🥇',
    label: 'Thousand Club',
    description: 'Earn 1,000 lifetime XP',
    tier: 'gold',
  },
  {
    id: 'xp_2500',
    xp: 2500,
    emoji: '🏆',
    label: 'Household Hero',
    description: 'Earn 2,500 lifetime XP',
    tier: 'gold',
  },
  {
    id: 'xp_5000',
    xp: 5000,
    emoji: '🎖️',
    label: 'Decorated',
    description: 'Earn 5,000 lifetime XP',
    tier: 'platinum',
  },
  {
    id: 'xp_10000',
    xp: 10000,
    emoji: '🌟',
    label: 'Ten Thousand',
    description: 'Earn 10,000 lifetime XP',
    tier: 'platinum',
  },
  {
    id: 'xp_25000',
    xp: 25000,
    emoji: '⚔️',
    label: 'Immortal Badge',
    description: 'Earn 25,000 lifetime XP',
    tier: 'platinum',
  },
  {
    id: 'xp_50000',
    xp: 50000,
    emoji: '🏛️',
    label: 'Dynasty Trophy',
    description: 'Earn 50,000 lifetime XP',
    tier: 'platinum',
  },
  {
    id: 'xp_100000',
    xp: 100000,
    emoji: '🚀',
    label: 'Ascendant Cup',
    description: 'Earn 100,000 lifetime XP',
    tier: 'glorious',
  },
  {
    id: 'xp_250000',
    xp: 250000,
    emoji: '💠',
    label: 'Sovereign Crown',
    description: 'Earn 250,000 lifetime XP',
    tier: 'glorious',
  },
  {
    id: 'xp_500000',
    xp: 500000,
    emoji: '✨',
    label: 'Eternal Laurel',
    description: 'Earn 500,000 lifetime XP',
    tier: 'glorious',
  },
  {
    id: 'xp_1000000',
    xp: 1000000,
    emoji: '🏅',
    label: 'Most Glorious',
    description: 'Earn 1,000,000 lifetime XP — the ultimate household honor',
    tier: 'glorious',
  },
];

export function getLevel(xp: number): GameLevel {
  return [...LEVELS].reverse().find((level) => xp >= level.minXP) ?? LEVELS[0];
}

export function xpProgress(xp: number): number {
  const level = getLevel(xp);
  if (level.name === 'Most Glorious') return 1;
  const range = level.maxXP - level.minXP || 1;
  return Math.min((xp - level.minXP) / range, 1);
}

export function nextXpMilestone(xp: number): XpMilestoneTrophy | null {
  return XP_MILESTONE_TROPHIES.find((trophy) => xp < trophy.xp) ?? null;
}

export function earnedXpTrophies(xp: number): XpMilestoneTrophy[] {
  return XP_MILESTONE_TROPHIES.filter((trophy) => xp >= trophy.xp);
}

export type AchievementBadge = {
  id: string;
  emoji: string;
  label: string;
  description: string;
  earned: boolean;
  kind?: 'habit' | 'xp-trophy';
  xpRequired?: number;
};

export const ACHIEVEMENT_DEFINITIONS: Omit<AchievementBadge, 'earned'>[] = [
  {
    id: 'first_task',
    emoji: '✅',
    label: 'First Step',
    description: 'Completed your first task',
    kind: 'habit',
  },
  {
    id: 'streak_7',
    emoji: '🔥',
    label: 'Week Warrior',
    description: '7-day task streak',
    kind: 'habit',
  },
  {
    id: 'homework_ace',
    emoji: '📚',
    label: 'Homework Ace',
    description: 'Completed 5 homework / school tasks',
    kind: 'habit',
  },
  {
    id: 'team_player',
    emoji: '🤝',
    label: 'Team Player',
    description: 'At least two members earned XP this week',
    kind: 'habit',
  },
  {
    id: 'clean_sweep',
    emoji: '🧹',
    label: 'Clean Sweep',
    description: 'No open tasks left',
    kind: 'habit',
  },
  {
    id: 'early_bird',
    emoji: '🌅',
    label: 'Early Bird',
    description: 'Complete 3+ tasks before noon',
    kind: 'habit',
  },
  {
    id: 'streak_30',
    emoji: '⚡',
    label: 'Month Master',
    description: '30-day consecutive streak',
    kind: 'habit',
  },
  {
    id: 'poppins_fav',
    emoji: '🤖',
    label: "Poppins's Favorite",
    description: 'Chat with Poppins 5 times this session',
    kind: 'habit',
  },
  ...XP_MILESTONE_TROPHIES.map((trophy) => ({
    id: trophy.id,
    emoji: trophy.emoji,
    label: trophy.label,
    description: trophy.description,
    kind: 'xp-trophy' as const,
    xpRequired: trophy.xp,
  })),
];

/** @deprecated Prefer evaluateAchievements — kept for imports that still expect the array shape. */
export const ACHIEVEMENT_BADGES: AchievementBadge[] = ACHIEVEMENT_DEFINITIONS.map((badge) => ({
  ...badge,
  earned: false,
}));

export function evaluateAchievements(
  household: HouseholdSnapshot,
  options?: { poppinsAskCount?: number; focusMemberName?: string }
): AchievementBadge[] {
  const focus =
    household.members.find((member) => member.name === options?.focusMemberName) ?? household.members[0];
  const focusName = focus?.name;
  const completed = household.tasks.filter((task) => task.status === 'Completed');
  const focusCompleted = focusName
    ? completed.filter((task) => {
        if (task.assignees?.length) return task.assignees.includes(focusName);
        return task.assignee === focusName;
      })
    : completed;
  const open = household.tasks.filter(
    (task) => task.status !== 'Completed' && task.status !== 'Cancelled'
  );
  const homeworkDone = focusCompleted.filter((task) =>
    /homework|school/i.test(`${task.category} ${task.title}`)
  ).length;
  /** Morning completions — prefer completedAt hour; fall back to AM due labels. */
  const earlyBirdDone = focusCompleted.filter((task) => {
    if (task.completedAt) {
      return new Date(task.completedAt).getHours() < 12;
    }
    return /\b(0?[1-9]|10|11):\d{2}\s*AM\b/i.test(task.due);
  }).length;
  const weeklyHelpers = household.members.filter((member) => (member.weekXp ?? 0) > 0).length;
  const poppinsAskCount = options?.poppinsAskCount ?? 0;
  const focusXp = focus?.xp ?? 0;

  const earnedMap: Record<string, boolean> = {
    first_task: focusCompleted.length >= 1,
    streak_7: (focus?.streak ?? 0) >= 7,
    homework_ace: homeworkDone >= 5,
    team_player: weeklyHelpers >= 2,
    clean_sweep: household.tasks.length > 0 && open.length === 0,
    early_bird: earlyBirdDone >= 3,
    streak_30: (focus?.streak ?? 0) >= 30,
    poppins_fav: poppinsAskCount >= 5,
  };

  for (const trophy of XP_MILESTONE_TROPHIES) {
    earnedMap[trophy.id] = focusXp >= trophy.xp;
  }

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
  Josh: { color: '#22D3EE', emoji: '🧑' },
  Todd: { color: '#F59E0B', emoji: '🧔' },
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

export function formatXp(xp: number): string {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(xp % 1_000_000 === 0 ? 0 : 1)}M`;
  if (xp >= 10_000) return `${Math.round(xp / 1000)}k`;
  return xp.toLocaleString();
}
