/**
 * Shared-device face picker — sizes and row breaks for 2–6 hosted profiles.
 * Pure so layout stays testable without React Native.
 */

export type ProfilePickerLayout = {
  columns: number;
  tileWidth: number;
  ring: number;
  gap: number;
};

export function profilePickerLayout(profileCount: number): ProfilePickerLayout {
  const n = Math.min(6, Math.max(1, profileCount || 1));
  if (n === 1) return { columns: 1, tileWidth: 160, ring: 112, gap: 16 };
  if (n === 2) return { columns: 2, tileWidth: 152, ring: 112, gap: 20 };
  if (n === 3) return { columns: 3, tileWidth: 112, ring: 96, gap: 16 };
  if (n === 4) return { columns: 2, tileWidth: 136, ring: 96, gap: 18 };
  if (n === 5) return { columns: 3, tileWidth: 108, ring: 84, gap: 14 };
  return { columns: 3, tileWidth: 102, ring: 78, gap: 12 };
}

export function profilePickerRows<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

/** User-facing device name — never "iPad" on this screen. */
export function normalizeSharedDeviceLabel(raw: string | undefined | null): string {
  const trimmed = raw?.trim();
  if (!trimmed) return 'Shared device';
  return trimmed
    .replace(/\bfamily\s+tablet\b/i, 'Family device')
    .replace(/\bshared\s+tablet\b/i, 'Shared device')
    .replace(/\bi\s*pad\b/gi, 'device')
    .replace(/\btablet\b/gi, 'device');
}
