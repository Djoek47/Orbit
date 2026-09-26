/**
 * Turn-scoped act ledger — suppress duplicate local + server writes (WO10 B3).
 */

export type ActLedgerEntry = {
  write: string;
  key: string;
  at: number;
};

const WINDOW_MS = 20_000;
const ledger: ActLedgerEntry[] = [];

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function actKeyFromBeat(write: string, payload: {
  groceryName?: string;
  title?: string;
  taskId?: string;
}): string {
  if (write === 'add_grocery') {
    return normalizeKey(payload.groceryName ?? payload.title ?? '');
  }
  if (write === 'complete_task') {
    return normalizeKey(payload.taskId ?? payload.title ?? '');
  }
  return normalizeKey(payload.title ?? payload.groceryName ?? '');
}

export function recordCommittedAct(write: string, key: string, at = Date.now()): void {
  const normalized = normalizeKey(key);
  if (!write || write === 'none' || !normalized) return;
  ledger.push({ write, key: normalized, at });
  pruneActLedger(at);
}

export function wasRecentlyCommitted(write: string, key: string, now = Date.now()): boolean {
  const normalized = normalizeKey(key);
  if (!write || !normalized) return false;
  pruneActLedger(now);
  return ledger.some(
    (entry) => entry.write === write && entry.key === normalized && now - entry.at <= WINDOW_MS
  );
}

export function pruneActLedger(now = Date.now()): void {
  while (ledger.length && now - ledger[0]!.at > WINDOW_MS) {
    ledger.shift();
  }
}

/** Test helper. */
export function clearActLedger(): void {
  ledger.length = 0;
}

export function writeKindFromUiAction(action: Record<string, unknown>): string | null {
  const type = String(action.type ?? '');
  if (type === 'add_grocery') return 'add_grocery';
  if (type === 'complete_task') return 'complete_task';
  if (type === 'create_task' || type === 'create_task_draft' || type === 'assign_task') {
    return 'create_task';
  }
  if (type === 'create_calendar_event' || type === 'create_event') return 'create_event';
  if (type === 'create_itinerary') return 'create_itinerary_stop';
  return null;
}

export function keyFromUiAction(action: Record<string, unknown>): string {
  return normalizeKey(
    String(action.name ?? action.title ?? action.groceryName ?? action.taskId ?? '')
  );
}

/** Drop server actions whose write+key already committed in the last 20s. */
export function filterDuplicateUiActions(
  actions: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const action of actions) {
    const write = writeKindFromUiAction(action);
    const key = keyFromUiAction(action);
    if (write && key && wasRecentlyCommitted(write, key)) {
      console.warn('iui.duplicate_suppressed', { write, key });
      continue;
    }
    out.push(action);
  }
  return out;
}
