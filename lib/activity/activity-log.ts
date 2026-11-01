/**
 * Household activity log — append-only history for admins.
 *
 * Two sinks, merged on read:
 *  - remote: `public.activity_log` (Supabase mode, uuid households). Server
 *    facts (created / push sent / read / dismissed / deleted) are written by
 *    DB triggers; the device only appends receipts (received / opened) and
 *    assistant rows (errors, "you're wrong" reports).
 *  - local: an AsyncStorage ring buffer (cap {@link LOCAL_CAP}) that always
 *    records every entry, so mock mode / offline / pre-migration still work.
 *
 * Nothing here ever throws — logging must never break the caller.
 * Storage and remote are injectable ({@link configureActivityLog}) so the
 * module stays testable under plain node.
 */
import { dataMode } from '@/config/data-mode';

export type ActivityKind =
  | 'notification_created'
  | 'notification_push_sent'
  | 'notification_received'
  | 'notification_opened'
  | 'notification_read'
  | 'notification_dismissed'
  | 'notification_deleted'
  | 'assistant_error'
  | 'assistant_report';

export const NOTIFICATION_KINDS: readonly ActivityKind[] = [
  'notification_created',
  'notification_push_sent',
  'notification_received',
  'notification_opened',
  'notification_read',
  'notification_dismissed',
  'notification_deleted',
];

export const ASSISTANT_KINDS: readonly ActivityKind[] = ['assistant_error', 'assistant_report'];

/** Kinds a device may append remotely — the rest come from DB triggers. */
const CLIENT_REMOTE_KINDS = new Set<ActivityKind>([
  'notification_received',
  'notification_opened',
  'assistant_error',
  'assistant_report',
]);

export type AssistantTier = 'base' | 'max';

export type ActivityEntry = {
  id: string;
  householdId: string;
  createdAt: string;
  kind: ActivityKind;
  notificationId: string | null;
  memberId: string | null;
  actorUserId: string | null;
  title: string | null;
  body: string | null;
  category: string | null;
  device: string | null;
  detail: Record<string, unknown>;
  source: 'remote' | 'local';
  /** Local-only: identical keys are logged once (e.g. re-delivered tap responses). */
  dedupeKey?: string;
};

export type LogActivityInput = {
  householdId: string;
  kind: ActivityKind;
  notificationId?: string | null;
  memberId?: string | null;
  actorUserId?: string | null;
  title?: string | null;
  body?: string | null;
  category?: string | null;
  device?: string | null;
  detail?: Record<string, unknown>;
  dedupeKey?: string;
};

export type ReadActivityQuery = {
  householdId: string;
  notificationId?: string;
  kinds?: readonly ActivityKind[];
};

export type ActivityLocalStore = {
  load: () => Promise<ActivityEntry[]>;
  save: (entries: ActivityEntry[]) => Promise<void>;
};

export type ActivityRemote = {
  /** Whether this household can reach the remote log at all. */
  enabled: (householdId: string) => boolean;
  insert: (entry: ActivityEntry) => Promise<void>;
  /** null = remote unavailable (error / offline); [] = nothing visible. */
  list: (query: ReadActivityQuery) => Promise<ActivityEntry[] | null>;
};

export type ActivityLogDeps = {
  local: ActivityLocalStore;
  remote: ActivityRemote | null;
  now: () => Date;
  newId: () => string;
  deviceLabel: () => Promise<string | null>;
};

export const LOCAL_CAP = 500;
export const TRANSCRIPT_MAX = 280;
/** A local copy and a trigger row of the same fact land within this window. */
const FUZZY_MATCH_MS = 15_000;
const STORAGE_KEY = 'orbit.activity-log.v1';

// ── Pure helpers ───────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

/** RFC 4122 v4 without relying on crypto.randomUUID (absent on some Hermes builds). */
export function uuidV4(random: () => number = Math.random): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.floor(random() * 16) & 0x3) | 0x8];
    else out += hex[Math.floor(random() * 16)];
  }
  return out;
}

