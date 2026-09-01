import { useEffect } from 'react';
import { AppState } from 'react-native';

import { isSidekickRole } from '@/lib/sidekick/permissions';
import { loadSidekickSession } from '@/lib/sidekick/session';
import { useOrbit } from '@/store/orbit-store';

const LIVE_SYNC_MS = 3_000;

/**
 * Poll household data for devices without reliable JWT realtime:
 * Sidekicks (profile code) and co-admins on a second phone.
 */
export function useSidekickLiveSync() {
  const { refreshHousehold, currentMember, household } = useOrbit();

  useEffect(() => {
    if (!household.id) {
      return;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let subscription: { remove: () => void } | undefined;

    const startPolling = () => {
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
    };

    void (async () => {
      const session = await loadSidekickSession();
      const needsPoll =
        isSidekickRole(currentMember?.role) ||
        currentMember?.role === 'admin' ||
        Boolean(session?.profileInviteCode);

      if (!needsPoll || cancelled) {
        return;
      }
      startPolling();
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      subscription?.remove();
    };
  }, [currentMember?.role, household.id, refreshHousehold]);
}
