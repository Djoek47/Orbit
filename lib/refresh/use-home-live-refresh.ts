import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { isSidekickRole } from '@/lib/sidekick/permissions';
import { useOrbit } from '@/store/orbit-store';

/**
 * Admin safety net while Home is focused. Live updates now reconnect on their own
 * (household-realtime.ts), so this only catches a change the socket somehow missed. It used
 * to be 5s — a full household reload every 5 seconds, which made Home lag.
 */
const ADMIN_HOME_POLL_MS = 60_000;

/**
 * Home focus refresh: Sidekick refreshes immediately on focus (interval is
 * useSidekickLiveSync). Admins get a 60s safety-net poll while Home is focused
 * in case realtime lags.
 */
export function useHomeLiveRefresh(enabled = true) {
  const { refreshHousehold, currentMember } = useOrbit();
  const sidekick = isSidekickRole(currentMember?.role);
  const focusedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      focusedRef.current = true;
      void refreshHousehold().catch((error) => {
        console.warn('useHomeLiveRefresh.focus', error);
      });
      return () => {
        focusedRef.current = false;
      };
    }, [enabled, refreshHousehold])
  );

  useEffect(() => {
    if (!enabled || sidekick) return;

    let cancelled = false;
    const tick = () => {
      if (cancelled || !focusedRef.current) return;
      if (AppState.currentState !== 'active') return;
      void refreshHousehold().catch((error) => {
        console.warn('useHomeLiveRefresh.poll', error);
      });
    };

    const interval = setInterval(tick, ADMIN_HOME_POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && focusedRef.current) tick();
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [enabled, refreshHousehold, sidekick]);
}
