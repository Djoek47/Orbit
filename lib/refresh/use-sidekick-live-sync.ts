import { useEffect } from 'react';
import { AppState } from 'react-native';

import { isSidekickRole } from '@/lib/sidekick/permissions';
import { useOrbit } from '@/store/orbit-store';

const SIDEKICK_LIVE_SYNC_MS = 3_000;

/** App-wide Sidekick poll so tasks, events, and notifications stay current without JWT realtime. */
export function useSidekickLiveSync() {
  const { refreshHousehold, currentMember, household } = useOrbit();
  const sidekick = isSidekickRole(currentMember?.role);

  useEffect(() => {
    if (!sidekick || !household.id) {
      return;
    }

    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      void refreshHousehold().catch((error) => {
        console.warn('useSidekickLiveSync', error);
      });
    };

    refresh();
    const interval = setInterval(refresh, SIDEKICK_LIVE_SYNC_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      subscription.remove();
    };
  }, [currentMember?.role, household.id, refreshHousehold, sidekick]);
}
