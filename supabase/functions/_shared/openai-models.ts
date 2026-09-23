// Deno — Poppins model IDs (mirrors lib/ai/openai-models.ts)

export const DEFAULT_OPENAI_REALTIME_MODEL = 'gpt-realtime-2.1';
export const DEFAULT_OPENAI_POPPINS_CHAT_MODEL = 'gpt-5.6-luna';
export const DEFAULT_OPENAI_INPUT_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';

export function getOpenAIRealtimeModel(): string {
  return Deno.env.get('OPENAI_REALTIME_MODEL')?.trim() || DEFAULT_OPENAI_REALTIME_MODEL;
}

export function getOpenAIPoppinsChatModel(): string {
  return Deno.env.get('OPENAI_POPPINS_CHAT_MODEL')?.trim() || DEFAULT_OPENAI_POPPINS_CHAT_MODEL;
}

export function getOpenAIInputTranscribeModel(): string {
  return (
    Deno.env.get('OPENAI_INPUT_TRANSCRIBE_MODEL')?.trim() || DEFAULT_OPENAI_INPUT_TRANSCRIBE_MODEL
  );
}

export function getOpenAIRealtimeReasoningMode(): 'auto' | 'on' | 'off' {
  const raw = (Deno.env.get('OPENAI_REALTIME_REASONING') ?? 'auto').trim().toLowerCase();
  if (raw === 'off' || raw === 'on') return raw;
  return 'auto';
}

export function realtimeModelSupportsReasoning(model: string): boolean {
  return /gpt-realtime-2(\.|$)/i.test(model);
}

export function resolveRealtimeReasoningEffort(
  personalityEffort?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
): 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | null {
  const mode = getOpenAIRealtimeReasoningMode();
  const model = getOpenAIRealtimeModel();
  if (!realtimeModelSupportsReasoning(model) || mode === 'off') return null;
  if (personalityEffort === 'off') return null;
  if (mode === 'on') {
    return personalityEffort && personalityEffort !== 'off' ? personalityEffort : 'low';
  }
  return personalityEffort && personalityEffort !== 'off' ? personalityEffort : 'low';
}
