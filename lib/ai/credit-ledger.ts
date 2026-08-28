import AsyncStorage from '@react-native-async-storage/async-storage';

import { mergeUsageEvents, type AiUsageEvent, type AiUsageKind } from '@/lib/ai/credits';
import { isPersistedHouseholdId } from '@/lib/household/persisted-household-id';
import { getSupabaseClient } from '@/lib/supabase/client';

const keyFor = (householdId: string) => `orbit.ai-usage.${householdId}`;

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
        'client_key, member_id, member_name, kind, model, input_tokens, output_tokens, usd, occurred_at'
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
  }));
  try {
    const { error } = await supabase.from('ai_usage_events').upsert(rows, {
      onConflict: 'household_id,client_key',
    });
    if (error) console.warn('[ai-usage] remote save skipped', error.message);
  } catch (error) {
    console.warn('[ai-usage] remote save failed', error);
  }
}

function rowToEvent(row: object): AiUsageEvent {
  const item = row as Record<string, unknown>;
  const kindRaw = String(item.kind ?? 'chat');
  const kind: AiUsageKind =
    kindRaw === 'voice' || kindRaw === 'briefing' || kindRaw === 'chat' ? kindRaw : 'chat';
  return {
    id: String(item.client_key ?? ''),
    at: String(item.occurred_at ?? ''),
    memberId: String(item.member_id ?? ''),
    memberName: String(item.member_name ?? ''),
    kind,
    model: String(item.model ?? ''),
    inputTokens: Number(item.input_tokens ?? 0),
    outputTokens: Number(item.output_tokens ?? 0),
    usd: Number(item.usd ?? 0),
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
