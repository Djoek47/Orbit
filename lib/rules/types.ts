/**
 * House Rules typed models — 1:1 with data/house-rules.json v4.
 * Spec: docs/logic/CURSOR-SPEC-house-rules.md
 */

export const CONDITION_KEYS = [
  'ALWAYS',
  'XP_ON',
  'ALLOWANCE_ON',
  'REWARDS_ON',
  'MULTI_SIDEKICK',
  'SOLO_SIDEKICK',
  'ALLOWANCE_REQUESTS_ON',
  'HOMEWORK_ON',
] as const;
export type ConditionKey = (typeof CONDITION_KEYS)[number];

export const VISUAL_KEYS = [
  'none',
  'xpRamp',
  'dayTimeline',
  'lateCreditTable',
  'streakDots',
  'rescueTiers',
  'podium',
  'modelList',
  'gateSteps',
  'frequencyGrid',
  'trophyScale',
  'zeroXpShare',
  'inviteFacts',
  'expiryWindow',
  'weekTrend',
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

export type HouseRulesVoice = 'admin' | 'sidekick';

export type RuleConstants = {
  xpValues: number[];
  lateCredit: Record<string, number>;
  bundleBonusOnTime: number;
  bundleBonusLate: number;
  deadlines: {
    default: string;
    weeklyDay: string;
    monthlyDay: string;
    timezone: string;
    configurable: boolean;
  };
  expiryTime: string;
  expiredPurgeDays: number;
  nudgeMinutesBefore: number;
  frequencyCount: number;
  primaryFrequencies: string[];
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
  };
  topTrophy: { name: string; xp: number };
  invites: {
    expiryDays: number;
    singleUse: boolean;
    activePerMember: number;
    regenerableByAdmin: boolean;
  };
  library: {
    totalTasks: number;
    domains: number;
    groups: number;
    scoringTasks: number;
    streakOnlyTasks: number;
  };
  rewardModels: { key: string; label: string }[];
};

export type Chapter = {
  key: ChapterKey;
  order: number;
  adminLabel: string;
  sidekickLabel: string;
  accent?: string;
  sidekickColor?: string;
};

export type AdminCopy = {
  headline: string;
  clause: string;
};

export type SidekickCopy = {
  headline: string;
  body: string;
};

export type HouseRule = {
  id: string;
  chapter: ChapterKey;
  order: number;
  condition: ConditionKey;
  visual: VisualKey;
  editable: boolean;
  settingKey?: string;
  admin: AdminCopy;
  sidekick: SidekickCopy;
};

export type HouseRulesModes = {
  admin: {
    defaultVersion: 'admin' | 'sidekick';
    switcherVisible: boolean;
    mayViewSidekickVersion: boolean;
  };
  sidekick: {
    defaultVersion: 'admin' | 'sidekick';
    switcherVisible: boolean;
    mayViewAdminVersion: boolean;
  };
};

export type DailyDeadlineSetting = {
  label: string;
  help: string;
  default: string;
  min: string;
  max: string;
  stepMinutes: number;
  appliesTo: string[];
  takesEffect: string;
  editableBy: string;
};

export type AllowanceRequestsSetting = {
  label: string;
  help: string;
  default: boolean;
  editableBy: string;
  requires: string;
};

export type HouseRulesSettings = {
  dailyDeadline: DailyDeadlineSetting;
  allowanceRequests: AllowanceRequestsSetting;
};

export type Footnotes = {
  admin?: string | null;
  sidekick?: string | null;
};

export type HouseRulesDoc = {
  schemaVersion: string;
  contentVersion: string;
  constants: RuleConstants;
  chapters: Chapter[];
  rules: HouseRule[];
  modes: HouseRulesModes;
  settings: HouseRulesSettings;
  footnotes?: Footnotes;
};

export type HouseRulesHouseholdView = {
  rewardModel?: string | null;
  sidekickCount: number;
  homeworkEnabled: boolean;
  allowanceRequestsEnabled: boolean;
  dailyDeadline?: string | null;
  use24h?: boolean;
};
