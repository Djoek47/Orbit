/**
 * Pure top-up math — no AsyncStorage / Supabase (unit-testable in Node).
 */
export type TokenGrantBalance = {
  id: string;
  householdId: string;
  pack: string;
  tokens: number;
  consumed: number;
  transactionId: string;
  grantedAt: string;
};

function remainingOf(grant: TokenGrantBalance): number {
  return Math.max(0, grant.tokens - grant.consumed);
}

export function topUpBalanceFromGrants(grants: TokenGrantBalance[]): number {
  return grants.reduce((sum, g) => sum + remainingOf(g), 0);
}

/** Consume against top-ups oldest-first. Returns tokens actually consumed. */
export function applyTopUpConsumption(
  grants: TokenGrantBalance[],
  amount: number
): { grants: TokenGrantBalance[]; consumed: number } {
  let left = Math.max(0, Math.round(amount));
  if (left <= 0) return { grants, consumed: 0 };
  const sorted = [...grants].sort((a, b) => a.grantedAt.localeCompare(b.grantedAt));
  let consumed = 0;
  const next = sorted.map((grant) => {
    if (left <= 0) return grant;
    const avail = remainingOf(grant);
    if (avail <= 0) return grant;
    const take = Math.min(avail, left);
    left -= take;
    consumed += take;
    return { ...grant, consumed: grant.consumed + take };
  });
  return { grants: next, consumed };
}
