/**
 * App error log — ring buffer for Support, plus last-error compat for crash recovery.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ERROR_CATEGORY_LABEL,
  inferErrorCategory,
  isErrorCategory,
  type ErrorCategory,
} from '@/lib/errors/error-category';

export type { ErrorCategory };
export { ERROR_CATEGORIES, ERROR_CATEGORY_LABEL, inferErrorCategory } from '@/lib/errors/error-category';

const LOG_KEY = 'orbit.errorLog.v1';
const LAST_KEY = 'orbit.lastError.v1';
const MAX_ENTRIES = 40;

export type AppErrorEntry = {
  id: string;
  title?: string;
  message: string;
  stack?: string;
  componentStack?: string;
  source?: string;
  category: ErrorCategory;
  at: string;
};

function newId() {
  return `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEntry(raw: unknown): AppErrorEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<AppErrorEntry>;
  if (typeof row.message !== 'string' || typeof row.at !== 'string') return null;
  const category = isErrorCategory(row.category)
    ? row.category
    : inferErrorCategory({ title: row.title, message: row.message, source: row.source });
  return {
    id: typeof row.id === 'string' ? row.id : newId(),
    title: typeof row.title === 'string' ? row.title : undefined,
    message: row.message,
    stack: typeof row.stack === 'string' ? row.stack : undefined,
    componentStack: typeof row.componentStack === 'string' ? row.componentStack : undefined,
    source: typeof row.source === 'string' ? row.source : undefined,
    category,
    at: row.at,
  };
}

async function readLog(): Promise<AppErrorEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEntry).filter((e): e is AppErrorEntry => Boolean(e));
  } catch {
    return [];
  }
}

async function writeLog(entries: AppErrorEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* ignore */
  }
}

export async function recordAppError(input: {
  message: string;
  title?: string;
  stack?: string;
  componentStack?: string;
  source?: string;
  category?: ErrorCategory;
  at?: string;
}): Promise<AppErrorEntry> {
  const category =
    input.category ??
    inferErrorCategory({
      title: input.title,
      message: input.message,
      source: input.source,
    });
  const entry: AppErrorEntry = {
    id: newId(),
    title: input.title?.trim() || undefined,
    message: input.message.trim() || 'Unknown error',
    stack: input.stack,
    componentStack: input.componentStack,
    source: input.source,
    category,
    at: input.at ?? new Date().toISOString(),
  };
  const current = await readLog();
  await writeLog([
    entry,
    ...current.filter((e) => e.message !== entry.message || e.at !== entry.at),
  ]);

  const last = {
    message: entry.title ? `${entry.title}: ${entry.message}` : entry.message,
    stack: entry.stack,
    componentStack: entry.componentStack,
    at: entry.at,
  };
  try {
    await AsyncStorage.setItem(LAST_KEY, JSON.stringify(last));
  } catch {
    /* ignore */
  }
  return entry;
}

export async function loadErrorLog(): Promise<AppErrorEntry[]> {
  return readLog();
}

export async function clearErrorLog(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOG_KEY);
    await AsyncStorage.removeItem(LAST_KEY);
  } catch {
    /* ignore */
  }
}

export function formatErrorForCopy(entry: AppErrorEntry): string {
  return [
    entry.title,
    entry.message,
    `At: ${entry.at}`,
    `Category: ${ERROR_CATEGORY_LABEL[entry.category]}`,
    entry.source ? `Source: ${entry.source}` : '',
    entry.stack,
    entry.componentStack,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function formatErrorLogForCopy(entries: AppErrorEntry[]): string {
  if (!entries.length) return 'No errors saved.';
  return entries.map((e, i) => `—— ${i + 1} ——\n${formatErrorForCopy(e)}`).join('\n\n');
}

/** First ~3 lines for list previews. */
export function previewErrorLines(entry: AppErrorEntry, maxLines = 3): string {
  const raw = [entry.title, entry.message].filter(Boolean).join('\n');
  return raw.split('\n').slice(0, maxLines).join('\n');
}
