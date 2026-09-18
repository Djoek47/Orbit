/**
 * Poppins act-token meter.
 *
 * User-facing unit = tokens (weighted acts). USD stays internal for COGS.
 * Provider rates: constants/poppins-ai-rates.ts. Retail prices: constants/billing.ts.
 */
import { IAP_PRODUCTS } from '@/constants/billing';
import {
  AI_TRIP_USD,
  COGS_CEILING_USD,
  MODEL_RATES_USD_PER_MILLION,
  TOKEN_WEIGHT_LIVE,
  TOKEN_WEIGHT_SILENT,
  TOKEN_WEIGHT_SPOKEN,
  TOKENS_PER_DAY,
  TOKENS_PER_MONTH,
  ratesForModel,
} from '@/constants/poppins-ai-rates';

export {
  AI_TRIP_USD,
  COGS_CEILING_USD,
  MODEL_RATES_USD_PER_MILLION,
  TOKEN_WEIGHT_LIVE,
  TOKEN_WEIGHT_SILENT,
  TOKEN_WEIGHT_SPOKEN,
  TOKENS_PER_DAY,
  TOKENS_PER_MONTH,
} from '@/constants/poppins-ai-rates';

/** 1 credit = $0.01 — internal envelope mapping only. */
export const CREDITS_PER_USD = 100;

/** Premium list price — context for pricing, not the trip threshold. */
export const PREMIUM_MONTHLY_USD = IAP_PRODUCTS.monthly.priceUsd;

export type AiUsageKind = 'chat' | 'voice' | 'briefing' | 'monitor' | 'notify' | 'realtime';

/** Act mode that weights token charge on commit. */
export type PoppinsActMode = 'silent' | 'spoken' | 'live';

export type AiUsageEvent = {
  id: string;
  at: string;
  memberId: string;
  memberName: string;
  kind: AiUsageKind;
  model: string;
  inputTokens: number;
  outputTokens: number;
  usd: number;
  /** Legacy; user meter is ActEvent. Prefer 0 on COGS rows. */
  tokens?: number;
  mode?: PoppinsActMode;
  cachedInputTokens?: number;
  audioInSeconds?: number;
  audioOutSeconds?: number;
  sessionId?: string;
  turnIndex?: number;
  durationMs?: number;
};

export type AiTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  model?: string;
};

export const POPPINS_PAUSED_COPY =
  'Poppins Speak is paused — you’ve used this period’s actions. Type still works. Actions reset on your billing date, or buy a top-up.';

export function tokenWeightForMode(mode: PoppinsActMode | undefined): number {
  switch (mode) {
    case 'live':
      return TOKEN_WEIGHT_LIVE;
    case 'spoken':
      return TOKEN_WEIGHT_SPOKEN;
    case 'silent':
    default:
      return TOKEN_WEIGHT_SILENT;
  }
}

function ratesFor(model: string): { input: number; output: number } {
  return ratesForModel(model);
}

export function usdForTokens(inputTokens: number, outputTokens: number, model: string): number {
  const rates = ratesFor(model);
  const usd =
    (Math.max(0, inputTokens) / 1_000_000) * rates.input +
    (Math.max(0, outputTokens) / 1_000_000) * rates.output;
  return roundUsd(usd);
}

export function estimateTokensFromText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

/** Voice without a usage payload — short realtime clip, conservative floor. */
export function estimateVoiceUsd(): number {
  return 0.06;
}

export function roundUsd(value: number): number {
  return Math.round(Math.max(0, value) * 10_000) / 10_000;
}

export function creditsFromUsd(usd: number): number {
  return Math.round(usd * CREDITS_PER_USD);
}

export type MemberAiSpend = {
  memberId: string;
  name: string;
  usd: number;
  tokens: number;
  events: number;
};

