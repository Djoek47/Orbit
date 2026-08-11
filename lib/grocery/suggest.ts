/**
 * Favorites ∪ buy-again ∪ complements ∩ not-on-list suggestions.
 */
import complementsJson from '@/data/grocery-complements.json';
import { getCatalogProduct, type CatalogProduct } from '@/lib/grocery/catalog';
import { searchCatalog } from '@/lib/grocery/search-index';
import { normalizeGroceryText } from '@/lib/grocery/classify';

type ComplementsDoc = {
  pairs: { when: string[]; suggest: string[] }[];
};

const COMP = complementsJson as ComplementsDoc;

export type SuggestContext = {
  favorites: string[];
  /** Recently purchased / cleared product names or ids. */
  buyAgain: string[];
  /** Names currently on the active list. */
  onListNames: string[];
};

function onListSet(names: string[]): Set<string> {
  return new Set(names.map((n) => normalizeGroceryText(n)));
}

function resolveNameOrId(ref: string): CatalogProduct | undefined {
  const byId = getCatalogProduct(ref);
  if (byId) return byId;
  const hits = searchCatalog(ref, 1);
  return hits[0];
}

export function listFavoriteProducts(favoriteIds: string[]): CatalogProduct[] {
  return favoriteIds
    .map((id) => getCatalogProduct(id))
    .filter((p): p is CatalogProduct => Boolean(p));
}

export function listBuyAgainProducts(namesOrIds: string[], limit = 12): CatalogProduct[] {
  const out: CatalogProduct[] = [];
  const seen = new Set<string>();
  for (const ref of namesOrIds) {
    const p = resolveNameOrId(ref);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/** Complements for items already on the list. */
export function listComplementSuggestions(
  onListNames: string[],
  limit = 8
): CatalogProduct[] {
  const onList = onListSet(onListNames);
  const out: CatalogProduct[] = [];
  const seen = new Set<string>();

  for (const name of onListNames) {
    const n = normalizeGroceryText(name);
    for (const pair of COMP.pairs) {
      if (!pair.when.some((w) => n.includes(normalizeGroceryText(w)))) continue;
      for (const s of pair.suggest) {
        if (onList.has(normalizeGroceryText(s))) continue;
        const hits = searchCatalog(s, 1);
        const p = hits[0];
        if (!p || seen.has(p.id)) continue;
        if (onList.has(normalizeGroceryText(p.name))) continue;
        seen.add(p.id);
        out.push(p);
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

/** Unified chip suggestions: favorites → buy-again → complements. */
export function listSuggestions(ctx: SuggestContext, limit = 16): CatalogProduct[] {
  const onList = onListSet(ctx.onListNames);
  const out: CatalogProduct[] = [];
  const seen = new Set<string>();

  const push = (p: CatalogProduct | undefined) => {
    if (!p || seen.has(p.id)) return;
    if (onList.has(normalizeGroceryText(p.name))) return;
    seen.add(p.id);
    out.push(p);
  };

  for (const p of listFavoriteProducts(ctx.favorites)) {
    push(p);
    if (out.length >= limit) return out;
  }
  for (const p of listBuyAgainProducts(ctx.buyAgain, limit)) {
    push(p);
    if (out.length >= limit) return out;
  }
  for (const p of listComplementSuggestions(ctx.onListNames, limit)) {
    push(p);
    if (out.length >= limit) return out;
  }
  return out;
}
