export type Level = {
  name: string;
  minXP: number;
  maxXP: number;
  color: string;
  emoji: string;
  gradient: string;
};

export const LEVELS: Level[] = [
  { name: "Seedling",    minXP: 0,    maxXP: 99,   color: "#34D399", emoji: "🌱", gradient: "linear-gradient(135deg, #34D399, #059669)" },
  { name: "Helper",      minXP: 100,  maxXP: 299,  color: "#38BDF8", emoji: "⭐", gradient: "linear-gradient(135deg, #38BDF8, #0EA5E9)" },
  { name: "Contributor", minXP: 300,  maxXP: 599,  color: "#A78BFA", emoji: "💎", gradient: "linear-gradient(135deg, #A78BFA, #7C3AED)" },
  { name: "Champion",    minXP: 600,  maxXP: 999,  color: "#FB923C", emoji: "🏆", gradient: "linear-gradient(135deg, #FB923C, #EA580C)" },
  { name: "Legend",      minXP: 1000, maxXP: 9999, color: "#F59E0B", emoji: "👑", gradient: "linear-gradient(135deg, #FBBF24, #D97706)" },
];

export function getLevel(xp: number): Level {
  return LEVELS.slice().reverse().find((l) => xp >= l.minXP) ?? LEVELS[0];
}

export function xpProgress(xp: number): number {
  const level = getLevel(xp);
  const range = level.maxXP - level.minXP;
  return Math.min((xp - level.minXP) / range, 1);
}

export type Badge = {
  id: string;
  emoji: string;
  label: string;
  description: string;
  earned: boolean;
  earnedDate?: string;
};

export const BADGES: Badge[] = [
  { id: "first_task",    emoji: "✅", label: "First Step",     description: "Completed your first task",       earned: true,  earnedDate: "Jun 2" },
  { id: "streak_7",     emoji: "🔥", label: "Week Warrior",   description: "7-day task streak",               earned: true,  earnedDate: "Jun 8" },
  { id: "homework_ace", emoji: "📚", label: "Homework Ace",   description: "Completed 10 homework assignments",earned: true,  earnedDate: "Jun 12" },
  { id: "team_player",  emoji: "🤝", label: "Team Player",    description: "Helped a family member",          earned: true,  earnedDate: "Jun 15" },
  { id: "clean_sweep",  emoji: "🧹", label: "Clean Sweep",    description: "Completed all tasks in a week",   earned: false },
  { id: "early_bird",   emoji: "🌅", label: "Early Bird",     description: "Complete 5 tasks before 9 AM",    earned: false },
  { id: "streak_30",    emoji: "⚡", label: "Month Master",   description: "30-day consecutive streak",       earned: false },
  { id: "nova_fav",     emoji: "🤖", label: "Nova's Favorite","description": "Chat with Nova 20 times",       earned: false },
];

export type Member = {
  id: string;
  name: string;
  initial: string;
  role: string;
  avatarEmoji: string;
  color: string;
  gradient: string;
  xp: number;
  weekXP: number;
  streak: number;
  tasksCompleted: number;
  homeworkCompleted: number;
};

export const DEFAULT_MEMBERS: Member[] = [
  { id: "sarah", name: "Sarah",  initial: "S", role: "Parent",  avatarEmoji: "👩", color: "#38BDF8", gradient: "linear-gradient(135deg, #38BDF8, #0EA5E9)", xp: 680,  weekXP: 95,  streak: 12, tasksCompleted: 142, homeworkCompleted: 0  },
  { id: "james", name: "James",  initial: "J", role: "Parent",  avatarEmoji: "👨", color: "#A78BFA", gradient: "linear-gradient(135deg, #A78BFA, #7C3AED)", xp: 720,  weekXP: 110, streak: 8,  tasksCompleted: 158, homeworkCompleted: 0  },
  { id: "maya",  name: "Maya",   initial: "M", role: "Age 12",  avatarEmoji: "🌟", color: "#34D399", gradient: "linear-gradient(135deg, #34D399, #059669)", xp: 415,  weekXP: 80,  streak: 5,  tasksCompleted: 67,  homeworkCompleted: 34 },
  { id: "emma",  name: "Emma",   initial: "E", role: "Age 8",   avatarEmoji: "🦋", color: "#FB923C", gradient: "linear-gradient(135deg, #FB923C, #EA580C)", xp: 220,  weekXP: 45,  streak: 3,  tasksCompleted: 29,  homeworkCompleted: 18 },
];

export const ACCENT_THEMES = [
  { id: "ocean",   label: "Ocean",   primary: "#38BDF8", secondary: "#0EA5E9", bg: "#070D1C" },
  { id: "aurora",  label: "Aurora",  primary: "#34D399", secondary: "#059669", bg: "#071A0F" },
  { id: "cosmic",  label: "Cosmic",  primary: "#A78BFA", secondary: "#7C3AED", bg: "#0D0A1C" },
  { id: "sunset",  label: "Sunset",  primary: "#FB923C", secondary: "#EA580C", bg: "#1A0C07" },
  { id: "rose",    label: "Rose",    primary: "#F472B6", secondary: "#EC4899", bg: "#1A071A" },
];
