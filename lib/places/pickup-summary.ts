import { getPreferredStore } from '@/data/preferred-stores';
import type { GroceryItem, SavedPlace } from '@/types/orbit';

export type PickupSummaryGroup = {
  placeId: string;
  placeName: string;
  emoji?: string;
  items: string[];
  groceryLinked: boolean;
};

export type PickupSummary = {
  total: number;
  groups: PickupSummaryGroup[];
};

function namesMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function uniquePreserve(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/**
 * Builds My Places pickup summary: place-local pickupItemNames plus Missing/Low
 * groceries attached to shop places (or the preferred-store match).
 */
export function buildPickupSummary(
  places: SavedPlace[],
  groceries: GroceryItem[],
  preferredStoreId?: string
): PickupSummary {
  const groceryNames = uniquePreserve(
    groceries
      .filter((g) => g.status === 'Missing' || g.status === 'Low')
      .map((g) => g.name)
  );

  const preferred = preferredStoreId ? getPreferredStore(preferredStoreId) : null;
  const preferredMatch =
    preferred != null
      ? places.find((p) => namesMatch(p.name, preferred.name) || namesMatch(p.address, preferred.address))
      : undefined;

  const groceryTargets = new Set<string>();
  if (groceryNames.length > 0) {
    if (preferredMatch) {
      groceryTargets.add(preferredMatch.id);
    } else {
      for (const place of places) {
        if (place.kind === 'shop') groceryTargets.add(place.id);
      }
    }
  }

  const groups: PickupSummaryGroup[] = [];

  for (const place of places) {
    const local = place.pickupItemNames ?? [];
    const groceryLinked = groceryTargets.has(place.id);
    const merged = uniquePreserve([
      ...local,
      ...(groceryLinked ? groceryNames : []),
    ]);
    if (merged.length === 0) continue;
    groups.push({
      placeId: place.id,
      placeName: place.name,
      emoji: place.emoji,
      items: merged,
      groceryLinked,
    });
  }

  return {
    total: groups.reduce((n, g) => n + g.items.length, 0),
    groups,
  };
}
