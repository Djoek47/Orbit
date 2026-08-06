/**
 * Shopping-mode palette — map HTML amber-glass / olive / ember roles
 * onto orbit tokens (no hard-locked espresso hex as product SoT).
 */

/** Duck-type so tests need not import RN StyleSheet via orbit-theme. */
export type OrbitColorLike = {
  background: string;
  backgroundSoft: string;
  shell: string;
  text: string;
  textSoft: string;
  textMuted: string;
  textSubtle: string;
  textFaint: string;
  success: string;
  warning: string;
  danger: string;
  accent: string;
  card: string;
  border: string;
};

export type ShoppingPalette = {
  canvas: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  inkFaint: string;
  olive: string;
  oliveLo: string;
  ember: string;
  glass: string;
  glassHi: string;
  glassEdge: string;
  qtyBg: string;
  dockBg: string;
  guessBg: string;
  guessBorder: string;
  guessText: string;
  ambientOlive: string;
  ambientEmber: string;
};
export function resolveShoppingPalette(c: OrbitColorLike): ShoppingPalette {
  return {
    canvas: c.background,
    ink: c.text,
    inkSoft: c.textSoft,
    inkMuted: c.textMuted,
    inkFaint: c.textSubtle || c.textFaint,
    olive: c.success,
    oliveLo: c.accent,
    ember: c.danger,
    glass: 'rgba(255, 242, 220, 0.055)',
    glassHi: 'rgba(255, 240, 214, 0.14)',
    glassEdge: 'rgba(255, 236, 205, 0.13)',
    qtyBg: 'rgba(255, 242, 220, 0.07)',
    dockBg: 'rgba(30, 22, 16, 0.55)',
    guessBg: `${c.success}33`,
    guessBorder: `${c.success}59`,
    guessText: c.success,
    ambientOlive: `${c.success}6B`,
    ambientEmber: `${c.danger}3D`,
  };
}

export type ShoppingListItem = {
  id: string;
  name: string;
  quantity?: string;
  category: string;
  categoryId?: string;
  done: boolean;
};

export type ShoppingAisleGroup = {
  categoryId: string;
  categoryName: string;
  remaining: number;
  items: ShoppingListItem[];
};

/**
 * Group shopping items by aisle; within each aisle undone first, then done.
 * Empty aisles omitted. Remaining count = undone only.
 */
export function groupShoppingAisles(
  items: ShoppingListItem[],
  groupByAisleFn: <T extends { category: string }>(
    items: T[]
  ) => Array<{ categoryId: string; categoryName: string; items: T[] }>
): ShoppingAisleGroup[] {
  const grouped = groupByAisleFn(items);
  return grouped.map((g) => {
    const sorted = [...g.items].sort((a, b) => {
      const aa = (a as ShoppingListItem).done ? 1 : 0;
      const bb = (b as ShoppingListItem).done ? 1 : 0;
      return aa - bb;
    }) as ShoppingListItem[];
    return {
      categoryId: g.categoryId,
      categoryName: g.categoryName,
      remaining: sorted.filter((i) => !i.done).length,
      items: sorted,
    };
  });
}

export function shoppingProgress(items: ShoppingListItem[]): {
  total: number;
  done: number;
  left: number;
  ratio: number;
} {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  return {
    total,
    done,
    left: total - done,
    ratio: total ? done / total : 0,
  };
}

/** Weekday run label for eyebrow, e.g. "Saturday run". */
export function shoppingRunLabel(now = new Date()): string {
  const day = now.toLocaleDateString('en-CA', { weekday: 'long' });
  return `${day} run`;
}
