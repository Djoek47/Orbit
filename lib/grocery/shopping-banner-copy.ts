/**
 * What the Lock Screen banner says during a shopping run. Pure, so it can be tested
 * without React Native (the Live Activity module itself needs the native side).
 *
 * Protocol (newline-separated subtitle), read by plugins/live-activity/LiveActivityView.swift:
 *   Monday run                         ← title
 *   3 of 8 · Dairy & Eggs              ← line 0
 *   🧀 Milk                            ← remaining items (all packed, paged on device)
 *   🧀 Cheese
 *   …
 *   #p0                                ← page index the Lock Screen is showing
 *
 * Apple forbids scrolling inside a Live Activity and caps height, so the native view shows
 * one page of BANNER_PAGE_SIZE roomy rows and Next/Previous buttons flip the page without
 * opening the app. Tapping the header still opens the run.
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

/** How many roomy rows fit on one Lock Screen page. */
export const BANNER_PAGE_SIZE = 3;

/**
 * Cap packed names so the Live Activity payload stays small. Anything beyond this is
 * counted in the native "+N more" footer after the last page.
 */
export const BANNER_PACK_MAX = 36;

/** @deprecated use BANNER_PAGE_SIZE — kept so older tests/names still resolve. */
export const BANNER_LIST_MAX = BANNER_PAGE_SIZE;

/** The checklist lines for one page (tests / previews). */
export function shoppingBannerList(
  remaining: string[],
  max = BANNER_PAGE_SIZE,
  page = 0
): string[] {
  const clean = remaining.map((name) => name.trim()).filter(Boolean);
  if (clean.length === 0) return [];
  const start = Math.max(0, page) * max;
  const shown = clean.slice(start, start + max);
  const leftAfter = clean.length - (start + shown.length);
  if (leftAfter > 0) return [...shown, `+${leftAfter} more`];
  return shown;
}

/** Pack every remaining name (capped) plus a `#p0` page marker for the Lock Screen pager. */
export function shoppingBannerPackedSubtitle(
  head: string,
  remaining: string[],
  page = 0
): string {
  const clean = remaining.map((name) => name.trim()).filter(Boolean).slice(0, BANNER_PACK_MAX);
  const overflow = Math.max(0, remaining.filter((n) => n.trim()).length - clean.length);
  const lines = [head, ...clean];
  if (overflow > 0) lines.push(`+${overflow} more`);
  lines.push(`#p${Math.max(0, page)}`);
  return lines.join('\n');
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
  const remaining = run.remaining ?? [];
  return {
    title: run.runLabel?.trim() || 'Shopping run',
    subtitle: remaining.length ? shoppingBannerPackedSubtitle(head, remaining, 0) : head,
    progressBar: { progress },
  };
}

/** The last line, shown as the banner ends. */
export function shoppingBannerFinalSubtitle(run: ShoppingRunState): string {
  return run.total > 0 && run.done >= run.total
    ? 'All picked up'
    : `${run.done} of ${run.total} picked up`;
}
