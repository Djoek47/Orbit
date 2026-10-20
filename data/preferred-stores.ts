import type { PreferredStore } from '@/types/orbit';

/** Selectable stores for grocery itinerary stops (mock-honest + fallback coords). */
export const PREFERRED_STORES: PreferredStore[] = [
  {
    id: 'store-freshmart',
    name: 'FreshMart',
    address: '1200 Market Street',
    placeQuery: 'FreshMart Market Street',
    lat: 37.7785,
    lng: -122.417,
    source: 'curated',
  },
  {
    id: 'store-quickstop',
    name: 'QuickStop',
    address: '45 Oak Avenue',
    placeQuery: 'QuickStop Oak Avenue',
    lat: 37.7749,
    lng: -122.4194,
    source: 'curated',
  },
  {
    id: 'store-wholesale',
    name: 'Orbit Wholesale',
    address: '880 Industrial Blvd',
    placeQuery: 'Orbit Wholesale Industrial Blvd',
    lat: 37.768,
    lng: -122.39,
    source: 'curated',
  },
];

export function getPreferredStore(storeId?: string | null): PreferredStore {
  return PREFERRED_STORES.find((store) => store.id === storeId) ?? PREFERRED_STORES[0]!;
}
