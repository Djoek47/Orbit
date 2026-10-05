/** Parse choremaxx://join/CODE, orbit://join/CODE, or https://…/join/CODE URLs. */

import { inviteWebPath } from '@/lib/invites/invite-host';
import { normalizeInviteCode } from '@/lib/invites/parse-invite';
import { parseSharedDeviceInvitePayload } from '@/lib/household/shared-device-invite';

/** Shared-tablet invite: choremaxx://shared-device?label=&codes= */
export function parseSharedDeviceInviteFromUrl(url: string): string | null {
  if (!url?.trim()) return null;
  const parsed = parseSharedDeviceInvitePayload(url);
  return parsed ? url.trim() : null;
}

/** Per-member invite (Revision G): choremaxx://invite/member?token= */
export function parseMemberInviteTokenFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const trimmed = url.trim();
    const memberMatch = trimmed.match(
      /(?:choremaxx|orbit):\/\/invite\/member(?:\?|#|&|\/)?.*?(?:token=)([^&?#]+)/i
    );
    if (memberMatch?.[1]) {
      return decodeURIComponent(memberMatch[1]);
    }
    const webMatch = trimmed.match(/\/invite\/member\?[^#]*token=([^&?#]+)/i);
    if (webMatch?.[1]) {
      return decodeURIComponent(webMatch[1]);
    }
  } catch {
    return null;
  }
  return null;
}

/** Ownership transfer: orbit://transfer-household?token= */
export function parseHouseholdTransferTokenFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const trimmed = url.trim();
    const scheme = trimmed.match(
      /(?:choremaxx|orbit):\/\/transfer-household(?:\?|#|&|\/)?.*?(?:token=)([^&?#]+)/i
    );
    if (scheme?.[1]) return decodeURIComponent(scheme[1]);
    const web = trimmed.match(/\/transfer-household\?[^#]*token=([^&?#]+)/i);
    if (web?.[1]) return decodeURIComponent(web[1]);
  } catch {
    return null;
  }
  return null;
}

export function parseInviteCodeFromUrl(url: string): string | null {
  if (!url) return null;

  try {
    const trimmed = url.trim();

    const schemeMatch = trimmed.match(/(?:choremaxx|orbit):\/\/join\/([^/?#]+)/i);
    if (schemeMatch?.[1]) {
      return normalizeInviteCode(decodeURIComponent(schemeMatch[1]));
    }

    const webMatch = trimmed.match(
      /(?:choremaxx|orbit)\.(?:app|vercel\.app)\/join\/([^/?#]+)/i
    );
    if (webMatch?.[1]) {
      return normalizeInviteCode(decodeURIComponent(webMatch[1]));
    }

    const pathMatch = trimmed.match(/\/join\/([^/?#]+)/i);
    if (pathMatch?.[1] && !trimmed.includes('expo')) {
      return normalizeInviteCode(decodeURIComponent(pathMatch[1]));
    }
  } catch {
    return null;
  }

  return null;
}

export function inviteDeepLink(code: string) {
  return `choremaxx://join/${normalizeInviteCode(code)}`;
}

export function inviteWebLink(code: string) {
  return inviteWebPath(normalizeInviteCode(code));
}

/** Legacy Orbit links — still parseable via parseInviteCodeFromUrl. */
export function inviteDeepLinkLegacy(code: string) {
  return `orbit://join/${code}`;
}
