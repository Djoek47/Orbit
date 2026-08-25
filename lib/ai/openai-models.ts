/**
 * Canonical OpenAI model IDs for Poppins (Realtime + cheap text twin).
 * Edge mirrors read Deno.env; client uses EXPO_PUBLIC_* only for feature gates.
 */

export const DEFAULT_OPENAI_REALTIME_MODEL = 'gpt-realtime-2.1';
export const DEFAULT_OPENAI_POPPINS_CHAT_MODEL = 'gpt-5.6-luna';
export const DEFAULT_OPENAI_INPUT_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';

export type RealtimeReasoningEffort =
  | 'off'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh';

export function getOpenAIRealtimeModel(env: Record<string, string | undefined> = process.env): string {
  return (env.OPENAI_REALTIME_MODEL ?? DEFAULT_OPENAI_REALTIME_MODEL).trim() || DEFAULT_OPENAI_REALTIME_MODEL;
}

export function getOpenAIPoppinsChatModel(
  env: Record<string, string | undefined> = process.env
): string {
  return (
    (env.OPENAI_POPPINS_CHAT_MODEL ?? DEFAULT_OPENAI_POPPINS_CHAT_MODEL).trim() ||
    DEFAULT_OPENAI_POPPINS_CHAT_MODEL
  );
}

/** `auto` = allow personality effort; `off` = omit reasoning; `on` = force at least low. */
export function getOpenAIRealtimeReasoningMode(
  env: Record<string, string | undefined> = process.env
): 'auto' | 'on' | 'off' {
  const raw = (env.OPENAI_REALTIME_REASONING ?? 'auto').trim().toLowerCase();
  if (raw === 'off' || raw === 'on') return raw;
  return 'auto';
}

export function realtimeModelSupportsReasoning(model: string): boolean {
  return /gpt-realtime-2(\.|$)/i.test(model);
}

export function resolveRealtimeReasoningEffort(
  personalityEffort: RealtimeReasoningEffort | undefined,
  env: Record<string, string | undefined> = process.env
): Exclude<RealtimeReasoningEffort, 'off'> | null {
  const mode = getOpenAIRealtimeReasoningMode(env);
  const model = getOpenAIRealtimeModel(env);
  if (!realtimeModelSupportsReasoning(model) || mode === 'off') return null;
  if (!personalityEffort || personalityEffort === 'off') {
    return mode === 'on' || mode === 'auto' ? 'low' : null;
  }
  return personalityEffort;
}
