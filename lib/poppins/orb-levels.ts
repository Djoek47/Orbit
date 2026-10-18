/**
 * WO13 — orb credit levels. Water = day left; drain preview = post-commit level.
 * Water is never painted in a domain colour (tint stays voice/majordomo).
 */
import {
  TOKEN_WEIGHT_QUIET,
  TOKEN_WEIGHT_SPEAK_BACK,
  TOKENS_PER_DAY,
} from '@/constants/poppins-ai-rates';
import type { SessionActMode } from '@/lib/poppins/session-act-mode';

/** Below this fill the water goes amber — empty glass, not a red error. */
export const ORB_AMBER_THRESHOLD = 0.15;

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Water height 0–1 from actions left today. */
export function waterFillFromDaily(dailyLeft: number, tokensPerDay = TOKENS_PER_DAY): number {
  if (tokensPerDay <= 0) return 0;
  return clamp01(dailyLeft / tokensPerDay);
}

/**
 * Turn cost in act tokens.
 * Grouped / batch cards still cost one act (WO11 §2.3 / WO13 A4).
 */
export function turnActCost(mode: SessionActMode, _groupedActs = 1): number {
  const base = mode === 'spoken' ? TOKEN_WEIGHT_SPEAK_BACK : TOKEN_WEIGHT_QUIET;
  // Explicit: group size does not multiply — one card, one act.
  return base;
}

/** Where the water will sit after commit: dailyFill − cost/TOKENS_PER_DAY, clamped. */
export function drainPreviewFill(
  dailyFill: number,
  cost: number,
  tokensPerDay = TOKENS_PER_DAY
): number {
  if (tokensPerDay <= 0) return 0;
  return clamp01(dailyFill - cost / tokensPerDay);
}

export function waterIsAmber(fill: number): boolean {
  return clamp01(fill) > 0 && clamp01(fill) < ORB_AMBER_THRESHOLD;
}

export function waterIsEmpty(fill: number): boolean {
  return clamp01(fill) <= 0;
}