export type AiUsageSummary = {
  /** Internal COGS — never show to members. */
  householdUsd: number;
  remainingUsd: number;
  tokensUsedThisPeriod: number;
  tokensRemaining: number;
  tokensUsedToday: number;
  topUpBalance: number;
  periodResetsAt: string;
  /** Speak paused (daily or monthly cap). Type still works. */
  tripped: boolean;
  trippedAt: string | null;
  firstAt: string | null;
  /** Force Silent when measured COGS exceeds ceiling. */
  cogsBreaker: boolean;
  byMember: MemberAiSpend[];
};

export type SummarizeAiUsageOpts = {
  /** Billing-period anchor (ISO). Defaults to calendar month of `now`. */
  periodStart?: string;
  periodEnd?: string;
  now?: Date | string;
  /** Unused top-up tokens (never expire). */
  topUpBalance?: number;
  /** Local calendar day key YYYY-MM-DD for daily soft cap. */
  todayKey?: string;
};

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function nextUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

function localDayKey(iso: string, fallback: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString().slice(0, 10);
}

export function summarizeAiUsage(
  events: AiUsageEvent[],
  members: { id: string; name: string }[] = [],
  opts: SummarizeAiUsageOpts = {}
): AiUsageSummary {
  const now = opts.now ? new Date(opts.now) : new Date();
  const periodStart = opts.periodStart
    ? new Date(opts.periodStart)
    : startOfUtcMonth(now);
  const periodEnd = opts.periodEnd ? new Date(opts.periodEnd) : nextUtcMonth(now);
  const todayKey = opts.todayKey ?? now.toISOString().slice(0, 10);
  const topUpBalance = Math.max(0, Math.round(opts.topUpBalance ?? 0));

  const chronological = [...events].sort((a, b) => a.at.localeCompare(b.at));
  let householdUsd = 0;
  let tokensUsedThisPeriod = 0;
  let tokensUsedToday = 0;
  const totals = new Map<string, { name: string; usd: number; tokens: number; events: number }>();

  for (const event of chronological) {
    householdUsd = roundUsd(householdUsd + event.usd);
    const at = new Date(event.at);
    const inPeriod = !Number.isNaN(at.getTime()) && at >= periodStart && at < periodEnd;
    // COGS only — never invent act tokens from mode (ActEvent owns the user meter).
    const eventTokens = Math.max(0, Math.round(event.tokens ?? 0));
    if (inPeriod && eventTokens > 0) {
      tokensUsedThisPeriod += eventTokens;
      if (localDayKey(event.at, todayKey) === todayKey) {
        tokensUsedToday += eventTokens;
      }
    }

    const prev = totals.get(event.memberId) ?? {
      name: event.memberName,
      usd: 0,
      tokens: 0,
      events: 0,
    };
    totals.set(event.memberId, {
      name: event.memberName || prev.name,
      usd: roundUsd(prev.usd + event.usd),
      tokens: prev.tokens + (inPeriod ? eventTokens : 0),
      events: prev.events + 1,
    });
  }

  const monthlyRemaining = Math.max(0, TOKENS_PER_MONTH - tokensUsedThisPeriod);
  const dailyRemaining = Math.max(0, TOKENS_PER_DAY - tokensUsedToday);
  const tokensRemaining = Math.max(0, Math.min(monthlyRemaining, dailyRemaining) + topUpBalance);
  // Speak trip is owned by summarizeActUsage — COGS summary never pauses Speak.
  const tripped = false;
  const trippedAt: string | null = null;
  const cogsBreaker = householdUsd >= COGS_CEILING_USD;

  const byMember: MemberAiSpend[] = members.map((member) => {
    const row = totals.get(member.id);
    return {
      memberId: member.id,
      name: member.name,
      usd: row?.usd ?? 0,
      tokens: row?.tokens ?? 0,
      events: row?.events ?? 0,
    };
  });
  for (const [memberId, row] of totals) {
    if (byMember.some((item) => item.memberId === memberId)) continue;
    byMember.push({
      memberId,
      name: row.name || memberId,
      usd: row.usd,
      tokens: row.tokens,
      events: row.events,
    });
  }
  byMember.sort((a, b) => b.tokens - a.tokens || b.usd - a.usd);

  return {
    householdUsd,
    remainingUsd: roundUsd(Math.max(0, COGS_CEILING_USD - householdUsd)),
    tokensUsedThisPeriod,
    tokensRemaining,
    tokensUsedToday,
    topUpBalance,
    periodResetsAt: periodEnd.toISOString(),
    tripped,
    trippedAt,
    firstAt: chronological[0]?.at ?? null,
    cogsBreaker,
    byMember,
  };
}

