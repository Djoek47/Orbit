/**
 * Offline grocery aisle classifier — Revision C §4.3.
 * Dictionary lookup only. No network. No Poppins.
 */

import groceryCategoriesJson from '@/data/choremaxx-grocery-categories.json';

export type GroceryCategoryId = string;

export type GroceryCategoryDef = {
  id: string;
  name: string;
  description: string;
  order: number;
};

export type ClassifyResult = {
  categoryId: string;
  categoryName: string;
  /** Leading quantity stripped for display, e.g. "2 lbs". */
  quantityDisplay?: string;
  /** Item text used for classification after quantity strip. */
  itemName: string;
  matched?: string;
  confidence: 'exact' | 'phrase' | 'head' | 'singular' | 'fuzzy' | 'override' | 'fallback';
};

type LexiconDoc = {
  version: string;
  defaultCategory: string;
  categories: GroceryCategoryDef[];
  lexicon: Record<string, string>;
};

const DOC = groceryCategoriesJson as LexiconDoc;

const CATEGORIES_BY_ID = new Map(DOC.categories.map((c) => [c.id, c]));
const CATEGORIES_BY_ORDER = [...DOC.categories].sort((a, b) => a.order - b.order);

/** Multi-word phrases longest-first for cascade step 2. */
const PHRASES = Object.keys(DOC.lexicon)
  .filter((k) => k.includes(' '))
  .sort((a, b) => b.length - a.length || a.localeCompare(b));

const QTY_PREFIX =
  /^(\d+(?:\.\d+)?\s*(?:lb|lbs|kg|g|oz|x|pack|packs|dozen|l|ml)?)\s+/i;

export function listGroceryCategories(): GroceryCategoryDef[] {
  return CATEGORIES_BY_ORDER;
}

export function categoryNameForId(id: string): string {
  return CATEGORIES_BY_ID.get(id)?.name ?? CATEGORIES_BY_ID.get(DOC.defaultCategory)?.name ?? 'Other';
}

export function categoryIdForName(name: string): string {
  const lower = name.trim().toLowerCase();
  for (const c of DOC.categories) {
    if (c.name.toLowerCase() === lower || c.id === lower) return c.id;
  }
  return DOC.defaultCategory;
}

/** Normalize for lexicon lookup. */
export function normalizeGroceryText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripLeadingQuantity(raw: string): {
  quantityDisplay?: string;
  remainder: string;
} {
  const trimmed = raw.trim();
  const match = trimmed.match(QTY_PREFIX);
  if (!match) return { remainder: trimmed };
  return {
    quantityDisplay: match[1].trim(),
    remainder: trimmed.slice(match[0].length).trim() || trimmed,
  };
}

function lookupExact(norm: string): string | undefined {
  return DOC.lexicon[norm];
}

function lookupLongestPhrase(norm: string): { id: string; matched: string } | undefined {
  for (const phrase of PHRASES) {
    if (norm === phrase || norm.endsWith(` ${phrase}`) || norm.startsWith(`${phrase} `) || norm.includes(` ${phrase} `)) {
      return { id: DOC.lexicon[phrase], matched: phrase };
    }
  }
  return undefined;
}

function lookupHeadNoun(norm: string): { id: string; matched: string } | undefined {
  const tokens = norm.split(' ').filter(Boolean);
  if (!tokens.length) return undefined;
  const head = tokens[tokens.length - 1];
  const id = DOC.lexicon[head];
  if (id) return { id, matched: head };
  return undefined;
}

function singularize(token: string): string {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
}

function lookupSingular(norm: string): { id: string; matched: string } | undefined {
  const tokens = norm.split(' ').filter(Boolean);
  const singularTokens = tokens.map(singularize);
  const singularNorm = singularTokens.join(' ');
  if (singularNorm === norm) return undefined;

  const exact = lookupExact(singularNorm);
  if (exact) return { id: exact, matched: singularNorm };

  const phrase = lookupLongestPhrase(singularNorm);
  if (phrase) return phrase;

  return lookupHeadNoun(singularNorm);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length];
}

