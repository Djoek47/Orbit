import { matchListToCatalog } from '@/lib/ai/daily-insight';
import type { GroceryItem } from '@/types/orbit';

export type DealCategory = 'grocery' | 'shoes' | 'electronics' | 'furniture';

/** Catalog match shaped for the scan_deals tool — no invented sale prices. */
export type CatalogNeed = {
  id: string;
  category: 'grocery';
  title: string;
  store: string;
  keywords: string[];
};

/**
 * Match Missing/Low grocery names to the researched Canada catalog.
 * Store is a saved shop or catalog banner (IGA, Maxi, …) — never FreshMart.
 */
export function scanDealsForHousehold(input: {
  groceryNames: string[];
  categories?: DealCategory[];
}): (CatalogNeed & { savings?: number })[] {
  if (input.categories?.length && !input.categories.includes('grocery')) return [];
  const groceries: Pick<GroceryItem, 'name' | 'status'>[] = input.groceryNames.map((name) => ({
    name,
    status: 'Missing',
  }));
  return matchListToCatalog(groceries, null).map((row) => ({
    id: row.product.id,
    category: 'grocery' as const,
    title: [row.product.brand, row.product.name].filter(Boolean).join(' '),
    store: row.storeLabel ?? '',
    keywords: row.product.aliases ?? [],
  }));
}
