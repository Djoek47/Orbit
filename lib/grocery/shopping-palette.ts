/**
 * Shopping-mode palette — HTML structure, ChoreMaxx orbit materials.
 * No cream/espresso hex; Day/Night via glassFill formula.
 */

/** Duck-type so unit tests need not import RN. */
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
  primary: string;
  card: string;
  border: string;
};

export type ShoppingPalette = {
  canvas: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  inkFaint: string;
  /** Check / progress — brand mint. */
  accent: string;
  /** FAB / strong CTA — brand cyan. */
  primary: string;
  /** Checkmark glyph on filled box. */
  checkGlyph: string;
  glass: string;
  glassHi: string;
  glassEdge: string;
  qtyBg: string;
  dockBg: string;
  toastBtnBg: string;
  ruleTrack: string;
  guessBg: string;
  guessBorder: string;
  guessText: string;
  ambientA: string;
  ambientB: string;
  isDark: boolean;
};

function glassFill(isDark: boolean, alpha: number): string {
  return isDark
    ? `rgba(255,255,255,${alpha})`
    : `rgba(15,28,42,${Math.min(alpha * 1.15, 0.12)})`;
}

function glassBorder(isDark: boolean, alpha: number): string {
  return isDark
    ? `rgba(255,255,255,${alpha})`
    : `rgba(15,28,42,${Math.min(alpha * 1.2, 0.14)})`;
}

export function resolveShoppingPalette(
  c: OrbitColorLike,
  isDark = true
): ShoppingPalette {
  return {
    canvas: c.background,
    ink: c.text,
    inkSoft: c.textSoft,
    inkMuted: c.textMuted,
    inkFaint: c.textSubtle || c.textFaint,
    accent: c.accent,
    primary: c.primary,
    checkGlyph: isDark ? c.background : '#FFFFFF',
    glass: glassFill(isDark, 0.06),
    glassHi: glassFill(isDark, 0.1),
    glassEdge: glassBorder(isDark, 0.12),
    qtyBg: glassFill(isDark, 0.08),
    dockBg: isDark ? 'rgba(7,13,28,0.72)' : 'rgba(240,244,248,0.82)',
    toastBtnBg: glassFill(isDark, 0.12),
    ruleTrack: glassFill(isDark, 0.12),
    guessBg: `${c.accent}28`,
    guessBorder: `${c.accent}55`,
    guessText: c.accent,
    ambientA: `${c.accent}40`,
    ambientB: `${c.primary}28`,
    isDark,
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

export function shoppingRunLabel(now = new Date()): string {
  const day = now.toLocaleDateString('en-CA', { weekday: 'long' });
  return `${day} run`;
}
