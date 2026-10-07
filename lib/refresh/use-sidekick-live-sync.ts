import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { isSidekickRole } from '@/lib/sidekick/permissions';
import { useOrbit } from '@/store/orbit-store';

const LIVE_SYNC_MS = 3_000;

/**
 * Poll household data for Sidekick devices without JWT realtime.
 * Admins / co-admins use realtime + pull-to-refresh instead.
 * Rebinds when the shared-tablet face changes (Emma → Jack).
 */
export function useSidekickLiveSync() {
  const { refreshHousehold, currentMember, household } = useOrbit();
  const generationRef = useRef(0);

  useEffect(() => {
    if (!household.id || !isSidekickRole(currentMember?.role)) {
      return;
    }

    const generation = ++generationRef.current;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let subscription: { remove: () => void } | undefined;
    let inFlight: Promise<unknown> | null = null;

    const refresh = () => {
      if (cancelled || generation !== generationRef.current) return;
      // Drop stale in-flight work when the face changes mid-poll.
      inFlight = refreshHousehold()
        .catch((error) => {
          if (!cancelled && generation === generationRef.current) {
            console.warn('useSidekickLiveSync', error);
          }
        })
        .finally(() => {
          if (generation === generationRef.current) inFlight = null;
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
      void inFlight;
    };
    // Rebind when the shared-tablet face changes (Emma → Jack), not only on role.
  }, [currentMember?.id, currentMember?.role, household.id, refreshHousehold]);
}
