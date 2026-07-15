import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { supabaseConfig } from '@/config/supabase-config';
import type { Database } from '@/types/database';

let client: SupabaseClient<Database> | null = null;

export function getSupabaseClient() {
  if (!supabaseConfig.isConfigured) {
    return null;
  }

  client ??= createClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return client;
}
