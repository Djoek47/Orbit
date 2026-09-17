import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useOrbit } from '@/store/orbit-store';

const MEMBERS_POLL_MS = 12_000;

/** Reload roster while Members UI is visible so connection badges flip green after joins. */
export function useMembersLiveRefresh(enabled = true) {
  const { refreshHousehold, permissions } = useOrbit();

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      const refresh = () => {
        void refreshHousehold().catch((error) => {
          console.warn('useMembersLiveRefresh', error);
        });
      };

      refresh();

      if (!permissions.canManageHousehold) {
        return;
      }

      const interval = setInterval(refresh, MEMBERS_POLL_MS);
      return () => clearInterval(interval);
    }, [enabled, permissions.canManageHousehold, refreshHousehold])
  );
}
