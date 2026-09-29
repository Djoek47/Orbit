/**
 * What the Lock Screen banner says during a shopping run. Pure, so it can be tested
 * without React Native (the Live Activity module itself needs the native side).
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
};

export type ShoppingBannerState = {
  title: string;
  subtitle: string;
  progressBar: { progress: number };
};

export function shoppingBannerState(run: ShoppingRunState): ShoppingBannerState {
  const left = Math.max(0, run.total - run.done);
  return {
    title: run.runLabel?.trim() || 'Shopping run',
    subtitle:
      run.total > 0 && left === 0
        ? 'All picked up — nice one'
        : `${run.done} of ${run.total} · ${run.nextAisle ?? 'Keep going'}`,
    progressBar: { progress: run.total > 0 ? Math.min(1, run.done / run.total) : 0 },
  };
}

/** The last line, shown as the banner ends. */
export function shoppingBannerFinalSubtitle(run: ShoppingRunState): string {
  return run.total > 0 && run.done >= run.total
    ? 'All picked up'
    : `${run.done} of ${run.total} picked up`;
}
