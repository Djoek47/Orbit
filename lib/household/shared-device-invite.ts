/**
 * Shared-device invite payloads packed into a QR (admin phone → tablet scan).
 *
 * Format: choremaxx://shared-device?label=Ipad&codes=CMX-A,CMX-B
 * Run: npx tsx lib/household/shared-device-invite.test.ts
 */
import { normalizeInviteCode } from '@/lib/invites/parse-invite';

export type SharedDeviceInvite = {
  label: string;
  codes: string[];
};

const PREFIX = 'choremaxx://shared-device';

export function buildSharedDeviceInviteLink(input: SharedDeviceInvite): string {
  const codes = [
    ...new Set(
      input.codes
        .map((code) => normalizeInviteCode(code))
        .filter(Boolean)
    ),
  ];
  const label = encodeURIComponent(input.label.trim() || 'Shared device');
  const joined = encodeURIComponent(codes.join(','));
  return `${PREFIX}?label=${label}&codes=${joined}`;
}

export function parseSharedDeviceInvitePayload(payload: string): SharedDeviceInvite | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;
  try {
    // Deep link or web-shaped URL both work.
    const url = trimmed.includes('://')
      ? new URL(trimmed)
      : trimmed.startsWith('shared-device')
        ? new URL(`choremaxx://${trimmed}`)
        : null;
    if (!url) return null;
    const host = url.host || url.pathname.replace(/^\//, '');
    if (host !== 'shared-device' && !url.pathname.includes('shared-device')) return null;
    const codesRaw = url.searchParams.get('codes') ?? '';
    const codes = codesRaw
      .split(',')
      .map((part) => normalizeInviteCode(decodeURIComponent(part)))
      .filter(Boolean);
    if (codes.length === 0) return null;
    const label = decodeURIComponent(url.searchParams.get('label') ?? 'Shared device').trim();
    return { label: label || 'Shared device', codes };
  } catch {
    return null;
  }
}
