import type { GroceryItem, StoreRecommendation } from '@/types/orbit';
import { matchGroceryToCatalog } from '@/lib/ai/daily-insight';

/**
 * Honest list summary for grocery home — catalog names, no invented stores.
 * Nearby OSM shops are attached later by shopping-mode / itinerary, not here.
 */
export function buildStoreRecommendations(
  householdId: string | null | undefined,
  groceries: GroceryItem[]
): StoreRecommendation[] {
  const missing = groceries.filter((item) => item.status === 'Missing' || item.status === 'Low');
  const id = householdId ?? 'local';

  if (missing.length === 0) {
    return [
      {
        id: `${id}-ready`,
        householdId: id,
        title: 'You are stocked',
        detail: 'No missing groceries right now. Poppins will suggest a store when items go low.',
        itemCount: 0,
        etaMinutes: 0,
      },
    ];
  }

  const catalogNames = missing
    .map((item) => {
      const product = matchGroceryToCatalog(item.name);
      return product ? [product.brand, product.name].filter(Boolean).join(' ') : item.name;
    })
    .slice(0, 3);

  const extra = missing.length > 3 ? ` +${missing.length - 3} more` : '';
  return [
    {
      id: `${id}-list`,
      householdId: id,
      title: `${missing.length} item${missing.length === 1 ? '' : 's'} still needed`,
      detail: catalogNames.join(', ') + extra,
      description: catalogNames.join(', ') + extra,
      itemCount: missing.length,
    },
  ];
}

export async function getLocationAwareGrocerySuggestions(
  householdId: string | null,
  groceries: GroceryItem[]
): Promise<{ recommendations: StoreRecommendation[]; locationLabel: string | null }> {
  const recommendations = buildStoreRecommendations(householdId, groceries);
  return { recommendations, locationLabel: null };
}
