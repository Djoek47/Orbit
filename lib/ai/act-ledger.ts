import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  mergeActEvents,
  type ActControl,
  type ActEvent,
  type ActKind,
  type ActOutcome,
  type ActVoice,
} from '@/lib/ai/act-events';
import { isPersistedHouseholdId } from '@/lib/household/persisted-household-id';
import { getSupabaseClient } from '@/lib/supabase/client';

const keyFor = (householdId: string) => `orbit.act-events.${householdId}`;

const ACT_KINDS: ActKind[] = [
  'task',
  'grocery',
  'event',
  'homework',
  'itinerary_stop',
  'place_save',
  'complete',
  'reward',
  'coach',
];
const OUTCOMES: ActOutcome[] = ['committed', 'undone', 'vetoed', 'abandoned', 'failed'];
const VOICES: ActVoice[] = ['quiet', 'spoken'];
const CONTROLS: ActControl[] = ['guided', 'direct'];

function isActEvent(row: unknown): row is ActEvent {
  if (!row || typeof row !== 'object') return false;
  const item = row as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.at === 'string' &&
    typeof item.memberId === 'string' &&
    ACT_KINDS.includes(item.actKind as ActKind) &&
    OUTCOMES.includes(item.outcome as ActOutcome) &&
    typeof item.tokens === 'number'
  );
}

export async function loadActEvents(householdId: string | null | undefined): Promise<ActEvent[]> {
  const local = await loadLocal(householdId);
  if (!isPersistedHouseholdId(householdId)) return local;
  const remote = await loadRemote(householdId);
  if (!remote) return local;
  const merged = mergeActEvents(local, remote);
  await saveLocal(householdId, merged);
  return merged;
}

export async function saveActEvents(
  householdId: string | null | undefined,
  events: ActEvent[]
): Promise<void> {
  if (!householdId) return;
  const trimmed = events.slice(-400);
  await saveLocal(householdId, trimmed);
  if (!isPersistedHouseholdId(householdId)) return;
  await saveRemote(householdId, trimmed);
}

async function loadLocal(householdId: string | null | undefined): Promise<ActEvent[]> {
  if (!householdId) return [];
  try {
    const raw = await AsyncStorage.getItem(keyFor(householdId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isActEvent);
  } catch {
    return [];
  }
}

async function saveLocal(householdId: string, events: ActEvent[]) {
  await AsyncStorage.setItem(keyFor(householdId), JSON.stringify(events));
}

async function loadRemote(householdId: string): Promise<ActEvent[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('act_events')
      .select(
        'client_key, member_id, member_name, act_kind, voice, control, tokens, outcome, utterance_chars, turns, beats_played, slots_from_speech, slots_from_touch, slots_inherited, latency_ms, beat_id, occurred_at'
      )
      .eq('household_id', householdId)
      .order('occurred_at', { ascending: true });
    if (error) {
      console.warn('[act-events] remote load skipped', error.message);
      return null;
    }
    return (data ?? []).map(rowToEvent).filter(isActEvent);
  } catch (error) {
    console.warn('[act-events] remote load failed', error);
    return null;
  }
}

async function saveRemote(householdId: string, events: ActEvent[]) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const rows = events.map((event) => ({
    household_id: householdId,
    client_key: event.id,
    member_id: event.memberId,
    member_name: event.memberName,
    act_kind: event.actKind,
    voice: event.voice,
    control: event.control,
    tokens: event.tokens,
    outcome: event.outcome,
    utterance_chars: event.utteranceChars,
    turns: event.turns,
    beats_played: event.beatsPlayed,
    slots_from_speech: event.slotsFromSpeech,
    slots_from_touch: event.slotsFromTouch,
    slots_inherited: event.slotsInherited,
    latency_ms: event.latencyMs,
    beat_id: event.beatId ?? null,
    occurred_at: event.at,
  }));
  try {
    const { error } = await supabase.from('act_events').upsert(rows as never, {
      onConflict: 'client_key',
      ignoreDuplicates: true,
    });
    if (error) console.warn('[act-events] remote save skipped', error.message);
  } catch (error) {
    console.warn('[act-events] remote save failed', error);
  }
}

function rowToEvent(row: object): ActEvent {
  const item = row as Record<string, unknown>;
  const voiceRaw = String(item.voice ?? 'quiet');
  const controlRaw = String(item.control ?? 'guided');
  return {
    id: String(item.client_key ?? ''),
    at: String(item.occurred_at ?? ''),
    memberId: String(item.member_id ?? ''),
    memberName: String(item.member_name ?? ''),
    actKind: (ACT_KINDS.includes(item.act_kind as ActKind)
      ? item.act_kind
      : 'task') as ActKind,
    voice: (VOICES.includes(voiceRaw as ActVoice) ? voiceRaw : 'quiet') as ActVoice,
    control: (CONTROLS.includes(controlRaw as ActControl) ? controlRaw : 'guided') as ActControl,
    tokens: Number(item.tokens ?? 0),
    outcome: (OUTCOMES.includes(item.outcome as ActOutcome)
      ? item.outcome
      : 'committed') as ActOutcome,
    utteranceChars: Number(item.utterance_chars ?? 0),
    turns: Number(item.turns ?? 0),
    beatsPlayed: Number(item.beats_played ?? 0),
    slotsFromSpeech: Number(item.slots_from_speech ?? 0),
    slotsFromTouch: Number(item.slots_from_touch ?? 0),
    slotsInherited: Number(item.slots_inherited ?? 0),
    latencyMs: Number(item.latency_ms ?? 0),
    beatId: item.beat_id ? String(item.beat_id) : undefined,
  };
}
