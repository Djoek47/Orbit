import { useEffect } from 'react';
import { AppState } from 'react-native';

import { isSidekickRole } from '@/lib/sidekick/permissions';
import { useOrbit } from '@/store/orbit-store';

const LIVE_SYNC_MS = 3_000;

/**
 * Poll household data for Sidekick devices without JWT realtime.
 * Admins / co-admins use realtime + pull-to-refresh instead.
 */
export function useSidekickLiveSync() {
  const { refreshHousehold, currentMember, household } = useOrbit();

  useEffect(() => {
    if (!household.id || !isSidekickRole(currentMember?.role)) {
      return;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let subscription: { remove: () => void } | undefined;

    const refresh = () => {
      if (cancelled) return;
      void refreshHousehold().catch((error) => {
        console.warn('useSidekickLiveSync', error);
      });
    };

    refresh();
    interval = setInterval(refresh, LIVE_SYNC_MS);
    subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      subscription?.remove();
    };
  }, [currentMember?.role, household.id, refreshHousehold]);
}
