/**
 * House Rules typed models — 1:1 with data/house-rules.json.
 * Spec: docs/logic/CURSOR-SPEC-house-rules.md
 */

export const CONDITION_KEYS = [
  'ALWAYS',
  'XP_ON',
  'ALLOWANCE_ON',
  'REWARDS_ON',
  'MULTI_MEMBER',
  'HOMEWORK_ON',
] as const;
export type ConditionKey = (typeof CONDITION_KEYS)[number];

export const PHASE_KEYS = [
  'assigned',
  'nudge',
  'deadline',
  'lateCredit',
  'expired',
  'counted',
  'weekly',
  'crownWeek',
  'crownMonth',
  'anytime',
] as const;
export type PhaseKey = (typeof PHASE_KEYS)[number];

export const VISUAL_KEYS = [
  'none',
  'xpRamp',
  'dayTimeline',
  'lateCreditTable',
  'streakDots',
  'rescueTiers',
  'podium',
  'modelList',
] as const;
export type VisualKey = (typeof VISUAL_KEYS)[number];

export const CHAPTER_KEYS = [
  'earning',
  'deadlines',
  'streaks',
  'crowns',
  'rewards',
  'proof',
  'household',
] as const;
export type ChapterKey = (typeof CHAPTER_KEYS)[number];

export type RuleConstants = {
  xpValues: number[];
  lateCredit: Record<string, number>;
  bundleBonusOnTime: number;
  bundleBonusLate: number;
  deadlines: {
    daily: string;
    weekly: string;
    monthly: string;
    timezone: string;
  };
  expiryTime: string;
  nudgeMinutesBefore: number;
  streak: {
    consecutiveMissesToEnd: number;
    rollingWindowDays: number;
    missesInWindowToEnd: number;
    qualifyingCadences: string[];
  };
  streakRescue: {
    afterOneMiss: number;
    afterTwoConsecutive: number;
    thirdConsecutive: string;
    chargedAgainst: string;
    monthlyToken?: number;
  };
  topTrophy: { name: string; xp: number };
  library: {
    totalTasks: number;
    domains: number;
    groups: number;
    scoringTasks: number;
    streakOnlyTasks: number;
  };
  rewardModels: { key: string; label: string }[];
};

export type ChapterAccent = 'ember' | 'olive' | string;

export type Chapter = {
  key: ChapterKey;
  order: number;
  adultLabel: string;
  kidLabel: string;
  /** Adult spine accent role from JSON (ember / olive). */
  accent?: ChapterAccent;
  kidColor?: string;
};

export type AdultCopy = {
  headline: string;
  question: string;
  clause: string;
};

export type KidCopy = {
  headline: string;
  question: string;
  body: string;
};

export type HouseRule = {
  id: string;
  chapter: ChapterKey;
  order: number;
  condition: ConditionKey;
  phase: PhaseKey;
  visual: VisualKey;
  editable: boolean;
  settingKey?: string;
  adult: AdultCopy;
  kid: KidCopy;
};

export type Footnotes = {
  adult?: string;
  kid?: string | null;
  nextDay?: string;
  [key: string]: string | null | undefined;
};

export type HouseRulesDoc = {
  schemaVersion: string;
  contentVersion: string;
  constants: RuleConstants;
  chapters: Chapter[];
  rules: HouseRule[];
  footnotes?: Footnotes;
};

export type HouseRulesHouseholdView = {
  rewardModel?: string | null;
  helperCount: number;
  homeworkEnabled: boolean;
};
