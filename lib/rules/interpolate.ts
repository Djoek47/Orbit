import type { HouseRulesHouseholdView, RuleConstants } from '@/lib/rules/types';

/** Format JSON `HH:mm` for the household clock. Never hardcode 7:00 PM in views. */
export function formatHouseRulesTime(hhmm: string, use24h = false): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h)) return hhmm;
  if (use24h) {
    return `${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
  }
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}

export function resolvedDailyDeadline(
  constants: RuleConstants,
  household?: Pick<HouseRulesHouseholdView, 'dailyDeadline'> | null
): string {
  return household?.dailyDeadline?.trim() || constants.deadlines.default;
}

export function houseRulesTokens(
  constants: RuleConstants,
  household?: HouseRulesHouseholdView | null
): Record<string, string> {
  const use24h = Boolean(household?.use24h);
  return {
    dailyDeadline: formatHouseRulesTime(resolvedDailyDeadline(constants, household), use24h),
    expiryTime: formatHouseRulesTime(constants.expiryTime, use24h),
  };
}

/** Replace `{token}` wholes. Unknown tokens raise — never blank, never leftover braces. */
export function tok(text: string, tokens: Record<string, string>): string {
  if (!text) return text;
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in tokens)) throw new Error(`Unknown token: ${key}`);
    return tokens[key]!;
  });
}

export function interpolateHouseRulesCopy(
  text: string,
  constants: RuleConstants,
  household?: HouseRulesHouseholdView | null
): string {
  return tok(text, houseRulesTokens(constants, household));
}
