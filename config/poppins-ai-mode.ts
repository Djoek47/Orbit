import { dataMode } from '@/config/data-mode';

const rawPoppinsAi = process.env.EXPO_PUBLIC_POPPINS_AI;

/** When true, Poppins uses OpenAI edge functions even if household data is mock. */
export const useLivePoppinsAi =
  rawPoppinsAi === 'openai' || dataMode === 'supabase';
