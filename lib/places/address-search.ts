import { formatNominatimUsCa } from '@/lib/places/address-format';

export type AddressSuggestion = {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** Type-ahead street/city suggestions. Nominatim; US + Canada only. */
export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1` +
    `&limit=8&countrycodes=us,ca&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Choremaxx/1.1',
    },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as unknown;
  if (!Array.isArray(rows)) return [];

  const out: AddressSuggestion[] = [];
  const seen = new Set<string>();
  for (const [i, row] of rows.entries()) {
    const r = asRecord(row);
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const formatted = formatNominatimUsCa(r.address, q);
    if (!formatted) continue;
    if (seen.has(formatted)) continue;
    seen.add(formatted);
    const label = formatted.split(',').slice(0, 2).join(',').trim() || formatted;
    out.push({
      id: String(r.place_id ?? `${lat},${lng},${i}`),
      label,
      address: formatted,
      lat,
      lng,
    });
    if (out.length >= 6) break;
  }
  return out;
}
