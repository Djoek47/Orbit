/**
 * WO12 §C — slot order follows the sentence.
 * Filled slots are ordered by character offset in the utterance; focus is the first empty.
 */
import type { IuiPayload } from '@/lib/poppins/ui-scenes';

export type SlotKey = 'title' | 'assignee' | 'due' | 'category' | 'date' | 'time';

/** Default render order when speech did not fill anything yet. */
export const TASK_SLOT_DEFAULT: SlotKey[] = ['assignee', 'title', 'due'];

const DUE_CUES: Array<{ re: RegExp; label: string }> = [
  { re: /\btomorrow\b/i, label: 'Tomorrow' },
  { re: /\btoday\b/i, label: 'Today' },
  { re: /\bthis week\b/i, label: 'This week' },
  { re: /\bmonday\b/i, label: 'Monday' },
  { re: /\btuesday\b/i, label: 'Tuesday' },
  { re: /\bwednesday\b/i, label: 'Wednesday' },
  { re: /\bthursday\b/i, label: 'Thursday' },
  { re: /\bfriday\b/i, label: 'Friday' },
  { re: /\bsaturday\b/i, label: 'Saturday' },
  { re: /\bsunday\b/i, label: 'Sunday' },
];

function indexOfWord(haystack: string, needle: string): number {
  if (!needle.trim()) return -1;
  const lower = haystack.toLowerCase();
  const n = needle.toLowerCase().trim();
  // Prefer whole-word match.
  const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  const m = re.exec(haystack);
  if (m) return m.index;
  return lower.indexOf(n);
}

/** Character offsets of filled slots in the utterance, sorted ascending. */
export function findSlotFills(
  utterance: string,
  filled: Partial<Record<SlotKey, string | undefined>>
): Array<{ key: SlotKey; at: number }> {
  const fills: Array<{ key: SlotKey; at: number }> = [];
  if (!utterance.trim()) return fills;

  if (filled.assignee?.trim()) {
    const at = indexOfWord(utterance, filled.assignee);
    if (at >= 0) fills.push({ key: 'assignee', at });
  }

  if (filled.due?.trim()) {
    let at = -1;
    for (const cue of DUE_CUES) {
      const m = cue.re.exec(utterance);
      if (m && (at < 0 || m.index < at)) at = m.index;
    }
    if (at < 0) at = indexOfWord(utterance, filled.due);
    if (at >= 0) fills.push({ key: 'due', at });
  }

  if (filled.title?.trim()) {
    // Prefer the object noun (last significant word) so "cleaning task for the dishes"
    // lands on "dishes", after any leading verb.
    const words = filled.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['the', 'and', 'for', 'task'].includes(w));
    let at = -1;
    for (const word of words) {
      const idx = indexOfWord(utterance, word);
      if (idx >= 0 && (at < 0 || idx < at)) at = idx;
    }
    if (at < 0) at = indexOfWord(utterance, filled.title);
    if (at >= 0) fills.push({ key: 'title', at });
  }

  if (filled.category?.trim()) {
    const at = indexOfWord(utterance, filled.category);
    if (at >= 0) fills.push({ key: 'category', at });
  }

  if (filled.date?.trim()) {
    const at = indexOfWord(utterance, filled.date);
    if (at >= 0) fills.push({ key: 'date', at });
  }

  if (filled.time?.trim()) {
    const at = indexOfWord(utterance, filled.time);
    if (at >= 0) fills.push({ key: 'time', at });
  }

  return fills.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}

export function deriveFocusSlot(
  payload: Pick<IuiPayload, 'title' | 'assignee' | 'due' | 'libraryTaskId' | 'slotOrder'>,
  defaults: SlotKey[] = TASK_SLOT_DEFAULT
): SlotKey | null {
  const filled = new Set(payload.slotOrder ?? []);
  const order = [
    ...(payload.slotOrder ?? []),
    ...defaults.filter((key) => !filled.has(key)),
  ];
  for (const key of order) {
    if (key === 'title' && !(payload.title?.trim() || payload.libraryTaskId?.trim())) return 'title';
    if (key === 'assignee' && !payload.assignee?.trim()) return 'assignee';
    if (key === 'due' && !payload.due?.trim()) return 'due';
  }
  // Any remaining empty in defaults.
  for (const key of defaults) {
    if (key === 'title' && !(payload.title?.trim() || payload.libraryTaskId?.trim())) return 'title';
    if (key === 'assignee' && !payload.assignee?.trim()) return 'assignee';
    if (key === 'due' && !payload.due?.trim()) return 'due';
  }
  return null;
}

export function applySlotOrder(
  payload: IuiPayload,
  opts?: {
    utterance?: string;
    filled?: Array<{ key: SlotKey; at: number }>;
  }
): IuiPayload {
  const utterance = opts?.utterance ?? payload.sourceUtterance ?? '';
  const fills =
    opts?.filled ??
    findSlotFills(utterance, {
      title: payload.title,
      assignee: payload.assignee,
      due: payload.due,
      category: payload.category,
      date: payload.date,
      time: payload.time,
    });
  const slotOrder = fills.map((f) => f.key);
  // Deduplicate while preserving order.
  const seen = new Set<SlotKey>();
  const unique: SlotKey[] = [];
  for (const key of slotOrder) {
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(key);
  }
  const next: IuiPayload = {
    ...payload,
    slotOrder: unique,
    focusSlot: deriveFocusSlot({ ...payload, slotOrder: unique }),
  };
  return next;
}

/** Model may not overwrite a slot the person already filled (in slotOrder). */
export function canAcceptModelSlotPatch(payload: IuiPayload, slot: SlotKey): boolean {
  if (payload.slotOrder?.includes(slot)) return false;
  const source = payload.slotSource?.[slot];
  if (source === 'speech' || source === 'touch') return false;
  return true;
}

/** Render order: spoken fills first (their order), then remaining defaults. */
export function renderSlotOrder(payload: IuiPayload, defaults: SlotKey[] = TASK_SLOT_DEFAULT): SlotKey[] {
  const spoken = payload.slotOrder ?? [];
  const rest = defaults.filter((key) => !spoken.includes(key));
  return [...spoken, ...rest];
}
