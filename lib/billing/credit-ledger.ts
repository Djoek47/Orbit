/**
 * The credit balance, and where it came from.
 *
 * Two different things share one screen today and shouldn't:
 *
 *   actions   the month's allowance. It resets on the 1st. Spending is what the breakdown
 *             charts show.
 *   credits   bought, banked, and **never expiring**. They carry from month to month and are
 *             only drawn on once the month's actions are gone.
 *
 * Pure: the ledger rows come from lib/billing/token-grants (AsyncStorage + Supabase), and this
 * turns them into the numbers a person reads.
 */
import { TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import type { TokenGrantBalance } from '@/lib/billing/token-grants-math';

export type CreditLedgerRow = {
  id: string;
  /** "600 actions" — what the pack was called when it was bought. */
  pack: string;
  granted: number;
  spent: number;
  left: number;
  at: string;
};

/** Friendly ledger label for a stored pack key (`small` / `medium` / …). */
export function creditPackLabel(pack: string, tokens: number): string {
  const key = pack.trim().toLowerCase();
  if (key === 'small' || key === 'tokenssmall') return '200 actions';
  if (key === 'medium' || key === 'tokensmedium') return '600 actions';
  if (key === 'large' || key === 'tokenslarge') return '1500 actions';
  if (/\d+\s*actions?/i.test(pack)) return pack;
  if (tokens > 0) return `${tokens} actions`;
  return pack || 'Top-up';
}

export type CreditSummary = {
  /** Bought and still unspent. Carries over — this never resets. */
  balance: number;
  /** Everything ever bought. */
  lifetimePurchased: number;
  /** Of that, how much has been used. */
  lifetimeSpent: number;
  /** This month's allowance left, which does reset. */
  monthlyLeft: number;
  /** Allowance + credits: what can actually be spent right now. */
  totalAvailable: number;
  rows: CreditLedgerRow[];
};

function remaining(grant: TokenGrantBalance): number {
  return Math.max(0, grant.tokens - grant.consumed);
}

export function summarizeCredits(
  grants: TokenGrantBalance[],
  monthUsed: number
): CreditSummary {
  const rows: CreditLedgerRow[] = [...grants]
    .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))
    .map((grant) => ({
      id: grant.id,
      pack: creditPackLabel(grant.pack, grant.tokens),
      granted: grant.tokens,
      spent: Math.min(grant.tokens, Math.max(0, grant.consumed)),
      left: remaining(grant),
      at: grant.grantedAt,
    }));

  const balance = rows.reduce((sum, row) => sum + row.left, 0);
  const lifetimePurchased = rows.reduce((sum, row) => sum + row.granted, 0);
  const lifetimeSpent = rows.reduce((sum, row) => sum + row.spent, 0);
  const monthlyLeft = Math.max(0, TOKENS_PER_MONTH - Math.max(0, Math.round(monthUsed)));

  return {
    balance,
    lifetimePurchased,
    lifetimeSpent,
    monthlyLeft,
    totalAvailable: monthlyLeft + balance,
    rows,
  };
}

/** The day the month's allowance comes back. Credits are untouched by it. */
export function nextAllowanceReset(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

export function formatResetDate(now = new Date()): string {
  const next = nextAllowanceReset(now);
  const month = next.toLocaleString(undefined, { month: 'short' });
  return `${month} ${next.getDate()}`;
}

/**
 * Which pot pays for the next spend. The month's allowance goes first, so bought credits sit
 * untouched for as long as possible.
 */
export function spendsFrom(summary: CreditSummary): 'allowance' | 'credits' | 'none' {
  if (summary.monthlyLeft > 0) return 'allowance';
  if (summary.balance > 0) return 'credits';
  return 'none';
}
