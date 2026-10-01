/**
 * App error log — ring buffer for Support, plus last-error compat for crash recovery.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  at: string;
};

function newId() {
  return `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readLog(): Promise<AppErrorEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppErrorEntry[];
    return Array.isArray(parsed) ? parsed : [];
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
  at?: string;
}): Promise<AppErrorEntry> {
  const entry: AppErrorEntry = {
    id: newId(),
    title: input.title?.trim() || undefined,
    message: input.message.trim() || 'Unknown error',
    stack: input.stack,
    componentStack: input.componentStack,
    source: input.source,
    at: input.at ?? new Date().toISOString(),
  };
  const current = await readLog();
  await writeLog([entry, ...current.filter((e) => e.message !== entry.message || e.at !== entry.at)]);

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
