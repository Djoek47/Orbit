/**
 * Canada grocery catalog — offline loaders.
 */
import catalogJson from '@/data/canada-grocery-catalog.json';

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

const BY_ID = new Map(DOC.products.map((p) => [p.id, p]));
const BY_BROWSE = new Map<string, CatalogProduct[]>();
for (const p of DOC.products) {
  const list = BY_BROWSE.get(p.browseCategory) ?? [];
  list.push(p);
  BY_BROWSE.set(p.browseCategory, list);
}

export function listBrowseCategories(): BrowseCategory[] {
  return DOC.browseCategories;
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
  return DOC.products;
}

export function catalogSize(): number {
  return DOC.products.length;
}
