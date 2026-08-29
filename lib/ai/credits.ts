/**
 * Poppins AI spend meter.
 *
 * $4.99/month is pricing context only (Premium). The test trip is $4.00:
 * when the household hits that, Poppins goes off so we can time how long
 * $4 of real use lasts. Admins see per-person totals — not OpenAI's global view.
 */

import { IAP_PRODUCTS } from '@/constants/billing';

/** 1 credit = $0.01. Kept so a later envelope can map 499 credits ≈ $4.99. */
export const CREDITS_PER_USD = 100;

/** Premium list price — context for pricing, not the trip threshold. */
export const PREMIUM_MONTHLY_USD = IAP_PRODUCTS.monthly.priceUsd;

/** Household Poppins pauses at this spend so we can measure duration. */
export const AI_TRIP_USD = 4;

export type AiUsageKind = 'chat' | 'voice' | 'briefing';

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
};

export type AiTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  model?: string;
};

/** USD per 1M tokens. Tunable estimates until OpenAI invoices a real mix. */
export const MODEL_RATES_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  'gpt-5.6-luna': { input: 5, output: 15 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o-mini-transcribe': { input: 1.25, output: 0 },
  'gpt-realtime-2.1': { input: 32, output: 64 },
  default: { input: 5, output: 15 },
};

export const POPPINS_PAUSED_COPY =
  'Poppins is paused for this household. You’ve used $4 of AI, so we can see how long that lasts.';

function ratesFor(model: string): { input: number; output: number } {
  const key = model.trim() || 'default';
  return MODEL_RATES_USD_PER_MILLION[key] ?? MODEL_RATES_USD_PER_MILLION.default;
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
  events: number;
};

export type AiUsageSummary = {
  householdUsd: number;
  remainingUsd: number;
  tripped: boolean;
  trippedAt: string | null;
  firstAt: string | null;
  byMember: MemberAiSpend[];
};

export function summarizeAiUsage(
  events: AiUsageEvent[],
  members: { id: string; name: string }[] = []
): AiUsageSummary {
  const chronological = [...events].sort((a, b) => a.at.localeCompare(b.at));
  let householdUsd = 0;
  let trippedAt: string | null = null;
  const totals = new Map<string, { name: string; usd: number; events: number }>();

  for (const event of chronological) {
    householdUsd = roundUsd(householdUsd + event.usd);
    if (!trippedAt && householdUsd >= AI_TRIP_USD) trippedAt = event.at;
    const prev = totals.get(event.memberId) ?? {
      name: event.memberName,
      usd: 0,
      events: 0,
    };
    totals.set(event.memberId, {
      name: event.memberName || prev.name,
      usd: roundUsd(prev.usd + event.usd),
      events: prev.events + 1,
    });
  }

  const byMember: MemberAiSpend[] = members.map((member) => {
    const row = totals.get(member.id);
    return {
      memberId: member.id,
      name: member.name,
      usd: row?.usd ?? 0,
      events: row?.events ?? 0,
    };
  });
  for (const [memberId, row] of totals) {
    if (byMember.some((item) => item.memberId === memberId)) continue;
    byMember.push({ memberId, name: row.name || memberId, usd: row.usd, events: row.events });
  }
  byMember.sort((a, b) => b.usd - a.usd);

  return {
    householdUsd,
    remainingUsd: roundUsd(Math.max(0, AI_TRIP_USD - householdUsd)),
    tripped: householdUsd >= AI_TRIP_USD,
    trippedAt,
    firstAt: chronological[0]?.at ?? null,
    byMember,
  };
}

export function personalUsd(summary: AiUsageSummary, memberId: string | null | undefined): number {
  if (!memberId) return 0;
  return summary.byMember.find((row) => row.memberId === memberId)?.usd ?? 0;
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

export function meterCaption(summary: AiUsageSummary, personal: number, isAdmin: boolean): string {
  if (summary.tripped) {
    return isAdmin
      ? `Paused · ${formatUsd(summary.householdUsd)} used`
      : 'Poppins is paused for this household';
  }
  if (isAdmin) {
    return `${formatUsd(summary.householdUsd)} of ${formatUsd(AI_TRIP_USD)}`;
  }
  return personal > 0 ? `${formatUsd(personal)} this month` : 'No Poppins use yet';
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
}): AiUsageEvent {
  const usd =
    input.usd != null
      ? roundUsd(input.usd)
      : usdForTokens(input.inputTokens, input.outputTokens, input.model);
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
  };
}
