/** Parse invite payloads from typed codes, deep links, or scanned QR URLs. */

import { inviteWebPath } from '@/lib/invites/invite-host';

const CODE_RE = /\b((?:CMX|ORBIT|CHOREMAXX)[- ]?[A-Z0-9]{3,12})\b/i;
const PATH_RE = /(?:choremaxx|orbit):\/\/join\/([^/?#\s]+)/i;
const WEB_RE =
  /https?:\/\/(?:www\.)?(?:choremaxx|orbit)\.(?:app|vercel\.app)\/join\/([^/?#\s]+)/i;

export function normalizeInviteCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^CHOREMAXX-/, 'CMX-')
    .replace(/^(CMX|ORBIT)(?=[A-Z0-9])/, '$1-')
    .replace(/--+/g, '-');
}

export function parseInvitePayload(payload: string): string | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;

  const path = trimmed.match(PATH_RE)?.[1];
  if (path) return normalizeInviteCode(decodeURIComponent(path));

  const web = trimmed.match(WEB_RE)?.[1];
  if (web) return normalizeInviteCode(decodeURIComponent(web));

  const generic = trimmed.match(/\/join\/([^/?#\s]+)/i)?.[1];
  if (generic && !/expo/i.test(trimmed)) {
    return normalizeInviteCode(decodeURIComponent(generic));
  }

  const code = trimmed.match(CODE_RE)?.[1];
  if (code) return normalizeInviteCode(code);

  // Bare codes like "7429" are rejected; require a recognizable invite token.
  if (/^[A-Z0-9-]{4,24}$/i.test(trimmed) && /[A-Z]/i.test(trimmed)) {
    return normalizeInviteCode(trimmed);
  }

  return null;
}

export function buildInviteLinks(code: string): { code: string; deepLink: string; webLink: string } {
  const normalized = normalizeInviteCode(code);
  return {
    code: normalized,
    deepLink: `choremaxx://join/${normalized}`,
    webLink: inviteWebPath(normalized),
  };
}

export function createInviteCode() {
  return `CMX-${Math.floor(1000 + Math.random() * 9000)}`;
}
