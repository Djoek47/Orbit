/**
 * Edge copy of constants/poppins-ai-rates.ts — keep in sync.
 * MEASURED = OpenAI public pricing Sep 2026. ESTIMATED = fallback.
 */

export type ModelTokenRate = {
  input: number;
  output: number;
  source: 'MEASURED' | 'ESTIMATED';
};

export const MODEL_RATES_USD_PER_MILLION: Record<string, ModelTokenRate> = {
  'gpt-5.6-luna': { input: 0.2, output: 1.2, source: 'MEASURED' },
  'gpt-5.6-terra': { input: 2, output: 12, source: 'MEASURED' },
  'gpt-4o': { input: 2.5, output: 10, source: 'MEASURED' },
  'gpt-4o-mini': { input: 0.15, output: 0.6, source: 'MEASURED' },
  'gpt-4o-mini-transcribe': { input: 1.25, output: 0, source: 'MEASURED' },
  'gpt-realtime-2.1': { input: 32, output: 64, source: 'MEASURED' },
  default: { input: 0.2, output: 1.2, source: 'MEASURED' },
};

export const POPPINS_MONITOR_MODEL_CALLS_PER_DAY = 3;
export const POPPINS_MONITOR_MAX_ROUNDS = 2;
export const POPPINS_MONITOR_MODEL_DEFAULT = 'off';
export const POPPINS_ACTS_PER_DAY_DEFAULT = 300;
/** Local hours (household TZ) when monitor may call the model. */
export const POPPINS_MONITOR_ACTIVE_HOURS = [8, 15, 18, 20] as const;

/**
 * Realtime truncation post_instructions ceiling (ESTIMATED ~2 audio turns).
 * Keep in sync with constants/poppins-ai-rates.ts.
 */
export const REALTIME_POST_INSTRUCTIONS_TOKEN_LIMIT = 4000;

export function ratesForModel(model: string): { input: number; output: number } {
  const key = model.trim() || 'default';
  const row = MODEL_RATES_USD_PER_MILLION[key] ?? MODEL_RATES_USD_PER_MILLION.default;
  return { input: row.input, output: row.output };
}

export function usdForTokens(inputTokens: number, outputTokens: number, model: string): number {
  const rates = ratesForModel(model);
  const usd =
    (Math.max(0, inputTokens) / 1_000_000) * rates.input +
    (Math.max(0, outputTokens) / 1_000_000) * rates.output;
  return Math.round(Math.max(0, usd) * 10_000) / 10_000;
}

/** POPPINS_MONITOR_MODEL secret: on | 1 | true enables model loop. Default off. */
export function isMonitorModelEnabled(): boolean {
  const raw = (Deno.env.get('POPPINS_MONITOR_MODEL') ?? POPPINS_MONITOR_MODEL_DEFAULT).trim().toLowerCase();
  return raw === 'on' || raw === '1' || raw === 'true';
}

export function getActsPerDayCap(): number {
  const raw = Deno.env.get('POPPINS_ACTS_PER_DAY');
  const n = raw ? Number(raw) : POPPINS_ACTS_PER_DAY_DEFAULT;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : POPPINS_ACTS_PER_DAY_DEFAULT;
}
