/**
 * Durable household memory — likes, dislikes, routines.
 * Session continuity (4h) is separate: lib/poppins/iui-continuity.ts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const HOUSE_MEMORY_KEY = 'choremaxx.house.memory.v1';
export const HOUSE_MEMORY_MAX_FACTS = 40;

export type HouseFactKind = 'like' | 'dislike' | 'routine' | 'note';
export type HouseFactSource = 'spoken' | 'inferred';

export type HouseFact = {
  id: string;
  kind: HouseFactKind;
  subject: string;
  text: string;
  source: HouseFactSource;
  updatedAt: number;
};

export type HouseMemory = {
  householdId: string;
  updatedAt: number;
  firstHeardAt?: number;
  lastSituationAt?: number;
  facts: HouseFact[];
};

const PRIVACY_RE =
  /\b(password|ssn|social security|medical|diagnosis|prescription|home address)\b/i;

export function isPrivacySensitive(text: string): boolean {
  return PRIVACY_RE.test(text);
}

export function emptyHouseMemory(householdId: string, now = Date.now()): HouseMemory {
  return {
    householdId,
    updatedAt: now,
    facts: [],
  };
}

export function formatMemoryHint(memory: HouseMemory | null | undefined): string {
  if (!memory?.facts.length) return '';
  const lines = memory.facts
    .slice(-12)
    .map((fact) => `- ${fact.subject}: ${fact.kind} — ${fact.text}`);
  return `House memory (respect these; do not re-ask):\n${lines.join('\n')}`;
}

export function mergeFact(memory: HouseMemory, fact: Omit<HouseFact, 'id' | 'updatedAt'> & { id?: string }, now = Date.now()): HouseMemory {
  const subject = fact.subject.trim() || 'house';
  const text = fact.text.trim();
  if (!text) return memory;
  const id = fact.id ?? `mem-${now}`;
  const nextFact: HouseFact = {
    id,
    kind: fact.kind,
    subject,
    text,
    source: fact.source,
    updatedAt: now,
  };
  const facts = memory.facts.filter(
    (existing) =>
      !(existing.subject.toLowerCase() === subject.toLowerCase() && existing.kind === fact.kind)
  );
  facts.push(nextFact);
  return {
    ...memory,
    updatedAt: now,
    facts: facts.slice(-HOUSE_MEMORY_MAX_FACTS),
  };
}

export function markFirstHeard(memory: HouseMemory, now = Date.now()): HouseMemory {
  if (memory.firstHeardAt) return { ...memory, updatedAt: now };
  return { ...memory, firstHeardAt: now, updatedAt: now };
}

export function markSituationSpoken(memory: HouseMemory, now = Date.now()): HouseMemory {
  return { ...memory, lastSituationAt: now, updatedAt: now };
}

export function hasMetHousehold(memory: HouseMemory | null | undefined): boolean {
  return Boolean(memory?.firstHeardAt);
}

/** Local parse so IUI does not wait on Luna to remember a preference. */
export function parseHouseMemoryUtterance(text: string): Omit<HouseFact, 'id' | 'updatedAt'> | null {
  const raw = text.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  const dislike =
    raw.match(/\bdon'?t assign\s+(.+?)\s+to\s+([A-Z][a-zA-Z]+)\b/i) ??
    raw.match(/\b([A-Z][a-zA-Z]+)\s+(?:hates|doesn'?t like|does not like)\s+(.+)$/i);
  if (dislike) {
    const a = dislike[1]?.trim() ?? '';
    const b = dislike[2]?.trim() ?? '';
    const subject = /^[A-Z]/.test(a) && !/^don/i.test(a) ? a : b;
    const chore = subject === a ? b : a;
    return {
      kind: 'dislike',
      subject: subject || 'house',
      text: `${subject} should not be assigned ${chore}`.replace(/\s+/g, ' ').trim(),
      source: 'spoken',
    };
  }

  const like = raw.match(/\b([A-Z][a-zA-Z]+)\s+(?:likes|prefers|loves)\s+(.+)$/i);
  if (like) {
    return {
      kind: 'like',
      subject: like[1]!.trim(),
      text: raw,
      source: 'spoken',
    };
  }

  if (/\bwe always\b/i.test(lower) || /\bprefer(?:s|red)?\b/i.test(lower)) {
    return {
      kind: 'routine',
      subject: 'house',
      text: raw,
      source: 'spoken',
    };
  }

  return null;
}

export function assigneeBlockedByMemory(
  memory: HouseMemory | null | undefined,
  assignee: string | undefined,
  title: string | undefined
): boolean {
  if (!assignee || !memory?.facts.length) return false;
  const name = assignee.toLowerCase();
  const chore = (title ?? '').toLowerCase();
  return memory.facts.some((fact) => {
    if (fact.kind !== 'dislike') return false;
    if (fact.subject.toLowerCase() !== name && !fact.text.toLowerCase().includes(name)) return false;
    if (!chore) return true;
    const words = chore.split(/\s+/).filter((w) => w.length > 3);
    return words.length === 0 || words.some((w) => fact.text.toLowerCase().includes(w));
  });
}

export function preferredStore(memory: HouseMemory | null | undefined): string | undefined {
  const routine = memory?.facts.find(
    (fact) =>
      fact.kind === 'routine' &&
      /\b(trader joe|metro|costco|whole foods|store|shop)\b/i.test(fact.text)
  );
  return routine?.text;
}

export async function loadHouseMemory(
  householdId: string | null | undefined
): Promise<HouseMemory | null> {
  const id = householdId?.trim();
  if (!id) return null;
  try {
    const raw = await AsyncStorage.getItem(HOUSE_MEMORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HouseMemory;
    if (parsed.householdId !== id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveHouseMemory(memory: HouseMemory): Promise<void> {
  try {
    await AsyncStorage.setItem(HOUSE_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    /* ignore */
  }
}

export async function rememberHouseFact(
  householdId: string,
  fact: Omit<HouseFact, 'id' | 'updatedAt'>
): Promise<HouseMemory> {
  const current = (await loadHouseMemory(householdId)) ?? emptyHouseMemory(householdId);
  const next = mergeFact(current, fact);
  await saveHouseMemory(next);
  activeHouseMemory = next;
  return next;
}

export async function rememberActiveFact(
  fact: Omit<HouseFact, 'id' | 'updatedAt'>
): Promise<HouseMemory | null> {
  const id = activeHouseMemory?.householdId;
  if (!id) return null;
  if (isPrivacySensitive(fact.text)) return activeHouseMemory;
  return rememberHouseFact(id, fact);
}

let activeHouseMemory: HouseMemory | null = null;

export function setActiveHouseMemory(memory: HouseMemory | null) {
  activeHouseMemory = memory;
}

export function getActiveHouseMemory(): HouseMemory | null {
  return activeHouseMemory;
}
