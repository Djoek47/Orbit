import { searchProducts } from '@/data/mock-products';
import { getPreferredStore, PREFERRED_STORES } from '@/data/preferred-stores';
import { openDirections } from '@/lib/maps/directions';
import type { PreferredStore } from '@/types/orbit';

export type GroceryProductLookup = {
  query: string;
  name: string;
  brand?: string;
  category: string;
  packSize: string;
  /** Estimated shelf price for the pack. */
  estimatedPackPrice: number;
  /** USD per liter when volume product. */
  pricePerLiter?: number;
  /** USD per US gallon when volume product. */
  pricePerGallon?: number;
  unitHint: string;
  store: PreferredStore;
  confidence: 'high' | 'medium' | 'low';
  note: string;
};

const VOLUME_HINTS = [
  { re: /\b(milk|oat milk|almond milk|soy milk)\b/i, liters: 1, label: '1 L carton' },
  { re: /\b(juice|orange juice)\b/i, liters: 1, label: '1 L bottle' },
  { re: /\b(water)\b/i, liters: 1.5, label: '1.5 L bottle' },
  { re: /\b(oil|olive oil)\b/i, liters: 0.5, label: '500 ml bottle' },
  { re: /\b(soda|cola|sparkling)\b/i, liters: 2, label: '2 L bottle' },
];

const LITERS_PER_GALLON = 3.78541;

function estimateVolume(query: string, size?: string) {
  for (const hint of VOLUME_HINTS) {
    if (hint.re.test(query) || (size && hint.re.test(size))) {
      return hint;
    }
  }
  const ml = size?.match(/(\d+(?:\.\d+)?)\s*ml/i)?.[1];
  if (ml) {
    const liters = Number(ml) / 1000;
    return { liters, label: size ?? `${ml} ml` };
  }
  const lit = size?.match(/(\d+(?:\.\d+)?)\s*l\b/i)?.[1];
  if (lit) {
    return { liters: Number(lit), label: size ?? `${lit} L` };
  }
  return null;
}

function heuristicPackPrice(query: string, category: string): number {
  const q = query.toLowerCase();
  if (/milk|dairy|egg/.test(q) || category.includes('Dairy')) return 3.49;
  if (/berry|produce|apple|banana|lettuce/.test(q) || category === 'Produce') return 2.99;
  if (/paper|towel|soap|clean/.test(q) || category === 'Household' || category === 'Cleaning') return 4.79;
  if (/bread|bakery/.test(q) || category === 'Bakery') return 3.29;
  if (/meat|chicken|beef|fish/.test(q) || category.includes('Meat')) return 8.99;
  return 4.25;
}

/**
 * Mock-first product lookup for grocery search: unit prices + preferred/nearby store.
 * Not a live retailer API — honest estimates for Expo Go.
 */
export function lookupGroceryProduct(
  rawQuery: string,
  preferredStoreId?: string | null,
): GroceryProductLookup | null {
  const query = rawQuery.trim();
  if (query.length < 2) return null;

  const catalog = searchProducts(query)[0];
  const store = getPreferredStore(preferredStoreId) ?? PREFERRED_STORES[0];
  const name = catalog?.name ?? query.replace(/\b\w/g, (c) => c.toUpperCase());
  const category = catalog?.category ?? 'Other';
  const packPrice = catalog?.salePrice ?? catalog?.typicalPrice ?? heuristicPackPrice(query, category);
  const volume = estimateVolume(query, catalog?.size);
  const packSize = catalog?.size ?? volume?.label ?? '1 item';

  let pricePerLiter: number | undefined;
  let pricePerGallon: number | undefined;
  let unitHint = 'pack estimate';

  if (volume && volume.liters > 0) {
    pricePerLiter = Math.round((packPrice / volume.liters) * 100) / 100;
    pricePerGallon = Math.round(pricePerLiter * LITERS_PER_GALLON * 100) / 100;
    unitHint = `≈ $${pricePerLiter.toFixed(2)}/L · $${pricePerGallon.toFixed(2)}/gal`;
  }

  return {
    query,
    name,
    brand: catalog?.brand,
    category,
    packSize,
    estimatedPackPrice: Math.round(packPrice * 100) / 100,
    pricePerLiter,
    pricePerGallon,
    unitHint,
    store,
    confidence: catalog ? 'high' : volume ? 'medium' : 'low',
    note: [
      unitHint !== 'pack estimate' ? unitHint : null,
      `Est. at ${store.name}`,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

export async function openStoreForLookup(result: GroceryProductLookup) {
  return openDirections(undefined, {
    address: result.store.address,
    placeQuery: result.store.placeQuery,
  });
}
