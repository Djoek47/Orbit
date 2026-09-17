/** Canonical public invite host — must match live marketing site + AASA. */
export const INVITE_WEB_ORIGIN = 'https://www.choremaxx.app';

export function inviteWebPath(code: string): string {
  return `${INVITE_WEB_ORIGIN}/join/${encodeURIComponent(code)}`;
}
