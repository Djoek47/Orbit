/**
 * Spotlight-speed prefix/token index over catalog name + aliases.
 */
import {
  allCatalogProducts,
  type CatalogProduct,
} from '@/lib/grocery/catalog';
import { normalizeGroceryText } from '@/lib/grocery/classify';

type IndexEntry = { product: CatalogProduct; hay: string };

let INDEX: IndexEntry[] | null = null;

function buildIndex(): IndexEntry[] {
  if (INDEX) return INDEX;
  INDEX = allCatalogProducts().map((product) => {
    const parts = [product.name, ...(product.aliases ?? []), product.brand ?? ''];
    return {
      product,
      hay: normalizeGroceryText(parts.filter(Boolean).join(' ')),
    };
  });
  return INDEX;
}

/** Reset for tests. */
export function __resetGrocerySearchIndex() {
  INDEX = null;
}

/**
 * Instant search: prefix match on tokens, then substring.
 * Returns up to `limit` products ranked by match quality.
 */
export function searchCatalog(query: string, limit = 12): CatalogProduct[] {
  const q = normalizeGroceryText(query);
  if (!q || q.length < 1) return [];

  const index = buildIndex();
  const prefix: CatalogProduct[] = [];
  const token: CatalogProduct[] = [];
  const substr: CatalogProduct[] = [];
  const seen = new Set<string>();

  for (const { product, hay } of index) {
    if (seen.has(product.id)) continue;
    const tokens = hay.split(' ');
    if (tokens.some((t) => t.startsWith(q))) {
      prefix.push(product);
      seen.add(product.id);
      continue;
    }
    if (tokens.some((t) => t.includes(q))) {
      token.push(product);
      seen.add(product.id);
      continue;
    }
    if (hay.includes(q)) {
      substr.push(product);
      seen.add(product.id);
    }
  }

  return [...prefix, ...token, ...substr].slice(0, limit);
}
