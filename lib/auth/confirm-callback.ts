/**
 * Email-confirm landing state machine.
 * Survives effect remounts: never discard a verify that already started.
 */

import { resolveAuthIssue } from '@/lib/auth/auth-errors';

export const WAIT_FOR_LINK_MS = 3_500;
export const VERIFY_TIMEOUT_MS = 12_000;
export const WALL_CLOCK_MS = 15_000;
export const SUCCESS_HOLD_MS = 900;

export type ConfirmPhase = 'working' | 'success' | 'needs_continue' | 'error';

export type ConfirmController = {
  finished: boolean;
  handledKey: string | null;
  verifyStarted: boolean;
  shouldStartVerify: (key: string) => boolean;
  markVerifyStarted: (key: string) => void;
  markFinished: () => void;
  /** Wall-clock / bare-link escape may fire even after verify started. */
  canEscape: () => boolean;
};

export function createConfirmController(): ConfirmController {
  const state = {
    finished: false,
    handledKey: null as string | null,
    verifyStarted: false,
  };

  return {
    get finished() {
      return state.finished;
    },
    get handledKey() {
      return state.handledKey;
    },
    get verifyStarted() {
      return state.verifyStarted;
    },
    shouldStartVerify(key: string) {
      if (state.finished) return false;
      if (state.verifyStarted && state.handledKey === key) return false;
      return true;
    },
    markVerifyStarted(key: string) {
      state.verifyStarted = true;
      state.handledKey = key;
    },
    markFinished() {
      state.finished = true;
    },
    canEscape() {
      return !state.finished;
    },
  };
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function classifyConfirmError(err: unknown): { phase: ConfirmPhase; message: string } {
  const issue = resolveAuthIssue(err);
  const lower = `${issue.message} ${err instanceof Error ? err.message : ''}`.toLowerCase();
  if (
    lower.includes('expired') ||
    lower.includes('invalid') ||
    lower.includes('already') ||
    lower.includes('otp') ||
    lower.includes('timed out')
  ) {
    return {
      phase: 'needs_continue',
      message: lower.includes('timed out')
        ? 'This is taking too long. Enter the code from your email, or continue to sign in.'
        : 'This link was already used — your email is likely confirmed. Sign in, or enter the code from your email.',
    };
  }
  return { phase: 'error', message: issue.message };
}

/**
 * Inbox links stay clickable after the first confirm. If a session already
 * exists, skip verify and do not show “Enter code” — send them into the app.
 */
export function shouldResumeSignedInOnConfirmLink(hasSession: boolean): boolean {
  return hasSession;
}

/** Supabase OTP length is configurable (6–10). Strip non-digits; valid when 6–10 digits. */
export function normalizeOtpCode(raw: string): { code: string; valid: boolean } {
  const code = (raw || '').replace(/\D/g, '').slice(0, 10);
  return { code, valid: code.length >= 6 && code.length <= 10 };
}

/**
 * Signup codes are `signup`; codes from resend/magic-link on an existing user are `email`.
 * Try in this order; only retry on a token mismatch, never on rate limits.
 */
export const OTP_CODE_TYPES = ['signup', 'email'] as const;

export function isTokenMismatchError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const blob = `${e?.code ?? ''} ${e?.message ?? (typeof err === 'string' ? err : '')}`.toLowerCase();
  return (
    blob.includes('otp_expired') ||
    blob.includes('expired') ||
    blob.includes('invalid') ||
    blob.includes('not found') ||
    blob.includes('token')
  );
}

/** Link already consumed (e.g. the website or another browser verified it first) or expired. */
export function isUsedOrExpiredLinkError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const blob = `${e?.code ?? ''} ${e?.message ?? (typeof err === 'string' ? err : '')}`.toLowerCase();
  return (
    blob.includes('otp_expired') ||
    blob.includes('expired') ||
    blob.includes('already') ||
    blob.includes('invalid') ||
    blob.includes('access_denied') ||
    blob.includes('flow state') ||
    blob.includes('code verifier')
  );
}

export function isUserEmailConfirmed(
  user: { email_confirmed_at?: string | null; confirmed_at?: string | null } | null | undefined
): boolean {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at);
}

/** One in-flight check at a time; extra taps join the running promise. */
export function createSingleFlight<T>() {
  let running: Promise<T> | null = null;
  return {
    get busy() {
      return running !== null;
    },
    run(task: () => Promise<T>): Promise<T> {
      if (running) return running;
      running = (async () => {
        try {
          return await task();
        } finally {
          running = null;
        }
      })();
      return running;
    },
  };
}

export type ConfirmCheckResult = 'confirmed' | 'not_confirmed' | 'unknown';

export function confirmCheckMessage(result: ConfirmCheckResult): string {
  if (result === 'confirmed') return "You're already confirmed, continuing…";
  if (result === 'not_confirmed')
    return "Not confirmed yet. Tap the link in the email or enter the code above.";
  return "Couldn't check right now. Enter the code above, or try again in a moment.";
}
