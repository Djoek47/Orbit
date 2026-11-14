/**
 * Custom house rules are family conventions only.
 * They must not alter scoring, XP, allowance, streaks, or any app mechanic.
 */

export const CUSTOM_HOUSE_RULE_MAX_LEN = 500;
export const CUSTOM_HOUSE_RULE_MAX_COUNT = 10;

export type CustomHouseRule = {
  id: string;
  body: string;
  sortOrder: number;
};

export function newCustomHouseRuleId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const n = (Math.random() * 16) | 0;
    const v = ch === 'x' ? n : (n & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function validateCustomHouseRule(
  body: string,
  existingCount: number
): { ok: true; body: string } | { ok: false; message: string } {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, message: 'Rule cannot be empty.' };
  if (trimmed.length > CUSTOM_HOUSE_RULE_MAX_LEN) {
    return { ok: false, message: `Keep it under ${CUSTOM_HOUSE_RULE_MAX_LEN} characters.` };
  }
  if (existingCount >= CUSTOM_HOUSE_RULE_MAX_COUNT) {
    return { ok: false, message: `Up to ${CUSTOM_HOUSE_RULE_MAX_COUNT} custom rules.` };
  }
  return { ok: true, body: trimmed };
}
