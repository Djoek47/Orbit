/**
 * Shared props for House Rules visual widgets.
 * Driven only by JSON constants + rule fields — no hardcoded XP.
 */
import type { HouseRulesPalette, HouseRulesVoice } from '@/lib/rules/house-rules-palette';
import type { RuleConstants } from '@/lib/rules/types';

export type VisualWidgetProps = {
  constants: RuleConstants;
  palette: HouseRulesPalette;
  voice: HouseRulesVoice;
  /** lateCreditTable: pills in Chapters/Track, table in At a glance. */
  variant?: 'pills' | 'table';
  /** JSON rewardModels key for the active household, already normalized. */
  activeRewardModel?: string;
};
