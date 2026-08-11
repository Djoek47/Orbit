/**
 * Shared props for House Rules visual widgets.
 * Driven only by JSON constants + rule fields — no hardcoded XP.
 */
import type { RuleConstants } from '@/lib/rules/types';
import type { HouseRulesPalette } from '@/lib/rules/house-rules-palette';

export type VisualWidgetProps = {
  constants: RuleConstants;
  palette: HouseRulesPalette;
  voice: 'adult' | 'kid';
};
