import type { GroceryItem } from '@/types/orbit';

export type ShoppingSavingsSummary = {
  itemCount: number;
  onSaleCount: number;
  estimatedSavings: number;
  estimatedTotal: number;
  aisleOrder: GroceryItem[];
};

/** Sale / aisle summary for the shopping run tied to a grocery itinerary stop. */
export function summarizeShoppingRun(items: GroceryItem[]): ShoppingSavingsSummary {
  const cart = items.filter((item) => item.status === 'Missing' || item.status === 'Low');
  let estimatedSavings = 0;
  let estimatedTotal = 0;
  let onSaleCount = 0;

  for (const item of cart) {
    const typical = item.typicalPrice ?? 0;
    const sale = item.salePrice;
    if (sale != null && typical > sale) {
      estimatedSavings += typical - sale;
      estimatedTotal += sale;
      onSaleCount += 1;
    } else {
      estimatedTotal += typical || 0;
    }
  }

  const aisleOrder = [...cart].sort((a, b) => {
    const aisleA = a.aisle ?? 'ZZ';
    const aisleB = b.aisle ?? 'ZZ';
    return aisleA.localeCompare(aisleB) || a.name.localeCompare(b.name);
  });

  return {
    itemCount: cart.length,
    onSaleCount,
    estimatedSavings: Math.round(estimatedSavings * 100) / 100,
    estimatedTotal: Math.round(estimatedTotal * 100) / 100,
    aisleOrder,
  };
}
