import type { GroceryItem, StoreRecommendation } from '@/types/orbit';

const STORE_TEMPLATES = [
  {
    id: 'store-freshmart',
    title: 'FreshMart',
    detail: 'Best for dairy, produce, and everyday staples',
    etaMinutes: 18,
  },
  {
    id: 'store-quickstop',
    title: 'QuickStop',
    detail: 'Closest for last-minute missing items',
    etaMinutes: 8,
  },
  {
    id: 'store-wholesale',
    title: 'Orbit Wholesale',
    detail: 'Better bulk pricing when you need several pantry items',
    etaMinutes: 28,
  },
] as const;

/** Build store recommendations from the household missing grocery list. */
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
        detail: 'No missing groceries right now. Nova will suggest a store when items go low.',
        itemCount: 0,
        etaMinutes: 0,
      },
    ];
  }

  const produceCount = missing.filter((item) =>
    /fruit|veg|produce|milk|egg|dairy|bread/i.test(`${item.name} ${item.category}`)
  ).length;
  const cleanupCount = missing.filter((item) =>
    /clean|soap|paper|detergent|bathroom/i.test(`${item.name} ${item.category}`)
  ).length;

  return STORE_TEMPLATES.map((store, index) => {
    const share =
      index === 0
        ? Math.max(1, Math.ceil(missing.length * 0.55) + produceCount)
        : index === 1
          ? Math.max(1, Math.ceil(missing.length * 0.3))
          : Math.max(1, missing.length - cleanupCount);

    const sample = missing
      .slice(0, Math.min(3, missing.length))
      .map((item) => item.name)
      .join(', ');

    return {
      id: `${id}-${store.id}`,
      householdId: id,
      storeId: store.id,
      title: store.title,
      detail: store.detail,
      description: `Suggested for: ${sample}${missing.length > 3 ? ` +${missing.length - 3} more` : ''}`,
      etaMinutes: store.etaMinutes,
      itemCount: Math.min(share, missing.length),
    };
  });
}
