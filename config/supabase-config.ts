import { isSupabaseMode } from '@/config/data-mode';

export type SupabaseConfig = {
  anonKey: string;
  isConfigured: boolean;
  url: string;
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfig: SupabaseConfig = {
  anonKey,
  isConfigured: url.length > 0 && anonKey.length > 0,
  url,
};

export function assertSupabaseConfigured() {
  if (isSupabaseMode && !supabaseConfig.isConfigured) {
    throw new Error(
      'Supabase mode requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
}