export function personalUsd(summary: AiUsageSummary, memberId: string | null | undefined): number {
  if (!memberId) return 0;
  return summary.byMember.find((row) => row.memberId === memberId)?.usd ?? 0;
}

export function personalTokens(
  summary: AiUsageSummary,
  memberId: string | null | undefined
): number {
  if (!memberId) return 0;
  return summary.byMember.find((row) => row.memberId === memberId)?.tokens ?? 0;
}

/** True when Live would not cover ~10 more live acts. */
export function shouldDropLiveToSpoken(summary: {
  tokensRemaining: number;
}): boolean {
  return summary.tokensRemaining < TOKEN_WEIGHT_LIVE * 10;
}

export function meterNearCap(summary: {
  tokensUsedThisPeriod: number;
  tokensUsedToday: number;
}): boolean {
  return (
    summary.tokensUsedThisPeriod / TOKENS_PER_MONTH >= 0.8 ||
    summary.tokensUsedToday / TOKENS_PER_DAY >= 0.8
  );
}

export function mergeUsageEvents(local: AiUsageEvent[], remote: AiUsageEvent[]): AiUsageEvent[] {
  const byId = new Map<string, AiUsageEvent>();
  for (const event of [...local, ...remote]) {
    byId.set(event.id, event);
  }
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-400);
}

export function formatUsd(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

export function meterCaption(
  summary: {
    tripped: boolean;
    tokensUsedThisPeriod: number;
    tokensUsedToday: number;
  },
  personal: number,
  isAdmin: boolean
): string {
  if (summary.tripped) {
    return isAdmin
      ? `Paused · ${summary.tokensUsedThisPeriod} of ${TOKENS_PER_MONTH}`
      : 'Speak paused · type still works';
  }
  if (isAdmin) {
    return `${summary.tokensUsedThisPeriod} of ${TOKENS_PER_MONTH} this month · ${summary.tokensUsedToday} today`;
  }
  return personal > 0
    ? `${personal} of ${TOKENS_PER_DAY} today`
    : `0 of ${TOKENS_PER_DAY} today`;
}

export function buildUsageEvent(input: {
  memberId: string;
  memberName: string;
  kind: AiUsageKind;
  model: string;
  inputTokens: number;
  outputTokens: number;
  usd?: number;
  at?: string;
  id?: string;
  mode?: PoppinsActMode;
  tokens?: number;
  /** Charge act tokens (commit only). Reads / vetoes pass false. */
  chargeAct?: boolean;
  sessionId?: string;
  turnIndex?: number;
  durationMs?: number;
}): AiUsageEvent {
  const usd =
    input.usd != null
      ? roundUsd(input.usd)
      : usdForTokens(input.inputTokens, input.outputTokens, input.model);
  const mode = input.mode ?? 'silent';
  // Provider/COGS ledger — act tokens live on ActEvent (chargeAct ignored).
  const tokens = input.tokens != null ? Math.max(0, Math.round(input.tokens)) : 0;
  void input.chargeAct;
  return {
    id: input.id ?? `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: input.at ?? new Date().toISOString(),
    memberId: input.memberId,
    memberName: input.memberName,
    kind: input.kind,
    model: input.model,
    inputTokens: Math.max(0, Math.round(input.inputTokens)),
    outputTokens: Math.max(0, Math.round(input.outputTokens)),
    usd: usd > 0 ? usd : input.kind === 'voice' ? estimateVoiceUsd() : roundUsd(0.002),
    tokens,
    mode,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.turnIndex != null ? { turnIndex: Math.max(0, Math.round(input.turnIndex)) } : {}),
    ...(input.durationMs != null ? { durationMs: Math.max(0, Math.round(input.durationMs)) } : {}),
  };
}
