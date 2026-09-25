import { useEffect, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

import { useTourRegistry } from '@/components/orbit/tour/tour-provider';

/** Room for Exit pill + coach card above the spotlight while ensuring visible. */
const COACH_TOP_PAD = 280;

/**
 * Registers a screen ScrollView so the tour can ensureVisible before measuring,
 * and so the user can pan the screen under info-step coach cards.
 */
export function useTourScroll(scrollRef: RefObject<ScrollView | null>) {
  const registry = useTourRegistry();

  useEffect(() => {
    if (!registry) return;
    registry.registerScroll((windowY: number) => {
      // windowY comes from measureInWindow; at scroll 0 it approximates content Y.
      // Pull the target down enough that the coach card can sit above it.
      scrollRef.current?.scrollTo({
        y: Math.max(0, windowY - COACH_TOP_PAD),
        animated: true,
      });
    });
    return () => {
      registry.registerScroll(null);
    };
  }, [registry, scrollRef]);
}
