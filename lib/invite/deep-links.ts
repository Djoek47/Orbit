/** Parse choremaxx://join/CODE, orbit://join/CODE, or https://…/join/CODE URLs. */
export function parseInviteCodeFromUrl(url: string): string | null {
  if (!url) return null;

  try {
    const trimmed = url.trim();

    const schemeMatch = trimmed.match(/(?:choremaxx|orbit):\/\/join\/([^/?#]+)/i);
    if (schemeMatch?.[1]) {
      return decodeURIComponent(schemeMatch[1]).trim().toUpperCase();
    }

    const webMatch = trimmed.match(/(?:choremaxx|orbit)\.app\/join\/([^/?#]+)/i);
    if (webMatch?.[1]) {
      return decodeURIComponent(webMatch[1]).trim().toUpperCase();
    }

    const pathMatch = trimmed.match(/\/join\/([^/?#]+)/i);
    if (pathMatch?.[1] && !trimmed.includes('expo')) {
      return decodeURIComponent(pathMatch[1]).trim().toUpperCase();
    }
  } catch {
    return null;
  }

  return null;
}

export function inviteDeepLink(code: string) {
  return `choremaxx://join/${code}`;
}

export function inviteWebLink(code: string) {
  return `https://choremaxx.app/join/${code}`;
}

/** Legacy Orbit links — still parseable via parseInviteCodeFromUrl. */
export function inviteDeepLinkLegacy(code: string) {
  return `orbit://join/${code}`;
}
