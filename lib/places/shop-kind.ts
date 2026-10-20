export type NearbyShopKind = 'grocery' | 'clothing' | 'retail';

const GROCERY_TAGS = new Set(['supermarket', 'convenience', 'greengrocer', 'butcher', 'bakery']);
const CLOTHING_TAGS = new Set(['clothes', 'fashion', 'boutique', 'shoes', 'bag']);
const RETAIL_TAGS = new Set(['department_store', 'mall', 'variety_store', 'general']);

export function shopKindFromOsmTag(shop: string | undefined): NearbyShopKind | null {
  const tag = (shop ?? '').toLowerCase();
  if (!tag) return null;
  if (GROCERY_TAGS.has(tag)) return 'grocery';
  if (CLOTHING_TAGS.has(tag)) return 'clothing';
  if (RETAIL_TAGS.has(tag)) return 'retail';
  return null;
}
