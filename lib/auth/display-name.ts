/**
 * Detect Apple private-relay / email-local-part seeds that should not count
 * as a finished household display name.
 */

export function emailLocalPart(email: string | null | undefined): string {
  const trimmed = (email ?? '').trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) return '';
  return trimmed.split('@')[0] ?? '';
}

export function isApplePrivateRelayEmail(email: string | null | undefined): boolean {
  const trimmed = (email ?? '').trim().toLowerCase();
  return trimmed.endsWith('@privaterelay.appleid.com');
}

/**
 * True when `name` looks like an auth-system placeholder rather than a
 * human display name (Apple relay local-part, exact email local-part, etc.).
 */
export function looksLikeGeneratedAuthName(
  name: string | null | undefined,
  email?: string | null
): boolean {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return true;

  const local = emailLocalPart(email);
  const lower = trimmed.toLowerCase();

  if (local && lower === local) return true;
  if (isApplePrivateRelayEmail(email) && local && lower === local) return true;

  // Apple Hide My Email local-parts are typically opaque alphanumeric tokens.
  if (
    isApplePrivateRelayEmail(email) &&
    /^[a-z0-9._-]{6,}$/i.test(trimmed) &&
    !/\s/.test(trimmed)
  ) {
    return true;
  }

  // Bare email used as a "name".
  if (trimmed.includes('@')) return true;

  return false;
}

/** Profile onboarding is done only when the user has a real human name. */
export function isProfileNameComplete(
  name: string | null | undefined,
  email?: string | null
): boolean {
  const trimmed = (name ?? '').trim();
  if (trimmed.length < 2) return false;
  return !looksLikeGeneratedAuthName(trimmed, email);
}
