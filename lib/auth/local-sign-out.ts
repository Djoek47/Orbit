import { clearMockSession } from '@/lib/auth/mock-session';
import {
  allowAuthStorageWrites,
  blockAuthStorageWrites,
  wipePersistedAuthSession,
} from '@/lib/auth/auth-storage';
import { getSupabaseClient, resetSupabaseClient } from '@/lib/supabase/client';
import { secureStoreAdapter } from '@/lib/supabase/secure-store-adapter';

const REMOTE_SIGNOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve('timeout');
      }
    );
  });
}

/**
 * Always leave the device unsigned. GoTrue `signOut({ scope: 'global' })` skips
 * `_removeSession` when the logout HTTP call fails — that left TestFlight 45
 * signed in after a crash/reopen.
 */
export async function wipeLocalAuthAndResetClient(): Promise<void> {
  blockAuthStorageWrites();

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.stopAutoRefresh();
    } catch {
      /* older clients */
    }
  }

  await wipePersistedAuthSession(secureStoreAdapter);
  try {
    await clearMockSession();
  } catch {
    /* ignore */
  }
  resetSupabaseClient();
}

export async function signOutEverywhere(): Promise<void> {
  blockAuthStorageWrites();
  try {
    const { teardownAllPoppinsVoice } = await import('@/lib/voice/poppins-voice-session');
    teardownAllPoppinsVoice();
  } catch (error) {
    console.warn('signOut.teardownVoice', error);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    const result = await withTimeout(supabase.auth.signOut({ scope: 'global' }), REMOTE_SIGNOUT_MS);
    if (result === 'timeout') {
      console.warn('signOut.remote timed out — wiping local session');
    } else if (result.error) {
      console.warn('signOut.remote', result.error.message);
    }
  }

  await wipeLocalAuthAndResetClient();
}

export { allowAuthStorageWrites };
