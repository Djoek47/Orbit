import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { isSidekickRole } from '@/lib/sidekick/permissions';
import { useOrbit } from '@/store/orbit-store';

/** Immediate refresh when Tasks tab gains focus (interval handled by useSidekickLiveSync). */
export function useTasksLiveRefresh(enabled = true) {
  const { refreshHousehold, currentMember } = useOrbit();
  const sidekick = isSidekickRole(currentMember?.role);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !sidekick) return;

      void refreshHousehold().catch((error) => {
        console.warn('useTasksLiveRefresh', error);
      });
    }, [enabled, refreshHousehold, sidekick])
  );
}
