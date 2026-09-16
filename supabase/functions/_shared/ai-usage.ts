/**
 * Append-only ai_usage_events writer for edge functions.
 * client_key must be unique globally (migration drops household+client_key unique).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { usdForTokens } from './openai-rates.ts';

export type AiUsageKindEdge =
  | 'chat'
  | 'voice'
  | 'briefing'
  | 'monitor'
  | 'notify'
  | 'realtime';

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function recordAiUsageEvent(input: {
  householdId: string;
  clientKey: string;
  memberId?: string | null;
  memberName?: string | null;
  kind: AiUsageKindEdge;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  audioInputSeconds?: number;
  audioOutputSeconds?: number;
  surface?: string | null;
  mode?: string | null;
  usd?: number;
  occurredAt?: string;
}): Promise<void> {
  const supabase = serviceClient();
  if (!supabase || !input.householdId) return;

  const inputTokens = Math.max(0, Math.round(input.inputTokens ?? 0));
  const outputTokens = Math.max(0, Math.round(input.outputTokens ?? 0));
  const usd =
    input.usd != null
      ? input.usd
      : usdForTokens(inputTokens, outputTokens, input.model || 'gpt-5.6-luna');

  const row = {
    household_id: input.householdId,
    client_key: input.clientKey,
    member_id: input.memberId?.trim() || 'system',
    member_name: input.memberName?.trim() || 'Poppins',
    kind: input.kind,
    model: input.model || '',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cached_input_tokens: Math.max(0, Math.round(input.cachedInputTokens ?? 0)),
    audio_input_seconds: Number(input.audioInputSeconds ?? 0) || 0,
    audio_output_seconds: Number(input.audioOutputSeconds ?? 0) || 0,
    surface: input.surface ?? null,
    mode: input.mode ?? null,
    usd,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  };

  try {
    const { error } = await supabase.from('ai_usage_events').upsert(row, {
      onConflict: 'client_key',
      ignoreDuplicates: true,
    });
    if (error) console.warn('recordAiUsageEvent', error.message);
  } catch (error) {
    console.warn('recordAiUsageEvent failed', error);
  }
}

export function usageFromOpenAIPayload(payload: Record<string, unknown> | null | undefined): {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
} {
  const usage = (payload?.usage ?? {}) as Record<string, unknown>;
  const prompt = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const completion = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  const cached = Number(
    (usage.prompt_tokens_details as { cached_tokens?: number } | undefined)?.cached_tokens ??
      usage.cached_tokens ??
      0
  );
  return {
    inputTokens: Number.isFinite(prompt) ? prompt : 0,
    outputTokens: Number.isFinite(completion) ? completion : 0,
    cachedInputTokens: Number.isFinite(cached) ? cached : 0,
  };
}
