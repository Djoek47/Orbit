/**
 * What the Lock Screen banner says during a shopping run. Pure, so it can be tested
 * without React Native (the Live Activity module itself needs the native side).
 *
 * Protocol (newline-separated subtitle), read by plugins/live-activity/LiveActivityView.swift:
 *   Monday run                         ← title
 *   3 of 8 · Dairy & Eggs              ← line 0
 *   #id:<uuid>|🧀 Milk                 ← remaining items with stable ids (check-off)
 *   #id:<uuid>|🧀 Cheese
 *   …
 *   #p0                                ← page index the Lock Screen is showing
 *
 * Apple forbids scrolling inside a Live Activity and caps height, so the native view shows
 * one page of BANNER_PAGE_SIZE roomy rows. Next/Previous flip pages; tapping a row checks
 * it off without opening the app (App Group → app drains into the grocery list).
 */
export type ShoppingBannerItem = {
  id: string;
  /** Display line, usually "🧀 Milk". */
  label: string;
};

export type ShoppingRunState = {
  /** Items ticked off. */
  done: number;
  /** Items on the run. */
  total: number;
  /** The aisle to head for next, when there is one. */
  nextAisle?: string;
  /** "Friday run", so the banner says which run this is. */
  runLabel?: string;
  /**
   * What's still to get, in list order.
   * Prefer `remainingItems` (with ids) so Lock Screen check-off can sync back.
   * Plain strings are still accepted for older call sites / tests.
   */
  remaining?: string[];
  remainingItems?: ShoppingBannerItem[];
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

const ID_PREFIX = '#id:';

/** Pack one checklist row for the native banner (`#id:<id>|<label>`). */
export function packBannerItem(item: ShoppingBannerItem): string {
  const id = item.id.trim();
  const label = item.label.trim();
  if (!id) return label;
  return `${ID_PREFIX}${id}|${label}`;
}

/** Unpack a subtitle line. Lines without an id still render; they just can't check off. */
export function unpackBannerItem(line: string): ShoppingBannerItem {
  const raw = line.trim();
  if (raw.startsWith(ID_PREFIX)) {
    const body = raw.slice(ID_PREFIX.length);
    const bar = body.indexOf('|');
    if (bar > 0) {
      return { id: body.slice(0, bar), label: body.slice(bar + 1) };
    }
  }
  return { id: '', label: raw };
}

function normalizeItems(run: ShoppingRunState): ShoppingBannerItem[] {
  if (run.remainingItems?.length) {
    return run.remainingItems
      .map((item) => ({ id: item.id.trim(), label: item.label.trim() }))
      .filter((item) => item.label);
  }
  return (run.remaining ?? [])
    .map((label) => ({ id: '', label: label.trim() }))
    .filter((item) => item.label);
}

/** The checklist lines for one page (tests / previews). Labels only. */
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

/** Pack every remaining item (capped) plus a `#p0` page marker for the Lock Screen pager. */
export function shoppingBannerPackedSubtitle(
  head: string,
  remaining: string[] | ShoppingBannerItem[],
  page = 0
): string {
  const items: ShoppingBannerItem[] = remaining.map((entry) =>
    typeof entry === 'string'
      ? { id: '', label: entry.trim() }
      : { id: entry.id.trim(), label: entry.label.trim() }
  ).filter((item) => item.label);

  const clean = items.slice(0, BANNER_PACK_MAX);
  const overflow = Math.max(0, items.length - clean.length);
  const lines = [head, ...clean.map(packBannerItem)];
  if (overflow > 0) lines.push(`+${overflow} more`);
  lines.push(`#p${Math.max(0, page)}`);
  return lines.join('\n');
}

export function shoppingBannerState(run: ShoppingRunState): ShoppingBannerState {
  const left = Math.max(0, run.total - run.done);
  const progress = run.total > 0 ? Math.min(1, run.done / run.total) : 0;
  const items = normalizeItems(run);

  if (run.total > 0 && left === 0) {
    return {
      title: run.runLabel?.trim() || 'Shopping run',
      subtitle: 'All picked up — nice one',
      progressBar: { progress },
    };
  }

  const head = `${run.done} of ${run.total} · ${run.nextAisle ?? 'Keep going'}`;
  return {
    title: run.runLabel?.trim() || 'Shopping run',
    subtitle: items.length ? shoppingBannerPackedSubtitle(head, items, 0) : head,
    progressBar: { progress },
  };
}

/** The last line, shown as the banner ends. */
export function shoppingBannerFinalSubtitle(run: ShoppingRunState): string {
  return run.total > 0 && run.done >= run.total
    ? 'All picked up'
    : `${run.done} of ${run.total} picked up`;
}
