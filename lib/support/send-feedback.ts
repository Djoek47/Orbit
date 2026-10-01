/**
 * Send Support feedback (+ optional error log) via Supabase edge → Resend.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { formatErrorLogForCopy, loadErrorLog, type AppErrorEntry } from '@/lib/errors/error-log';
import { getSupabaseClient } from '@/lib/supabase/client';

export type SupportFeedbackPayload = {
  message: string;
  includeErrors?: boolean;
  /** When true, attach only the newest error (crash restart flow). */
  newestOnly?: boolean;
  memberName?: string;
  householdId?: string;
};

function buildMeta() {
  const extras = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return {
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    build:
      Constants.nativeBuildVersion ??
      Constants.expoConfig?.ios?.buildNumber ??
      Constants.expoConfig?.android?.versionCode ??
      'dev',
    platform: Platform.OS,
    platformVersion: String(Platform.Version),
    projectId: extras?.eas?.projectId,
  };
}

export async function sendSupportFeedback(
  input: SupportFeedbackPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const message = input.message.trim();
  if (!message) return { ok: false, error: 'Write a short note first.' };

  let errors: AppErrorEntry[] = [];
  let errorText = '';
  if (input.includeErrors !== false) {
    errors = await loadErrorLog();
    if (input.newestOnly && errors[0]) {
      errors = [errors[0]];
    }
    errorText = formatErrorLogForCopy(errors.slice(0, 12));
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'Not connected. Try again when you’re online.' };
    }
    const { data, error } = await supabase.functions.invoke('send-support-feedback', {
      body: {
        message,
        errorLog: errorText || undefined,
        errorCount: errors.length,
        memberName: input.memberName,
        householdId: input.householdId,
        meta: buildMeta(),
      },
    });
    if (error) {
      return { ok: false, error: error.message || 'Could not send feedback.' };
    }
    if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
      return { ok: false, error: String((data as { error: string }).error) };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not send feedback.',
    };
  }
}
