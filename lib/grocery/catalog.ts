/**
 * Canada grocery catalog — offline loaders.
 */
import catalogJson from '@/data/canada-grocery-catalog.json';
import { emojiForGroceryItem } from '@/lib/grocery/item-emoji';

export type BrowseCategory = {
  id: string;
  name: string;
  categoryId: string;
  icon: string;
};

export type CatalogProduct = {
  id: string;
  name: string;
  aliases: string[];
  brand?: string;
  browseCategory: string;
  categoryId: string;
  icon: string;
  tags: string[];
  storeTags?: string[];
};

type CatalogDoc = {
  version: string;
  region: string;
  browseCategories: BrowseCategory[];
  products: CatalogProduct[];
};

const DOC = catalogJson as CatalogDoc;

function withResolvedIcon(p: CatalogProduct): CatalogProduct {
  const icon = emojiForGroceryItem(p.name, p.categoryId);
  return icon === p.icon ? p : { ...p, icon };
}

const PRODUCTS = DOC.products.map(withResolvedIcon);
const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));
const BY_BROWSE = new Map<string, CatalogProduct[]>();
for (const p of PRODUCTS) {
  const list = BY_BROWSE.get(p.browseCategory) ?? [];
  list.push(p);
  BY_BROWSE.set(p.browseCategory, list);
}

export function listBrowseCategories(): BrowseCategory[] {
  const extra: BrowseCategory = {
    id: 'clothing',
    name: 'Clothing',
    categoryId: 'clothing',
    icon: '👕',
  };
  if (DOC.browseCategories.some((b) => b.id === 'clothing')) return DOC.browseCategories;
  return [...DOC.browseCategories, extra];
}

export function getCatalogProduct(id: string): CatalogProduct | undefined {
  return BY_ID.get(id);
}

export function productsByBrowseCategory(browseId: string): CatalogProduct[] {
  return BY_BROWSE.get(browseId) ?? [];
}

export function aisleIdForBrowse(browseId: string): string {
  return DOC.browseCategories.find((b) => b.id === browseId)?.categoryId ?? 'other';
}

export function allCatalogProducts(): CatalogProduct[] {
  return PRODUCTS;
}

export function catalogSize(): number {
  return PRODUCTS.length;
}

/** Icon for any grocery row (catalog or free-text). */
export function iconForGroceryName(name: string, categoryId?: string | null): string {
  return emojiForGroceryItem(name, categoryId);
}
