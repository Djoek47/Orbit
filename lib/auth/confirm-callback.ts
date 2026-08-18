/**
 * Email-confirm landing state machine.
 * Survives effect remounts: never discard a verify that already started.
 */

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
  const text = err instanceof Error ? err.message : 'Confirmation failed.';
  const lower = text.toLowerCase();
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
        ? text
        : 'This link was already used or expired. Enter the code from your email, or continue to sign in.',
    };
  }
  return { phase: 'error', message: text };
}

/**
 * Inbox links stay clickable after the first confirm. If a session already
 * exists, skip verify and do not show “Enter code” — send them into the app.
 */
export function shouldResumeSignedInOnConfirmLink(hasSession: boolean): boolean {
  return hasSession;
}
