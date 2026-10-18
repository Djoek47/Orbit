/**
 * Forgetting a password, end to end.
 *
 *   Forgot password  →  email with a link and a 6-digit code
 *        │                        │
 *        │ (link)                 │ (code)
 *        ▼                        ▼
 *   auth/callback  type=recovery  →  Reset password screen  →  signed in
 *
 * This module holds the parts that don't need a screen: which route a callback link belongs
 * to, whether a new password is acceptable, the resend cooldown, and — in mock mode — a
 * little inbox so the whole flow can be walked through without a mail server.
 */

/** Where an auth callback should land once its link has been verified. */
export function callbackDestination(type: string | undefined): 'recovery' | 'default' {
  return (type ?? '').toLowerCase() === 'recovery' ? 'recovery' : 'default';
}

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordProblem =
  | { ok: true }
  | { ok: false; reason: 'too_short' | 'mismatch' | 'empty'; message: string };

/** The same rules the sign-up screen uses, so a reset can't create a password that won't work. */
export function checkNewPassword(password: string, confirm: string): PasswordProblem {
  if (!password.trim()) {
    return { ok: false, reason: 'empty', message: 'Choose a new password.' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: 'too_short',
      message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (password !== confirm) {
    return { ok: false, reason: 'mismatch', message: 'Both passwords must match.' };
  }
  return { ok: true };
}

/** A 6-digit code, however it was typed ("123 456", "123-456"). */
export function normalizeResetCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

export function isCompleteResetCode(raw: string): boolean {
  return normalizeResetCode(raw).length === 6;
}

// ── Mock inbox ────────────────────────────────────────────────────────────────
// Mock mode has no mail server. Reset emails land here instead, so the flow can be walked
// through on a device with EXPO_PUBLIC_DATA_MODE=mock, and tested here.

export type MockAuthEmail = {
  to: string;
  subject: string;
  /** The 6-digit code in the email. */
  code: string;
  /** The link the email's button points at. */
  link: string;
  sentAt: number;
};

const mockInbox: MockAuthEmail[] = [];

/** Deterministic per address, so the same test email always shows the same code. */
export function mockResetCodeFor(email: string): string {
  let hash = 7;
  for (const ch of email.trim().toLowerCase()) {
    hash = (hash * 31 + ch.charCodeAt(0)) % 1_000_000;
  }
  return String(hash).padStart(6, '0');
}

export function sendMockResetEmail(email: string, now = Date.now()): MockAuthEmail {
  const code = mockResetCodeFor(email);
  const mail: MockAuthEmail = {
    to: email.trim(),
    subject: 'Reset your password',
    code,
    link: `choremaxx://auth/callback?token_hash=mock-${code}&type=recovery`,
    sentAt: now,
  };
  mockInbox.unshift(mail);
  if (mockInbox.length > 10) mockInbox.length = 10;
  return mail;
}

export function mockAuthInbox(): MockAuthEmail[] {
  return [...mockInbox];
}

export function latestMockResetEmail(email?: string): MockAuthEmail | null {
  const wanted = email?.trim().toLowerCase();
  return mockInbox.find((mail) => !wanted || mail.to.toLowerCase() === wanted) ?? null;
}

export function clearMockAuthInbox(): void {
  mockInbox.length = 0;
}

/** In mock mode the code from the mock email is the only one that opens the reset screen. */
export function mockCodeMatches(email: string, code: string): boolean {
  return normalizeResetCode(code) === mockResetCodeFor(email);
}

// ── Resend cooldown ───────────────────────────────────────────────────────────

export const RESET_RESEND_COOLDOWN_MS = 60_000;

let lastResetSentAt = 0;

export function markResetEmailSent(now = Date.now()): void {
  lastResetSentAt = now;
}

export function resetResendRemainingMs(now = Date.now()): number {
  if (!lastResetSentAt) return 0; // nothing sent yet
  return Math.max(0, lastResetSentAt + RESET_RESEND_COOLDOWN_MS - now);
}

/** "Resend in 42s", or "Resend" when it's allowed again. */
export function resendLabel(now = Date.now()): string {
  const remaining = resetResendRemainingMs(now);
  return remaining > 0 ? `Resend in ${Math.ceil(remaining / 1000)}s` : 'Resend';
}

/** For tests only — the cooldown is module state. */
export function resetCooldownForTests(): void {
  lastResetSentAt = 0;
}
