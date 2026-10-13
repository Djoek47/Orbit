/**
 * Pure top-up math — no AsyncStorage / Supabase (unit-testable in Node).
 *
 * Bought credits accumulate forever: each purchase is a grant row. Nothing here
 * expires or resets a balance on the 1st — only `consumed` shrinks remaining.
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

function isLocalOnlyGrantId(id: string): boolean {
  return id.startsWith('mock-') || id.startsWith('local-');
}

/**
 * Merge local cache + remote ledger by transactionId.
 * Keeps offline/mock grants that never reached the server, and never lets an
 * empty remote list wipe banked credits.
 */
export function mergeTokenGrants(
  local: TokenGrantBalance[],
  remote: TokenGrantBalance[]
): TokenGrantBalance[] {
  const byTxn = new Map<string, TokenGrantBalance>();

  const prefer = (a: TokenGrantBalance, b: TokenGrantBalance): TokenGrantBalance => {
    const aLocal = isLocalOnlyGrantId(a.id);
    const bLocal = isLocalOnlyGrantId(b.id);
    const id = !aLocal ? a.id : !bLocal ? b.id : a.id;
    const pack = a.pack !== 'mock' ? a.pack : b.pack;
    const tokens = Math.max(a.tokens, b.tokens);
    const consumed = Math.min(tokens, Math.max(a.consumed, b.consumed));
    const grantedAt = a.grantedAt <= b.grantedAt ? a.grantedAt : b.grantedAt;
    return {
      id,
      householdId: a.householdId || b.householdId,
      pack,
      tokens,
      consumed,
      transactionId: a.transactionId || b.transactionId,
      grantedAt,
    };
  };

  for (const grant of [...local, ...remote]) {
    if (!grant.transactionId) continue;
    const prev = byTxn.get(grant.transactionId);
    byTxn.set(grant.transactionId, prev ? prefer(prev, grant) : grant);
  }

  return [...byTxn.values()].sort((a, b) => a.grantedAt.localeCompare(b.grantedAt));
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
