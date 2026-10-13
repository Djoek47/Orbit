/**
 * Persist the last uncaught app error so Help / Support can show it after a crash.
 * Also appends to the Support error log ring buffer.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { recordAppError } from '@/lib/errors/error-log';

const KEY = 'orbit.lastError.v1';

export type LastAppError = {
  message: string;
  stack?: string;
  componentStack?: string;
  at: string;
};

export async function saveLastAppError(error: LastAppError): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(error));
  } catch {
    /* ignore */
  }
  await recordAppError({
    message: error.message,
    stack: error.stack,
    componentStack: error.componentStack,
    source: 'crash',
    at: error.at,
  });
}

export async function loadLastAppError(): Promise<LastAppError | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastAppError;
    if (!parsed?.message || !parsed?.at) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearLastAppError(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
