import { useCallback, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { useOrbit } from '@/store/orbit-store';

/** Pull-to-refresh: reload household, then expire / spawn occurrences. */
export function useHouseholdRefresh() {
  const { refreshHousehold, runOccurrenceCatchUp } = useOrbit();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const hydrated = await refreshHousehold();
      await runOccurrenceCatchUp(hydrated);
    } finally {
      setRefreshing(false);
    }
  }, [refreshHousehold, runOccurrenceCatchUp]);

  return { refreshing, onRefresh };
}
