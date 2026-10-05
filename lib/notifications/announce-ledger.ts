/**
 * Persisted "already announced" keys — stops reopen / live-sync from
 * rebroadcasting the same task/note as a new OS banner.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@orbit/announce-ledger.v1';
export const ANNOUNCE_LEDGER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AnnounceLedgerEntry = {
  key: string;
  at: number;
};

export type AnnounceLedger = {
  entries: AnnounceLedgerEntry[];
};

function storageKey(householdId: string, memberId: string): string {
  return `${PREFIX}:${householdId}:${memberId}`;
}

/** Expo notification identifiers: keep alphanumeric + _ - */
export function toExpoNotificationIdentifier(key: string): string {
  const cleaned = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length > 0 ? `orbit_${cleaned}` : `orbit_${Date.now()}`;
}

export function pruneAnnounceLedger(
  ledger: AnnounceLedger,
  now = Date.now(),
  ttlMs = ANNOUNCE_LEDGER_TTL_MS
): AnnounceLedger {
  const cutoff = now - ttlMs;
  return {
    entries: ledger.entries.filter((entry) => entry.at >= cutoff),
  };
}

export function ledgerKeySet(ledger: AnnounceLedger): Set<string> {
  return new Set(ledger.entries.map((entry) => entry.key));
}

export function hasLedgerKey(ledger: AnnounceLedger, key: string): boolean {
  return ledger.entries.some((entry) => entry.key === key);
}

export function withLedgerKey(
  ledger: AnnounceLedger,
  key: string,
  now = Date.now()
): AnnounceLedger {
  if (hasLedgerKey(ledger, key)) return ledger;
  return pruneAnnounceLedger({
    entries: [...ledger.entries, { key, at: now }],
  }, now);
}

export async function loadAnnounceLedger(
  householdId: string,
  memberId: string
): Promise<AnnounceLedger> {
  if (!householdId || !memberId) return { entries: [] };
  try {
    const raw = await AsyncStorage.getItem(storageKey(householdId, memberId));
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw) as AnnounceLedger;
    if (!parsed || !Array.isArray(parsed.entries)) return { entries: [] };
    return pruneAnnounceLedger({
      entries: parsed.entries.filter(
        (entry) => entry && typeof entry.key === 'string' && typeof entry.at === 'number'
      ),
    });
  } catch {
    return { entries: [] };
  }
}

export async function saveAnnounceLedger(
  householdId: string,
  memberId: string,
  ledger: AnnounceLedger
): Promise<void> {
  if (!householdId || !memberId) return;
  await AsyncStorage.setItem(
    storageKey(householdId, memberId),
    JSON.stringify(pruneAnnounceLedger(ledger))
  );
}

export async function recordAnnouncedKeys(
  householdId: string,
  memberId: string,
  keys: string[]
): Promise<AnnounceLedger> {
  let ledger = await loadAnnounceLedger(householdId, memberId);
  const now = Date.now();
  for (const key of keys) {
    if (!key) continue;
    ledger = withLedgerKey(ledger, key, now);
  }
  await saveAnnounceLedger(householdId, memberId, ledger);
  return ledger;
}
