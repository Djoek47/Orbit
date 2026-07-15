import { dataMode } from '@/config/data-mode';
import { getSupabaseClient, requireSupabaseClient } from '@/lib/supabase/client';

export function isMockMode() {
  return dataMode === 'mock';
}

export function requireMockOrSupabaseReady(repositoryName: string) {
  if (dataMode === 'mock') {
    return;
  }

  if (!getSupabaseClient()) {
    throw new Error(`${repositoryName} is in Supabase mode, but Supabase is not configured.`);
  }
}

export function getConfiguredSupabase(repositoryName: string) {
  requireMockOrSupabaseReady(repositoryName);
  return requireSupabaseClient();
}

export function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function mapDbError(scope: string, error: { message?: string } | null) {
  if (!error) {
    return;
  }
  throw new Error(`${scope}: ${error.message ?? 'Unknown Supabase error'}`);
}
