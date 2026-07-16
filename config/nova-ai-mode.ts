import { dataMode } from '@/config/data-mode';

const rawNovaAi = process.env.EXPO_PUBLIC_NOVA_AI;

/** When true, Nova uses OpenAI edge functions even if household data is mock. */
export const useLiveNovaAi =
  rawNovaAi === 'openai' || dataMode === 'supabase';
