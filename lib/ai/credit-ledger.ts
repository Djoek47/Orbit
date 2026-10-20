import AsyncStorage from '@react-native-async-storage/async-storage';

import { mergeUsageEvents, type AiUsageEvent, type AiUsageKind } from '@/lib/ai/credits';
import { isPersistedHouseholdId } from '@/lib/household/persisted-household-id';
import { getSupabaseClient } from '@/lib/supabase/client';

const keyFor = (householdId: string) => `orbit.ai-usage.${householdId}`;

const USAGE_KINDS: AiUsageKind[] = ['chat', 'voice', 'briefing', 'monitor', 'notify', 'realtime'];

function parseKind(raw: string): AiUsageKind {
  return USAGE_KINDS.includes(raw as AiUsageKind) ? (raw as AiUsageKind) : 'chat';
}

export async function loadAiUsageEvents(householdId: string | null | undefined): Promise<AiUsageEvent[]> {
  const local = await loadLocal(householdId);
  if (!isPersistedHouseholdId(householdId)) return local;
  const remote = await loadRemote(householdId);
  if (!remote) return local;
  const merged = mergeUsageEvents(local, remote);
  await saveLocal(householdId, merged);
  return merged;
}

export async function saveAiUsageEvents(
  householdId: string | null | undefined,
  events: AiUsageEvent[]
): Promise<void> {
  if (!householdId) return;
  const trimmed = events.slice(-400);
  await saveLocal(householdId, trimmed);
  if (!isPersistedHouseholdId(householdId)) return;
  await saveRemote(householdId, trimmed);
}

async function loadLocal(householdId: string | null | undefined): Promise<AiUsageEvent[]> {
  if (!householdId) return [];
  try {
    const raw = await AsyncStorage.getItem(keyFor(householdId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isUsageEvent);
  } catch {
    return [];
  }
}

async function saveLocal(householdId: string, events: AiUsageEvent[]): Promise<void> {
  await AsyncStorage.setItem(keyFor(householdId), JSON.stringify(events));
}

async function loadRemote(householdId: string): Promise<AiUsageEvent[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('ai_usage_events')
      .select(
        'client_key, member_id, member_name, kind, model, input_tokens, output_tokens, usd, occurred_at, mode, cached_input_tokens, audio_input_seconds, audio_output_seconds, session_id, turn_index, duration_ms'
      )
      .eq('household_id', householdId)
      .order('occurred_at', { ascending: true });
    if (error) {
      console.warn('[ai-usage] remote load skipped', error.message);
      return null;
    }
    return (data ?? []).map((row) => rowToEvent(row)).filter(isUsageEvent);
  } catch (error) {
    console.warn('[ai-usage] remote load failed', error);
    return null;
  }
}

/**
 * Append-only: insert on conflict(client_key) do nothing.
 * Replaces the old upsert on (household_id, client_key) which overwrote usd.
 */
async function saveRemote(householdId: string, events: AiUsageEvent[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const rows = events.map((event) => ({
    household_id: householdId,
    client_key: event.id,
    member_id: event.memberId,
    member_name: event.memberName,
    kind: event.kind,
    model: event.model,
    input_tokens: event.inputTokens,
    output_tokens: event.outputTokens,
    usd: event.usd,
    occurred_at: event.at,
    ...(event.mode ? { mode: event.mode } : {}),
    ...(event.cachedInputTokens != null ? { cached_input_tokens: event.cachedInputTokens } : {}),
    ...(event.audioInSeconds != null ? { audio_input_seconds: event.audioInSeconds } : {}),
    ...(event.audioOutSeconds != null ? { audio_output_seconds: event.audioOutSeconds } : {}),
    ...(event.sessionId ? { session_id: event.sessionId } : {}),
    ...(event.turnIndex != null ? { turn_index: event.turnIndex } : {}),
    ...(event.durationMs != null ? { duration_ms: event.durationMs } : {}),
  }));
  try {
    const { error } = await supabase.from('ai_usage_events').upsert(rows as never, {
      onConflict: 'client_key',
      ignoreDuplicates: true,
    });
    if (error) console.warn('[ai-usage] remote save skipped', error.message);
  } catch (error) {
    console.warn('[ai-usage] remote save failed', error);
  }
}

function rowToEvent(row: object): AiUsageEvent {
  const item = row as Record<string, unknown>;
  const modeRaw = String(item.mode ?? '');
  const mode =
    modeRaw === 'silent' || modeRaw === 'spoken'
      ? modeRaw
      : modeRaw === 'live'
        ? 'spoken'
        : undefined;
  return {
    id: String(item.client_key ?? ''),
    at: String(item.occurred_at ?? ''),
    memberId: String(item.member_id ?? ''),
    memberName: String(item.member_name ?? ''),
    kind: parseKind(String(item.kind ?? 'chat')),
    model: String(item.model ?? ''),
    inputTokens: Number(item.input_tokens ?? 0),
    outputTokens: Number(item.output_tokens ?? 0),
    usd: Number(item.usd ?? 0),
    mode,
    cachedInputTokens: Number(item.cached_input_tokens ?? 0) || undefined,
    audioInSeconds: Number(item.audio_input_seconds ?? 0) || undefined,
    audioOutSeconds: Number(item.audio_output_seconds ?? 0) || undefined,
    sessionId: item.session_id ? String(item.session_id) : undefined,
    turnIndex: item.turn_index != null ? Number(item.turn_index) : undefined,
    durationMs: item.duration_ms != null ? Number(item.duration_ms) : undefined,
  };
}

function isUsageEvent(row: unknown): row is AiUsageEvent {
  if (!row || typeof row !== 'object') return false;
  const item = row as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.at === 'string' &&
    typeof item.memberId === 'string' &&
    typeof item.usd === 'number'
  );
}
