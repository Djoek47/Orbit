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

/** Type-ahead street/city suggestions. Nominatim; never ship a Places API key in git. */
export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Choremaxx/1.1',
    },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as unknown;
  if (!Array.isArray(rows)) return [];
  return rows.map((row, i) => {
    const r = asRecord(row);
    const display = String(r.display_name ?? q);
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    return {
      id: String(r.place_id ?? `${lat},${lng},${i}`),
      label: display.split(',').slice(0, 2).join(',').trim() || display,
      address: display,
      lat,
      lng,
    };
  }).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));
}
