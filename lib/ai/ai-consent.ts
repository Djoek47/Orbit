/**
 * Permission to send Poppins requests to OpenAI (App Review 5.1.2(i)).
 *
 * Before anything a person says or types leaves the phone for a third-party AI, the app names
 * the provider, says what is sent, and asks. The answer is stored on the person's profile
 * (profiles.ai_consent_at) — the server checks it on every Poppins call and never calls OpenAI
 * without it — and cached on the phone so the check here is instant.
 *
 * Without permission Poppins still works on the phone (local understanding, plain wording);
 * only the OpenAI-backed parts are skipped.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabaseClient } from '@/lib/supabase/client';

const KEY = 'choremaxx.aiConsent.v1';

type Consent = 'granted' | 'declined' | 'unknown';
let state: Consent = 'unknown';
let loaded = false;
const listeners = new Set<(c: Consent) => void>();
const askListeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn(state);
}

/** Load the cached answer, then the profile's (the source of truth). */
export async function loadAiConsent(): Promise<Consent> {
  try {
    const cached = await AsyncStorage.getItem(KEY);
    if (cached === 'granted' || cached === 'declined') state = cached;
  } catch {
    // no cache — stays unknown
  }
  try {
    const supabase = getSupabaseClient();
    const { data: auth } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    if (supabase && auth.user) {
      const { data } = await supabase
        .from('profiles')
        .select('ai_consent_at')
        .eq('id', auth.user.id)
        .maybeSingle();
      const at = (data as { ai_consent_at?: string | null } | null)?.ai_consent_at;
      if (at) state = 'granted';
      else if (state === 'granted') state = 'unknown'; // withdrawn elsewhere: ask again
      await AsyncStorage.setItem(KEY, state).catch(() => undefined);
    }
  } catch {
    // offline: keep the cached answer
  }
  loaded = true;
  emit();
  return state;
}

export function aiConsentState(): Consent {
  return state;
}

export function hasAiConsent(): boolean {
  return state === 'granted';
}

export function aiConsentLoaded(): boolean {
  return loaded;
}

/** Save the person's answer on their profile and on the phone. */
export async function setAiConsent(allowed: boolean): Promise<void> {
  state = allowed ? 'granted' : 'declined';
  emit();
  await AsyncStorage.setItem(KEY, state).catch(() => undefined);
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase
    .from('profiles')
    .update({ ai_consent_at: allowed ? new Date().toISOString() : null })
    .eq('id', auth.user.id);
  if (error) throw new Error(error.message);
}

export function subscribeAiConsent(fn: (c: Consent) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Something needed OpenAI and has no permission: ask (the Poppins screen shows the sheet). */
export function requestAiConsent(): void {
  for (const fn of askListeners) fn();
}

export function onAiConsentRequested(fn: () => void): () => void {
  askListeners.add(fn);
  return () => {
    askListeners.delete(fn);
  };
}

/** For tests. */
export function __resetAiConsentForTests(next: Consent = 'unknown') {
  state = next;
  loaded = false;
}