function lookupFuzzy(norm: string): { id: string; matched: string } | undefined {
  const tokens = norm.split(' ').filter((t) => t.length >= 5);
  let best: { id: string; matched: string; dist: number } | undefined;
  for (const token of tokens) {
    for (const [term, id] of Object.entries(DOC.lexicon)) {
      if (term.includes(' ')) continue;
      if (term.length < 5) continue;
      const dist = levenshtein(token, term);
      if (dist <= 1 && (!best || dist < best.dist)) {
        best = { id, matched: term, dist };
      }
    }
  }
  return best ? { id: best.id, matched: best.matched } : undefined;
}

function resolveCategory(
  id: string,
  confidence: ClassifyResult['confidence'],
  matched: string | undefined,
  itemName: string,
  quantityDisplay?: string
): ClassifyResult {
  const cat = CATEGORIES_BY_ID.get(id) ?? CATEGORIES_BY_ID.get(DOC.defaultCategory)!;
  return {
    categoryId: cat.id,
    categoryName: cat.name,
    quantityDisplay,
    itemName,
    matched,
    confidence,
  };
}

/**
 * Classify a grocery line. Optional householdOverrides checked first
 * (normalized item name → category id).
 */
export function classifyGroceryItem(
  rawInput: string,
  householdOverrides?: Record<string, string> | null
): ClassifyResult {
  const { quantityDisplay, remainder } = stripLeadingQuantity(rawInput);
  const itemName = remainder.trim() || rawInput.trim();
  const norm = normalizeGroceryText(itemName);

  if (!norm) {
    return resolveCategory(DOC.defaultCategory, 'fallback', undefined, itemName, quantityDisplay);
  }

  if (householdOverrides) {
    const overrideId = householdOverrides[norm];
    if (overrideId && CATEGORIES_BY_ID.has(overrideId)) {
      return resolveCategory(overrideId, 'override', norm, itemName, quantityDisplay);
    }
  }

  const exact = lookupExact(norm);
  if (exact) return resolveCategory(exact, 'exact', norm, itemName, quantityDisplay);

  const phrase = lookupLongestPhrase(norm);
  if (phrase) return resolveCategory(phrase.id, 'phrase', phrase.matched, itemName, quantityDisplay);

  const head = lookupHeadNoun(norm);
  if (head) return resolveCategory(head.id, 'head', head.matched, itemName, quantityDisplay);

  const singular = lookupSingular(norm);
  if (singular) {
    return resolveCategory(singular.id, 'singular', singular.matched, itemName, quantityDisplay);
  }

  const fuzzy = lookupFuzzy(norm);
  if (fuzzy) return resolveCategory(fuzzy.id, 'fuzzy', fuzzy.matched, itemName, quantityDisplay);

  return resolveCategory(DOC.defaultCategory, 'fallback', undefined, itemName, quantityDisplay);
}

/** Persist a correction into a household override map (immutable update). */
export function withCategoryOverride(
  overrides: Record<string, string> | null | undefined,
  itemName: string,
  categoryId: string
): Record<string, string> {
  const norm = normalizeGroceryText(stripLeadingQuantity(itemName).remainder);
  return { ...(overrides ?? {}), [norm]: categoryId };
}

/** Group items by aisle order; omit empty categories. */
export function groupByAisle<T extends { category: string }>(
  items: T[]
): { categoryId: string; categoryName: string; order: number; items: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const id = categoryIdForName(item.category);
    const list = buckets.get(id) ?? [];
    list.push(item);
    buckets.set(id, list);
  }
  return CATEGORIES_BY_ORDER.filter((c) => (buckets.get(c.id)?.length ?? 0) > 0).map((c) => ({
    categoryId: c.id,
    categoryName: c.name,
    order: c.order,
    items: buckets.get(c.id) ?? [],
  }));
}
