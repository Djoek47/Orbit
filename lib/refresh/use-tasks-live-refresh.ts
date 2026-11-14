import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

import { useOrbit } from '@/store/orbit-store';

/** Opening a screen twice within this window doesn't fetch again. */
const MIN_GAP_MS = 15_000;

/**
 * Fetch fresh tasks when the Tasks tab (or Home) gains focus — for everyone, not only
 * Sidekicks. Live updates cover changes while the screen is open; this covers what happened
 * while the app was elsewhere. Goes through the store's single reload queue, so it never
 * races a live update.
 */
export function useTasksLiveRefresh(enabled = true) {
  const { refreshHousehold } = useOrbit();
  const lastRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      if (Date.now() - lastRef.current < MIN_GAP_MS) return;
      lastRef.current = Date.now();
      void refreshHousehold().catch((error) => {
        console.warn('useTasksLiveRefresh', error);
      });
    }, [enabled, refreshHousehold])
  );
}
