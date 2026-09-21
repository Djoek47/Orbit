import { useEffect, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

import { useTourRegistry } from '@/components/orbit/tour/tour-provider';

/**
 * Registers a screen ScrollView so the tour can ensureVisible before measuring.
 */
export function useTourScroll(scrollRef: RefObject<ScrollView | null>) {
  const registry = useTourRegistry();

  useEffect(() => {
    if (!registry) return;
    registry.registerScroll((y: number) => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
    });
    return () => {
      registry.registerScroll(null);
    };
  }, [registry, scrollRef]);
}
