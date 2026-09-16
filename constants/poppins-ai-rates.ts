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
 * Household measurement trip (ESTIMATED probe, not a product budget).
 * Spec: docs/poppins-pricing-and-metering.md supersedes treating this as retail COGS.
 */
export const AI_TRIP_USD = 4;

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
export const POPPINS_ACTS_PER_DAY_DEFAULT = 30;

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
