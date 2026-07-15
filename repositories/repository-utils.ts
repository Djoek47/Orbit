import { dataMode } from '@/config/data-mode';
import { getSupabaseClient } from '@/lib/supabase/client';

export function requireMockOrSupabaseReady(repositoryName: string) {
  if (dataMode === 'mock') {
    return;
  }

  if (!getSupabaseClient()) {
    throw new Error(`${repositoryName} is in Supabase mode, but Supabase is not configured.`);
  }

  throw new Error(`${repositoryName} Supabase queries are not implemented yet.`);
}

export function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
