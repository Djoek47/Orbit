/**
 * Email and password as they leave the sign-in and sign-up forms.
 *
 * Supabase Auth never puts these into SQL text: GoTrue sends them as bound parameters and
 * compares a bcrypt hash, so SQL injection through the login form is not possible today. This is
 * defence in depth: refuse input that no real email or password contains (control characters,
 * absurd lengths) before it leaves the phone, so nothing odd reaches any server we add later.
 *
 * Pure, so it can be tested without a phone.
 */

// Control characters (C0, DEL, C1) and the zero-width/bidi marks that can hide text.
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤﻿]/g;
const EMAIL_SHAPE = /^[^\s@"'`;\\<>()]+@[^\s@"'`;\\<>()]+\.[^\s@"'`;\\<>()]{2,}$/;

/** RFC 5321's practical limit. */
export const EMAIL_MAX = 254;
/** Supabase's bcrypt hashing uses the first 72 bytes; anything far longer is not a real password. */
export const PASSWORD_MAX = 128;

export type CredentialCheck = { ok: true; email: string } | { ok: false; message: string };

/** Trimmed, lowercased, invisible characters removed. */
export function cleanEmail(raw: string): string {
  return raw.replace(INVISIBLE, '').trim().toLowerCase();
}

export function checkEmail(raw: string): CredentialCheck {
  const email = cleanEmail(raw);
  if (!email) return { ok: false, message: 'Enter your email.' };
  if (email.length > EMAIL_MAX || !EMAIL_SHAPE.test(email)) {
    return { ok: false, message: 'That doesn’t look like an email address.' };
  }
  return { ok: true, email };
}

/** Passwords are never trimmed or changed — only refused when they can't be real. */
export function checkPassword(password: string): { ok: true } | { ok: false; message: string } {
  if (!password) return { ok: false, message: 'Enter your password.' };
  if (password.length > PASSWORD_MAX) {
    return { ok: false, message: `Passwords can be up to ${PASSWORD_MAX} characters.` };
  }
  if (/[\u0000-\u001F\u007F]/.test(password)) {
    return { ok: false, message: 'Your password has a character that can’t be typed. Try again.' };
  }
  return { ok: true };
}
