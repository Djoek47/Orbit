import type { PreferredStore } from '@/types/orbit';

/** Selectable stores for grocery itinerary stops (mock-honest). */
export const PREFERRED_STORES: PreferredStore[] = [
  {
    id: 'store-freshmart',
    name: 'FreshMart',
    address: '1200 Market Street',
    placeQuery: 'FreshMart Market Street',
  },
  {
    id: 'store-quickstop',
    name: 'QuickStop',
    address: '45 Oak Avenue',
    placeQuery: 'QuickStop Oak Avenue',
  },
  {
    id: 'store-wholesale',
    name: 'Orbit Wholesale',
    address: '880 Industrial Blvd',
    placeQuery: 'Orbit Wholesale Industrial Blvd',
  },
];

export function getPreferredStore(storeId?: string | null): PreferredStore {
  return PREFERRED_STORES.find((store) => store.id === storeId) ?? PREFERRED_STORES[0];
}
