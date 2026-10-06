/**
 * Send Support feedback (+ selected errors / screenshots) via Supabase edge → Resend.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  formatErrorLogForCopy,
  loadErrorLog,
  type AppErrorEntry,
  type ErrorCategory,
} from '@/lib/errors/error-log';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { SupportShot } from '@/lib/support/upload-support-shot';

export type SupportDiagnostics = {
  memberRole?: string;
  openTaskCount?: number;
  pendingRewardCount?: number;
};

export type SupportFeedbackPayload = {
  message: string;
  includeErrors?: boolean;
  /** When true, attach only the newest error (crash restart flow). */
  newestOnly?: boolean;
  /** Explicit error ids to attach (checkbox selection). */
  selectedErrorIds?: string[];
  memberName?: string;
  householdId?: string;
  diagnostics?: SupportDiagnostics;
  screenshots?: SupportShot[];
};

function buildMeta(diagnostics?: SupportDiagnostics) {
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
    memberRole: diagnostics?.memberRole,
    openTaskCount: diagnostics?.openTaskCount,
    pendingRewardCount: diagnostics?.pendingRewardCount,
  };
}

function summarizeCategories(errors: AppErrorEntry[]): Partial<Record<ErrorCategory, number>> {
  const counts: Partial<Record<ErrorCategory, number>> = {};
  for (const entry of errors) {
    counts[entry.category] = (counts[entry.category] ?? 0) + 1;
  }
  return counts;
}

export async function sendSupportFeedback(
  input: SupportFeedbackPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const message = input.message.trim();
  if (!message) return { ok: false, error: 'Write a short note first.' };

  let errors: AppErrorEntry[] = [];
  let errorText = '';
  if (input.includeErrors !== false) {
    const all = await loadErrorLog();
    if (input.newestOnly && all[0]) {
      errors = [all[0]];
    } else if (input.selectedErrorIds?.length) {
      const want = new Set(input.selectedErrorIds);
      errors = all.filter((e) => want.has(e.id));
    } else if (input.selectedErrorIds && input.selectedErrorIds.length === 0) {
      errors = [];
    } else {
      errors = all.slice(0, 12);
    }
    errorText = errors.length ? formatErrorLogForCopy(errors.slice(0, 12)) : '';
  }

  const shots = (input.screenshots ?? []).slice(0, 3);
  const screenshotUrls = shots.map((s) => s.url).filter((u): u is string => Boolean(u));
  const attachments = shots
    .filter((s) => s.contentBase64 && !s.url)
    .map((s) => ({
      filename: s.filename,
      content: s.contentBase64!,
      contentType: s.contentType,
    }));

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
        categories: summarizeCategories(errors),
        memberName: input.memberName,
        householdId: input.householdId,
        meta: buildMeta(input.diagnostics),
        screenshotUrls: screenshotUrls.length ? screenshotUrls : undefined,
        attachments: attachments.length ? attachments : undefined,
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
