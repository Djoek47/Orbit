/**
 * Poppins AI provider rates and operational caps.
 *
 * MEASURED = verified against OpenAI public pricing (Sep 2026 short context).
 * ESTIMATED = useful fallback; re-check after invoices.
 *
 * Do not put retail subscription prices here — those live in constants/billing.ts.
 * Keep supabase/functions/_shared/openai-rates.ts in sync with this file.
 */

export type ModelTokenRate = {
  /** USD per 1M input tokens */
  input: number;
  /** USD per 1M output tokens */
  output: number;
  /** MEASURED | ESTIMATED */
  source: 'MEASURED' | 'ESTIMATED';
};

/** USD per 1M tokens — short-context / audio rates as used by our meter. */
export const MODEL_RATES_USD_PER_MILLION: Record<string, ModelTokenRate> = {
  // MEASURED — OpenAI cut Luna 80% on 2026-07-30 (was wrongly {5,15} in credits.ts).
  'gpt-5.6-luna': { input: 0.2, output: 1.2, source: 'MEASURED' },
  // MEASURED — OpenAI pricing page Sep 2026.
  'gpt-5.6-terra': { input: 2, output: 12, source: 'MEASURED' },
  'gpt-4o': { input: 2.5, output: 10, source: 'MEASURED' },
  'gpt-4o-mini': { input: 0.15, output: 0.6, source: 'MEASURED' },
  // MEASURED text-token input; audio also has per-minute pricing not modeled here.
  'gpt-4o-mini-transcribe': { input: 1.25, output: 0, source: 'MEASURED' },
  // MEASURED audio modality for Realtime 2.1 (text Realtime is cheaper).
  'gpt-realtime-2.1': { input: 32, output: 64, source: 'MEASURED' },
  // Unknown model keys fall back to Luna (MEASURED), not the old 25x rates.
  default: { input: 0.2, output: 1.2, source: 'MEASURED' },
};

/** Cached input ≈ 10% of standard input (MEASURED OpenAI cache pricing). */
export const CACHED_INPUT_RATE_FRACTION = 0.1;

/**
 * Household measurement trip — kept for legacy COGS probes only.
 * User-facing caps are TOKENS_PER_* below.
 */
export const AI_TRIP_USD = 4;

/** Private circuit breaker: force Silent + log when measured COGS exceeds this. */
export const COGS_CEILING_USD = 1.2;

/** Included act tokens per billing period (remote-config shaped). */
export const TOKENS_PER_MONTH = 300;

/**
 * Soft daily cap (remote-config shaped).
 * Must stay >= TOKEN_WEIGHT_SPEAK_BACK so a single Speak-back act is expensive, not impossible.
 * Do not change TOKENS_PER_MONTH / TOKENS_PER_DAY here — pricing is a human decision.
 */
export const TOKENS_PER_DAY = 300;

/**
 * Token weights by transport that actually ran.
 * 1 token = one Quiet act (definition).
 *
 * TOKEN_WEIGHT_SPEAK_BACK:
 *   Numerator MEASURED 2026-09-20 — 5 Speak-back acts ≈ $0.26 → ~$0.052/act.
 *   Denominator ESTIMATED Quiet ≈ $0.0015/act → 0.052 / 0.0015 ≈ 35.
 *   Re-measure Quiet after Quiet ships; see docs/poppins-pricing-and-metering.md.
 */
export const TOKEN_WEIGHT_QUIET = 1;
export const TOKEN_WEIGHT_SPEAK_BACK = 35;

/** @deprecated Use TOKEN_WEIGHT_QUIET */
export const TOKEN_WEIGHT_SILENT = TOKEN_WEIGHT_QUIET;
/** @deprecated Use TOKEN_WEIGHT_SPEAK_BACK — legacy Spoken weight collapsed */
export const TOKEN_WEIGHT_SPOKEN = TOKEN_WEIGHT_SPEAK_BACK;
/** @deprecated Use TOKEN_WEIGHT_SPEAK_BACK — stored `live` migrates to `spoken` */
export const TOKEN_WEIGHT_LIVE = TOKEN_WEIGHT_SPEAK_BACK;

/**
 * Realtime session truncation: max post-instruction conversation tokens.
 * ESTIMATED ~2 audio turns — not a turn-count API (OpenAI retention_ratio only).
 * Mirror in supabase/functions/_shared/openai-rates.ts.
 */
export const REALTIME_POST_INSTRUCTIONS_TOKEN_LIMIT = 4000;

/** Daily model calls allowed for poppins-monitor when POPPINS_MONITOR_MODEL=on. */
export const POPPINS_MONITOR_MODEL_CALLS_PER_DAY = 3;

/** Max Chat Completions rounds inside one monitor model pass. */
export const POPPINS_MONITOR_MAX_ROUNDS = 2;

/**
 * Remote-config defaults (Supabase secrets / edge env).
 * POPPINS_MONITOR_MODEL: off | on — rules-only when off.
 * POPPINS_ACTS_PER_DAY: act meter cap (UI follow-up; default 30).
 */
export const POPPINS_MONITOR_MODEL_DEFAULT = 'off' as const;
export const POPPINS_ACTS_PER_DAY_DEFAULT = 300;

/**
 * Four local-day slots for monitor cadence (hour in household timezone, 0–23).
 * ESTIMATED product windows — not billing dollars.
 */
export const POPPINS_MONITOR_ACTIVE_HOURS = [8, 15, 18, 20] as const;

export function ratesForModel(model: string): { input: number; output: number } {
  const key = model.trim() || 'default';
  const row = MODEL_RATES_USD_PER_MILLION[key] ?? MODEL_RATES_USD_PER_MILLION.default;
  return { input: row.input, output: row.output };
}

if (TOKENS_PER_DAY < TOKEN_WEIGHT_SPEAK_BACK) {
  throw new Error(
    `TOKENS_PER_DAY (${TOKENS_PER_DAY}) must be >= TOKEN_WEIGHT_SPEAK_BACK (${TOKEN_WEIGHT_SPEAK_BACK})`
  );
}
