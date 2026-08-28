/**
 * Shared props for House Rules visual widgets.
 * Driven only by JSON constants + household values — no hardcoded XP.
 */
import type { HouseRulesPalette, HouseRulesVoice } from '@/lib/rules/house-rules-palette';
import type { RuleConstants } from '@/lib/rules/types';

export type VisualWidgetProps = {
  constants: RuleConstants;
  palette: HouseRulesPalette;
  voice: HouseRulesVoice;
  activeRewardModel?: string;
  dailyDeadline?: string;
  use24h?: boolean;
};
