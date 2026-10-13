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
import { edgeErrorMessage } from '@/lib/supabase/edge-error';
import { MAX_SUPPORT_SHOTS, type SupportShot } from '@/lib/support/upload-support-shot';

/** Resend caps a message at 40MB (after base64); stay well under it. */
const MAX_SHOT_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_SHOT_BYTES = 20 * 1024 * 1024;

function stripDataUri(b64: string): string {
  return b64.replace(/^data:[^;,]+;base64,/, '').replace(/\s+/g, '');
}

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
  /**
   * The selected entries themselves (as shown on screen). Preferred over ids: a reload can
   * re-mint ids for legacy rows, which made the id filter match nothing → empty error log.
   */
  selectedErrors?: AppErrorEntry[];
  memberName?: string;
  householdId?: string;
  diagnostics?: SupportDiagnostics;
  screenshots?: SupportShot[];
};

export type SupportFeedbackResult =
  | { ok: true; ticketRef?: string; ackEmailed?: boolean }
  | { ok: false; error: string };

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
): Promise<SupportFeedbackResult> {
  const message = input.message.trim();
  if (!message) return { ok: false, error: 'Write a short note first.' };

  let errors: AppErrorEntry[] = [];
  let errorText = '';
  if (input.includeErrors !== false) {
    const all = await loadErrorLog();
    if (input.newestOnly && all[0]) {
      errors = [all[0]];
    } else if (input.selectedErrors?.length) {
      errors = input.selectedErrors;
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

  const shots = (input.screenshots ?? []).slice(0, MAX_SUPPORT_SHOTS);
  const screenshotUrls = shots.map((s) => s.url).filter((u): u is string => Boolean(u));
  // Always attach the file itself — even when it was also uploaded to Storage (previously
  // uploaded shots were sent as signed links only, so the email had no pictures).
  const attachments: { filename: string; content: string; contentType: string }[] = [];
  let attachedBytes = 0;
  for (const s of shots) {
    const content = stripDataUri(s.contentBase64 ?? '');
    if (!content) continue;
    const bytes = Math.floor((content.length * 3) / 4);
    if (bytes > MAX_SHOT_BYTES || attachedBytes + bytes > MAX_TOTAL_SHOT_BYTES) continue;
    attachedBytes += bytes;
    attachments.push({ filename: s.filename, content, contentType: s.contentType || 'image/jpeg' });
  }
  const errorDetails = errors.slice(0, 12).map((e) => ({
    title: e.title,
    message: e.message,
    category: e.category,
    source: e.source,
    at: e.at,
    stack: e.stack?.slice(0, 8000),
    componentStack: e.componentStack?.slice(0, 4000),
  }));

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'Not connected. Try again when you’re online.' };
    }

    // Edge requires JWT (verify_jwt). Profile-code / signed-out devices can't send.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) {
      return {
        ok: false,
        error: 'Sign in with Apple or email on this device to send feedback.',
      };
    }

    const { data, error } = await supabase.functions.invoke('send-support-feedback', {
      body: {
        message,
        errorLog: errorText || undefined,
        errors: errorDetails.length ? errorDetails : undefined,
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
      const detail = await edgeErrorMessage(error, 'Could not send feedback.');
      // Prefer inbox-specific copy over generic non-2xx.
      if (/not configured|503/i.test(detail)) {
        return { ok: false, error: 'Support email isn’t set up on the server yet. Try mailto below.' };
      }
      if (/unauthorized|jwt|sign in/i.test(detail)) {
        return {
          ok: false,
          error: 'Sign in with Apple or email on this device to send feedback.',
        };
      }
      return { ok: false, error: detail };
    }

    const payload = data as {
      ok?: boolean;
      error?: string;
      ticketRef?: string;
      ackEmailed?: boolean;
    } | null;

    if (payload?.error || payload?.ok === false) {
      return { ok: false, error: String(payload?.error ?? 'Could not send feedback.') };
    }

    // Require an explicit success signal — never treat an empty body as "sent".
    const ticketRef = typeof payload?.ticketRef === 'string' ? payload.ticketRef : undefined;
    if (!payload || (payload.ok !== true && !ticketRef)) {
      return {
        ok: false,
        error: 'Could not send feedback. Try again, or email support below.',
      };
    }

    return {
      ok: true,
      ticketRef,
      ackEmailed: payload.ackEmailed === true,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not send feedback.',
    };
  }
}
