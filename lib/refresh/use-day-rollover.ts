/**
 * Runs the occurrence catch-up when the day actually turns over.
 *
 * `useHomeLiveRefresh` keeps the household data fresh, but refreshing and rolling the day are
 * different jobs: the catch-up expires yesterday's open tasks, spawns today's and settles the
 * streak, and it was only ever wired to pull-to-refresh. A phone left on Home overnight showed
 * yesterday until someone dragged the screen down.
 *
 * Three things wake it: opening the app, coming back to it, and midnight passing while it is
 * open. Each is debounced against the last run, so a notification tap that fires several
 * foreground events does not kick off several catch-ups.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  dayHasRolled,
  dayKey,
  msUntilNextDay,
  shouldRefreshOnForeground,
} from '@/lib/refresh/day-rollover';
import { useOrbit } from '@/store/orbit-store';

export function useDayRollover(enabled = true) {
  const { refreshHousehold, runOccurrenceCatchUp } = useOrbit();
  const lastDayRef = useRef<string | null>(null);
  const lastRunRef = useRef<number | null>(null);
  const openedRef = useRef(false);
  // Store callbacks are recreated every render — hold them in refs so this hook's effects
  // do not tear down and re-fire `roll('open')` on every Home tick.
  const refreshRef = useRef(refreshHousehold);
  const catchUpRef = useRef(runOccurrenceCatchUp);
  refreshRef.current = refreshHousehold;
  catchUpRef.current = runOccurrenceCatchUp;
  /** Exposed so a card can say how fresh what you are looking at is. */
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);

  const roll = useCallback(async (reason: 'open' | 'foreground' | 'midnight') => {
    const now = new Date();
    // Midnight is the whole point, so it never debounces; the other two do.
    if (reason !== 'midnight' && !shouldRefreshOnForeground(lastRunRef.current, now.getTime())) {
      return;
    }
    // Nothing to settle if we already looked today — unless midnight just passed.
    if (reason === 'foreground' && !dayHasRolled(lastDayRef.current, now)) {
      return;
    }
    lastRunRef.current = now.getTime();
    try {
      const hydrated = await refreshRef.current();
      await catchUpRef.current(hydrated);
      lastDayRef.current = dayKey(now);
      setLastRefreshedAt(Date.now());
    } catch (error) {
      // Best effort: a failed catch-up leaves the data as it was, and the next wake retries.
      console.warn('useDayRollover', reason, error);
    }
  }, []);

  // Opening the app — once per mount, not on every store re-render.
  useEffect(() => {
    if (!enabled || openedRef.current) return;
    openedRef.current = true;
    void roll('open');
  }, [enabled, roll]);

  // Coming back to it.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void roll('foreground');
    });
    return () => sub.remove();
  }, [enabled, roll]);

  // Midnight passing while it is open. Re-armed after each turn rather than on an interval, so
  // it stays exact however long the app is left running.
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      timer = setTimeout(() => {
        void roll('midnight');
        arm();
      }, msUntilNextDay());
    };
    arm();
    return () => clearTimeout(timer);
  }, [enabled, roll]);

  return { lastRefreshedAt, refreshNow: () => roll('midnight') };
}
