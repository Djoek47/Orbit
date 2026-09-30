/**
 * What the Lock Screen banner says during a shopping run. Pure, so it can be tested
 * without React Native (the Live Activity module itself needs the native side).
 *
 *   Monday run                    ← title: the run, and how far along
 *   3 of 8 · Dairy & Eggs
 *   ☐ Chocolate                   ← subtitle: what's still to get, by aisle order
 *   ☐ Dish
 *   ☐ On Groceries
 *   +3 more
 *   ▓▓▓▓░░░░░░░
 *
 * Apple gives a Live Activity very little room, so the list is capped and the rest is
 * counted. Items already in the cart drop off, exactly like the list in the app.
 */
export type ShoppingRunState = {
  /** Items ticked off. */
  done: number;
  /** Items on the run. */
  total: number;
  /** The aisle to head for next, when there is one. */
  nextAisle?: string;
  /** "Friday run", so the banner says which run this is. */
  runLabel?: string;
  /** What's still to get, in the order the app lists it. */
  remaining?: string[];
};

export type ShoppingBannerState = {
  title: string;
  subtitle: string;
  progressBar: { progress: number };
};

/** How many item lines fit on the Lock Screen before it gets cramped. */
export const BANNER_LIST_MAX = 5;

/** The checklist lines, capped, with "+N more" when there are others. */
export function shoppingBannerList(remaining: string[], max = BANNER_LIST_MAX): string[] {
  const clean = remaining.map((name) => name.trim()).filter(Boolean);
  // No box character: the Lock Screen view draws its own tick circle beside each line, and the
  // item's emoji leads the name (the caller passes "🧀 Swiss Cheese").
  if (clean.length <= max) return clean;
  const shown = clean.slice(0, max);
  return [...shown, `+${clean.length - max} more`];
}

export function shoppingBannerState(run: ShoppingRunState): ShoppingBannerState {
  const left = Math.max(0, run.total - run.done);
  const progress = run.total > 0 ? Math.min(1, run.done / run.total) : 0;

  if (run.total > 0 && left === 0) {
    return {
      title: run.runLabel?.trim() || 'Shopping run',
      subtitle: 'All picked up — nice one',
      progressBar: { progress },
    };
  }

  const head = `${run.done} of ${run.total} · ${run.nextAisle ?? 'Keep going'}`;
  const list = shoppingBannerList(run.remaining ?? []);
  return {
    title: run.runLabel?.trim() || 'Shopping run',
    subtitle: list.length ? [head, ...list].join('\n') : head,
    progressBar: { progress },
  };
}

/** The last line, shown as the banner ends. */
export function shoppingBannerFinalSubtitle(run: ShoppingRunState): string {
  return run.total > 0 && run.done >= run.total
    ? 'All picked up'
    : `${run.done} of ${run.total} picked up`;
}