/** Collapse whitespace and cap at {@link TRANSCRIPT_MAX} chars (ellipsis included). */
export function truncateTranscript(text: string | null | undefined, max = TRANSCRIPT_MAX): string {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function normalizeUtterance(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ'`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Conservative: only explicit "you got that wrong" phrasing (English + French).
 * A lone "no" / "non" / "no thanks" is a normal answer, never a report.
 */
const CORRECTION_PATTERNS: RegExp[] = [
  // English
  /\b(youre|your|you are|you were|ur|u r) (so |completely |totally |just |dead |absolutely )?(wrong|mistaken|incorrect)\b/,
  /\b(thats|that is|this is|thats just|its|it is) (all |totally |completely |so )?(wrong|incorrect)\b/,
  /\b(thats|that is|this is|its|it is) not (right|correct)\b(?! now)/,
  /\b(thats|that is|this is|its|it is|thats) not what i (said|asked|meant|wanted|say)\b/,
  /\bno (thats|that is|its) not (it|what i)\b/,
  /\bnot what i (said|asked for|meant)\b/,
  /\byou (got|have) (it|that|this|me) wrong\b/,
  /\byou (misheard|misunderstood)( me)?\b/,
  /\bi (didnt|did not|never) (say|ask for|ask) (that|this)\b/,
  /^(no )?(wrong|incorrect|thats wrong)( again)?$/,
  // French (accents / apostrophes stripped: "c'est pas ça" → "cest pas ca")
  /\bcest (pas|pas du tout) ca\b/,
  /\bce nest (pas|pas du tout) ca\b/,
  /\bcest faux\b/,
  /\bcest pas ce que (jai|je t ai|je tai|j ai) (dit|demande)\b/,
  /\bce nest pas ce que (jai|j ai) (dit|demande)\b/,
  /\b(tu te trompes|tu tes trompe|tu tes trompee|vous vous trompez|vous vous etes trompe)\b/,
  /\b(tas|t as|tu as|vous avez) mal compris\b/,
  /\b(jai|j ai) (pas|jamais) dit ca\b/,
  /\bje nai (pas|jamais) dit ca\b/,
  /^(non )?(faux|pas ca)$/,
];

export function isCorrectionUtterance(text: string): boolean {
  const normalized = normalizeUtterance(text ?? '');
  if (!normalized) return false;
  return CORRECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sameFact(a: ActivityEntry, b: ActivityEntry): boolean {
  if (a.kind !== b.kind) return false;
  if ((a.notificationId ?? null) !== (b.notificationId ?? null)) return false;
  if (a.memberId && b.memberId && a.memberId !== b.memberId) return false;
  return Math.abs(Date.parse(a.createdAt) - Date.parse(b.createdAt)) <= FUZZY_MATCH_MS;
}

function matchesQuery(entry: ActivityEntry, query: ReadActivityQuery): boolean {
  if (entry.householdId !== query.householdId) return false;
  if (query.notificationId && entry.notificationId !== query.notificationId) return false;
  if (query.kinds && query.kinds.length > 0 && !query.kinds.includes(entry.kind)) return false;
  return true;
}

/**
 * Merge remote + local, newest first. Remote wins on duplicates: exact id
 * (a local copy that was also uploaded) or the same fact within a few
 * seconds (a local read/dismiss whose remote twin came from a DB trigger).
 */
export function mergeActivityEntries(
  remote: readonly ActivityEntry[],
  local: readonly ActivityEntry[]
): ActivityEntry[] {
  const byId = new Map<string, ActivityEntry>();
  for (const entry of remote) byId.set(entry.id, entry);
  const remoteList = [...byId.values()];

  for (const entry of local) {
    if (byId.has(entry.id)) continue;
    if (remoteList.some((other) => sameFact(other, entry))) continue;
    byId.set(entry.id, entry);
  }

  return [...byId.values()].sort((a, b) => {
    const delta = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return delta !== 0 ? delta : a.id < b.id ? 1 : -1;
  });
}

// ── Default deps (lazy — keep react-native / supabase out of node tests) ──

function createAsyncStorageLocal(): ActivityLocalStore {
  return {
    async load() {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as ActivityEntry[]) : [];
    },
    async save(entries) {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    },
  };
}

type ActivityLogDbRow = {
  id: string;
  household_id: string;
  created_at: string;
  kind: ActivityKind;
  notification_id: string | null;
  member_id: string | null;
  actor_user_id: string | null;
  title: string | null;
  body: string | null;
  category: string | null;
  device: string | null;
  detail: unknown;
};

export function mapActivityRow(row: ActivityLogDbRow): ActivityEntry {
  return {
    id: row.id,
    householdId: row.household_id,
    createdAt: row.created_at,
    kind: row.kind,
    notificationId: row.notification_id,
    memberId: row.member_id,
    actorUserId: row.actor_user_id,
    title: row.title,
    body: row.body,
    category: row.category,
    device: row.device,
    detail:
      row.detail && typeof row.detail === 'object' && !Array.isArray(row.detail)
        ? (row.detail as Record<string, unknown>)
        : {},
    source: 'remote',
  };
}

function createSupabaseRemote(): ActivityRemote {
  return {
    enabled: (householdId) => dataMode === 'supabase' && isUuid(householdId),

    async insert(entry) {
      const { getSupabaseClient } = await import('@/lib/supabase/client');
      const supabase = getSupabaseClient();
      if (!supabase) return;

      // Profile-code (Sidekick) devices have no JWT — route receipts through
      // the service-role edge function instead of RLS.
      if (
        entry.notificationId &&
        (entry.kind === 'notification_received' || entry.kind === 'notification_opened')
      ) {
        const { sidekickNotificationAuth } = await import('@/lib/sidekick/notification-action');
        const profileAuth = await sidekickNotificationAuth();
        if (profileAuth) {
          const { error } = await supabase.functions.invoke('sidekick-notification-action', {
            body: {
              action: 'log_receipt',
              code: profileAuth.code,
              notificationId: entry.notificationId,
              kind: entry.kind,
              device: entry.device,
              detail: entry.detail,
            },
          });
          if (error) throw new Error(error.message);
          return;
        }
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const { error } = await supabase.from('activity_log').insert({
        id: entry.id,
        household_id: entry.householdId,
        created_at: entry.createdAt,
        kind: entry.kind,
        notification_id: isUuid(entry.notificationId) ? entry.notificationId : null,
        member_id: isUuid(entry.memberId) ? entry.memberId : null,
        actor_user_id: sessionData.session?.user?.id ?? null,
        title: entry.title,
        body: entry.body,
        category: entry.category,
        device: entry.device,
        detail: entry.detail as import('@/types/database').Json,
      });
      if (error) throw new Error(error.message);
    },

    async list(query) {
      const { getSupabaseClient } = await import('@/lib/supabase/client');
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      let request = supabase
        .from('activity_log')
        .select('*')
        .eq('household_id', query.householdId)
        .order('created_at', { ascending: false })
        .limit(LOCAL_CAP);
      if (query.notificationId) {
        if (!isUuid(query.notificationId)) return [];
        request = request.eq('notification_id', query.notificationId);
      }
      if (query.kinds && query.kinds.length > 0) {
        request = request.in('kind', [...query.kinds]);
      }
      const { data, error } = await request;
      if (error) {
        console.warn('activity-log.list', error.message);
        return null;
      }
      return (data ?? []).map((row) => mapActivityRow(row as ActivityLogDbRow));
    },
  };
}

async function defaultDeviceLabel(): Promise<string | null> {
  try {
    // Plain require, never a dynamic namespace import of react-native: that enumerates every
    // export and trips the removed PushNotificationIOS getter in release builds.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native') as typeof import('react-native');
    let model: string | null = null;
    try {
      const Device = await import('expo-device');
      model = Device.modelName ?? null;
    } catch {
      model = null;
    }
    return [Platform.OS, model].filter(Boolean).join(' · ') || null;
  } catch {
    return null;
  }
}

function defaultDeps(): ActivityLogDeps {
  return {
    local: createAsyncStorageLocal(),
    remote: createSupabaseRemote(),
    now: () => new Date(),
    newId: () => uuidV4(),
    deviceLabel: defaultDeviceLabel,
  };
}

let deps: ActivityLogDeps | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

function getDeps(): ActivityLogDeps {
  deps ??= defaultDeps();
  return deps;
}

/** Test seam — swap storage / remote / clock. Pass nothing to restore defaults. */
export function configureActivityLog(overrides?: Partial<ActivityLogDeps>): void {
  deps = overrides ? { ...defaultDeps(), ...overrides } : null;
  writeChain = Promise.resolve();
}

// ── Public API ─────────────────────────────────────────────────────────────

async function appendLocal(local: ActivityLocalStore, entry: ActivityEntry): Promise<boolean> {
  let loaded: ActivityEntry[] = [];
  try {
    loaded = await local.load();
  } catch {
    loaded = [];
  }
  if (entry.dedupeKey && loaded.some((item) => item.dedupeKey === entry.dedupeKey)) {
    return false;
  }
  const next = [...loaded, entry];
  await local.save(next.length > LOCAL_CAP ? next.slice(next.length - LOCAL_CAP) : next);
  return true;
}

/**
 * Append one entry. Always kept locally; uploaded when the household is live
 * and the kind is device-owned. Resolves to the stored entry, or null when it
 * was a duplicate (same dedupeKey) or could not be recorded at all.
 */
export async function logActivity(input: LogActivityInput): Promise<ActivityEntry | null> {
  try {
    if (!input.householdId) return null;
    const d = getDeps();
    const entry: ActivityEntry = {
      id: d.newId(),
      householdId: input.householdId,
      createdAt: d.now().toISOString(),
      kind: input.kind,
      notificationId: input.notificationId ?? null,
      memberId: input.memberId ?? null,
      actorUserId: input.actorUserId ?? null,
      title: input.title ?? null,
      body: input.body ?? null,
      category: input.category ?? null,
      device: input.device ?? null,
      detail: input.detail ?? {},
      source: 'local',
      ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
    };

    // Serialize local writes so concurrent logs don't clobber the ring buffer.
    const stored = writeChain.then(() => appendLocal(d.local, entry));
    writeChain = stored.catch(() => false);
    let isNew = true;
    try {
      isNew = await stored;
    } catch (error) {
      console.warn('activity-log.local', error);
    }
    if (!isNew) return null;

    if (d.remote && CLIENT_REMOTE_KINDS.has(entry.kind) && d.remote.enabled(entry.householdId)) {
      try {
        await d.remote.insert(entry);
      } catch (error) {
        console.warn('activity-log.remote', entry.kind, error instanceof Error ? error.message : error);
      }
    }
    return entry;
  } catch (error) {
    console.warn('activity-log', error);
    return null;
  }
}

/** Remote (if reachable) + local, newest first, de-duplicated. Never throws. */
export async function readActivityLog(query: ReadActivityQuery): Promise<ActivityEntry[]> {
  const d = getDeps();
  let local: ActivityEntry[] = [];
  try {
    local = (await d.local.load()).filter((entry) => matchesQuery(entry, query));
  } catch (error) {
    console.warn('activity-log.read.local', error);
  }

  let remote: ActivityEntry[] = [];
  if (d.remote && d.remote.enabled(query.householdId)) {
    try {
      remote = ((await d.remote.list(query)) ?? []).filter((entry) => matchesQuery(entry, query));
    } catch (error) {
      console.warn('activity-log.read.remote', error);
    }
  }

  return mergeActivityEntries(remote, local);
}

async function safeDevice(): Promise<string | null> {
  try {
    return await getDeps().deviceLabel();
  } catch {
    return null;
  }
}

/** The assistant failed (network, model, tool, parse…). */
export async function logAssistantError(input: {
  householdId: string;
  memberId?: string | null;
  tier: AssistantTier;
  stage: string;
  message: string;
  transcript?: string;
}): Promise<ActivityEntry | null> {
  const transcript = input.transcript ? truncateTranscript(input.transcript) : null;
  return logActivity({
    householdId: input.householdId,
    kind: 'assistant_error',
    memberId: input.memberId ?? null,
    title: truncateTranscript(input.message, 140) || 'Assistant error',
    body: transcript,
    category: 'assistant',
    device: await safeDevice(),
    detail: {
      tier: input.tier,
      stage: truncateTranscript(input.stage, 60),
      message: truncateTranscript(input.message, 500),
      ...(transcript ? { transcript } : {}),
    },
  });
}

/** The user told the assistant it was wrong — keep the snippet to fix later. */
export async function logAssistantReport(input: {
  householdId: string;
  memberId?: string | null;
  tier: AssistantTier;
  transcript: string;
  note?: string;
}): Promise<ActivityEntry | null> {
  const transcript = truncateTranscript(input.transcript);
  return logActivity({
    householdId: input.householdId,
    kind: 'assistant_report',
    memberId: input.memberId ?? null,
    title: input.note ? truncateTranscript(input.note, 140) : 'Marked as wrong',
    body: transcript,
    category: 'assistant',
    device: await safeDevice(),
    detail: {
      tier: input.tier,
      transcript,
      ...(input.note ? { note: truncateTranscript(input.note) } : {}),
    },
  });
}
