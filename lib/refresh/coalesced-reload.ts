/**
 * One reload at a time, and never a stale one.
 *
 * Live updates used to start a full household reload for every database change. A burst of
 * changes (catch-up creating a day's tasks, an admin assigning several at once) started many
 * reloads at the same moment; they raced, and whichever answered last won, sometimes an older
 * snapshot. Screens then showed missing or outdated tasks, and the phone lagged doing the same
 * work several times.
 *
 * Calls arriving within `debounceMs` are merged. While a reload runs, further calls don't start
 * another; they mark one more run to happen right after, so the last change is always picked up
 * and at most two reloads ever overlap in time (one running, one queued).
 */
export type CoalescedReload<T> = {
  /** Ask for a reload. Resolves with the result of the run that covers this request. */
  request: () => Promise<T>;
  /** Run now, skipping the debounce (pull to refresh, app coming back). */
  now: () => Promise<T>;
  cancel: () => void;
};

export function createCoalescedReload<T>(
  run: () => Promise<T>,
  { debounceMs = 250 }: { debounceMs?: number } = {}
): CoalescedReload<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<T> | null = null;
  let queued = false;
  let cancelled = false;
  let waiters: Array<{ resolve: (v: T) => void; reject: (e: unknown) => void }> = [];

  const settle = (fn: (w: (typeof waiters)[number]) => void) => {
    const current = waiters;
    waiters = [];
    current.forEach(fn);
  };

  const start = (): Promise<T> => {
    if (inFlight) {
      queued = true;
      return inFlight.then(
        () => next(),
        () => next()
      );
    }
    inFlight = run()
      .then(
        (value) => {
          inFlight = null;
          if (queued && !cancelled) {
            queued = false;
            return start();
          }
          settle((w) => w.resolve(value));
          return value;
        },
        (error) => {
          inFlight = null;
          if (queued && !cancelled) {
            queued = false;
            return start();
          }
          settle((w) => w.reject(error));
          throw error;
        }
      );
    return inFlight;
  };

  // A queued caller waits for the run that started after it asked.
  const next = (): Promise<T> => (inFlight ? inFlight : start());

  const request = () =>
    new Promise<T>((resolve, reject) => {
      if (cancelled) return;
      waiters.push({ resolve, reject });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        start().catch(() => undefined);
      }, debounceMs);
    });

  const now = () =>
    new Promise<T>((resolve, reject) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      waiters.push({ resolve, reject });
      start().catch(() => undefined);
    });

  const cancel = () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    timer = null;
    queued = false;
  };

  return { request, now, cancel };
}
