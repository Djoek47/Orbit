import type { ProductCatalogItem } from '@/types/orbit';

type OffProduct = {
  product_name?: string;
  brands?: string;
  image_front_small_url?: string;
  image_url?: string;
  ingredients_text?: string;
  allergens_tags?: string[];
  allergens_from_ingredients?: string;
  nutriscore_grade?: string;
  nova_group?: number;
  quantity?: string;
  categories_tags?: string[];
};

type OffResponse = {
  status: number;
  code?: string;
  product?: OffProduct;
};

function humanizeAllergenTag(tag: string) {
  return tag
    .replace(/^en:/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function estimatePrice(product: OffProduct): number {
  const name = `${product.product_name ?? ''} ${product.brands ?? ''}`.toLowerCase();
  if (name.includes('organic') || name.includes('premium')) return 6.49;
  if (name.includes('milk') || name.includes('yogurt')) return 3.79;
  if (name.includes('bread') || name.includes('bakery')) return 3.29;
  if (name.includes('snack') || name.includes('chip')) return 4.19;
  return 4.99;
}

function categoryFromOff(product: OffProduct): string {
  const tags = product.categories_tags ?? [];
  const joined = tags.join(' ').toLowerCase();
  if (joined.includes('dairy') || joined.includes('milk') || joined.includes('egg')) return 'Dairy & Eggs';
  if (joined.includes('beverage') || joined.includes('drink') || joined.includes('juice')) return 'Beverages';
  if (joined.includes('snack') || joined.includes('chip') || joined.includes('cookie')) return 'Snacks';
  if (joined.includes('frozen')) return 'Frozen';
  if (joined.includes('meat') || joined.includes('seafood') || joined.includes('fish')) return 'Meat & Seafood';
  if (joined.includes('bread') || joined.includes('bakery')) return 'Bakery';
  if (joined.includes('fruit') || joined.includes('vegetable') || joined.includes('produce')) return 'Produce';
  return 'Pantry';
}

export function mapOpenFoodFactsProduct(barcode: string, product: OffProduct): ProductCatalogItem {
  const allergens = (product.allergens_tags ?? [])
    .map(humanizeAllergenTag)
    .filter(Boolean);
  if (!allergens.length && product.allergens_from_ingredients) {
    allergens.push(product.allergens_from_ingredients);
  }

  const grade = product.nutriscore_grade?.toUpperCase();
  const nutriScore = grade && grade !== 'UNKNOWN' ? grade : undefined;

  return {
    barcode,
    name: product.product_name?.trim() || 'Unknown product',
    brand: product.brands?.split(',')[0]?.trim() || 'Open Food Facts',
    size: product.quantity || 'each',
    category: categoryFromOff(product),
    typicalPrice: estimatePrice(product),
    ingredients: product.ingredients_text?.trim() || undefined,
    allergens: allergens.length ? allergens : undefined,
    nutriScore,
    novaGroup: typeof product.nova_group === 'number' ? product.nova_group : undefined,
    imageUrl: product.image_front_small_url || product.image_url || undefined,
    source: 'openfoodfacts',
  };
}

export async function fetchOpenFoodFactsProduct(barcode: string): Promise<ProductCatalogItem | null> {
  const trimmed = barcode.trim();
  if (!trimmed) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(trimmed)}.json`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'OrbitHouseholdApp/1.0 (Expo; grocery-scan)',
      },
    });
    if (!response.ok) return null;
    const json = (await response.json()) as OffResponse;
    if (json.status !== 1 || !json.product) return null;
    if (!json.product.product_name?.trim()) return null;
    return mapOpenFoodFactsProduct(trimmed, json.product);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
