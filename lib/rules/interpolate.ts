import type { RuleConstants } from '@/lib/rules/types';

/** Format JSON `HH:mm` deadlines for display. Never hardcode 7:00 PM in views. */
export function formatHouseRulesTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}

export function interpolateHouseRulesCopy(text: string, constants: RuleConstants): string {
  const daily = formatHouseRulesTime(constants.deadlines.daily);
  const expiry = formatHouseRulesTime(constants.expiryTime);
  return text
    .replaceAll('{dailyDeadline}', daily)
    .replaceAll('{expiryTime}', expiry)
    .replaceAll('{nudgeMinutesBefore}', String(constants.nudgeMinutesBefore));
}
