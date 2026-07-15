/** Rankings / XP helpers ported from Figma Make `gameData.ts` (v4+). */

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

export const ACHIEVEMENT_BADGES: AchievementBadge[] = [
  {
    id: 'first_task',
    emoji: '✅',
    label: 'First Step',
    description: 'Completed your first task',
    earned: true,
  },
  {
    id: 'streak_7',
    emoji: '🔥',
    label: 'Week Warrior',
    description: '7-day task streak',
    earned: true,
  },
  {
    id: 'homework_ace',
    emoji: '📚',
    label: 'Homework Ace',
    description: 'Completed 10 homework assignments',
    earned: true,
  },
  {
    id: 'team_player',
    emoji: '🤝',
    label: 'Team Player',
    description: 'Helped a family member',
    earned: true,
  },
  {
    id: 'clean_sweep',
    emoji: '🧹',
    label: 'Clean Sweep',
    description: 'Completed all tasks in a week',
    earned: false,
  },
  {
    id: 'early_bird',
    emoji: '🌅',
    label: 'Early Bird',
    description: 'Complete 5 tasks before 9 AM',
    earned: false,
  },
  {
    id: 'streak_30',
    emoji: '⚡',
    label: 'Month Master',
    description: '30-day consecutive streak',
    earned: false,
  },
  {
    id: 'nova_fav',
    emoji: '🤖',
    label: "Nova's Favorite",
    description: 'Chat with Nova 20 times',
    earned: false,
  },
];

export const MEMBER_ACCENTS: Record<string, { color: string; emoji: string }> = {
  Sarah: { color: '#38BDF8', emoji: '👩' },
  David: { color: '#A78BFA', emoji: '👨' },
  Emma: { color: '#FB923C', emoji: '🦋' },
  Liam: { color: '#34D399', emoji: '🌟' },
};
