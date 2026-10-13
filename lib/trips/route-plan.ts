/** Pure route math for the map-first trip planner. No RN imports — tested with tsx. */

export type LatLng = { lat: number; lng: number };

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function hasCoords(p: Partial<LatLng> | null | undefined): p is LatLng {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

/** Great-circle distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Total km of a path. Optional `start` is prepended (e.g. Home); `returnTo` is appended
 * (round trip). Points without coordinates are skipped.
 */
export function pathKm(points: Partial<LatLng>[], start?: LatLng | null, returnTo?: LatLng | null): number {
  const pts: LatLng[] = [];
  if (start) pts.push(start);
  for (const p of points) if (hasCoords(p)) pts.push(p);
  if (returnTo && pts.length) pts.push(returnTo);
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += haversineKm(pts[i - 1]!, pts[i]!);
  return total;
}

/** Drive estimate: ~30 km/h city average + 5 min per stop. */
export function estimateDriveMinutes(km: number, stops: number): number {
  return Math.round((km / 30) * 60 + stops * 5);
}

export type OptimizeMode = 'shortest' | 'round-trip';

/**
 * Reorder stops: nearest-neighbour from `start` (or the first stop) then 2-opt.
 * 'round-trip' scores the closed loop back to `start`. Stops without coordinates keep
 * their relative order and are appended at the end.
 */
export function optimizeOrder<T extends Partial<LatLng>>(
  stops: T[],
  mode: OptimizeMode,
  start?: LatLng | null
): T[] {
  const located = stops.filter((s) => hasCoords(s)) as (T & LatLng)[];
  const unlocated = stops.filter((s) => !hasCoords(s));
  if (located.length < 2) return [...located, ...unlocated];

  const anchor: LatLng | null = start ?? null;
  const fixedFirst = anchor ? null : located[0]!;
  const pool = fixedFirst ? located.slice(1) : [...located];
  const order: (T & LatLng)[] = fixedFirst ? [fixedFirst] : [];
  let cur: LatLng = anchor ?? fixedFirst!;
  while (pool.length) {
    let best = 0;
    let bestD = Infinity;
    pool.forEach((p, i) => {
      const d = haversineKm(cur, p);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const [next] = pool.splice(best, 1);
    order.push(next!);
    cur = next!;
  }

  const back = mode === 'round-trip' ? (anchor ?? order[0]!) : null;
  const score = (o: LatLng[]) => pathKm(o, anchor, back);
  const lockFirst = fixedFirst ? 1 : 0;
  let improved = true;
  let guard = 0;
  let bestKm = score(order);
  while (improved && guard++ < 200) {
    improved = false;
    for (let i = lockFirst; i < order.length - 1; i++) {
      for (let k = i + 1; k < order.length; k++) {
        const cand = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
        const km = score(cand);
        if (km < bestKm - 1e-9) {
          order.splice(0, order.length, ...cand);
          bestKm = km;
          improved = true;
        }
      }
    }
  }
  return [...order, ...unlocated];
}

/** km saved going from `before` to `after` (>= 0, rounded to 0.1). */
export function kmSaved(beforeKm: number, afterKm: number): number {
  return Math.max(0, Math.round((beforeKm - afterKm) * 10) / 10);
}

export function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
