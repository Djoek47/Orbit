/** Parse orbit://join/CODE or https://orbit.app/join/CODE URLs. */
export function parseInviteCodeFromUrl(url: string): string | null {
  if (!url) return null;

  try {
    const trimmed = url.trim();

    const orbitMatch = trimmed.match(/orbit:\/\/join\/([^/?#]+)/i);
    if (orbitMatch?.[1]) {
      return decodeURIComponent(orbitMatch[1]).trim().toUpperCase();
    }

    const webMatch = trimmed.match(/orbit\.app\/join\/([^/?#]+)/i);
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
  return `orbit://join/${code}`;
}

export function inviteWebLink(code: string) {
  return `https://orbit.app/join/${code}`;
}
