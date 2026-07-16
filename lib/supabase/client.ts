import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { supabaseConfig } from '@/config/supabase-config';
import { secureStoreAdapter } from '@/lib/supabase/secure-store-adapter';
import type { Database } from '@/types/database';

let client: SupabaseClient<Database> | null = null;

export function getSupabaseClient() {
  if (!supabaseConfig.isConfigured) {
    return null;
  }

  client ??= createClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: secureStoreAdapter,
    },
  });

  return client;
}

export function requireSupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return supabase;
}
