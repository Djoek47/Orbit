import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { isSidekickRole } from '@/lib/sidekick/permissions';
import { useOrbit } from '@/store/orbit-store';

const SIDEKICK_TASKS_POLL_MS = 5_000;

/** Faster sidekick poll while Tasks tab is focused so new assignments appear quickly. */
export function useTasksLiveRefresh(enabled = true) {
  const { refreshHousehold, currentMember } = useOrbit();
  const sidekick = isSidekickRole(currentMember?.role);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !sidekick) return;

      const refresh = () => {
        void refreshHousehold().catch((error) => {
          console.warn('useTasksLiveRefresh', error);
        });
      };

      refresh();
      const interval = setInterval(refresh, SIDEKICK_TASKS_POLL_MS);
      return () => clearInterval(interval);
    }, [enabled, refreshHousehold, sidekick])
  );
}
