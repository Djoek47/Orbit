import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';

import { useTourRegistry } from '@/components/orbit/tour/tour-provider';
import { tourScreenKey } from '@/lib/tour/tour-scroll';

export type TourScrollHandle = {
  /** Current content offset. */
  getOffset: () => number;
  scrollTo: (y: number) => void;
};

/**
 * Lets the tour scroll this screen so what it points at lands centred (lib/tour/tour-scroll).
 *
 * Every tab registers under its own key — the tabs stay mounted, and one shared slot meant the
 * last screen to mount won and the others never scrolled. Pass the returned `onScroll` to the
 * ScrollView (merged with any of your own), or `getOffset` when the screen already tracks it.
 */
export function useTourScroll(
  route: string,
  scrollRef: RefObject<ScrollView | { scrollTo: ScrollView['scrollTo'] } | null>,
  opts?: { getOffset?: () => number }
): { onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void } {
  const registry = useTourRegistry();
  const offsetRef = useRef(0);
  const getOffsetRef = useRef(opts?.getOffset);
  getOffsetRef.current = opts?.getOffset;
  const key = tourScreenKey(route);

  useEffect(() => {
    if (!registry) return;
    const handle: TourScrollHandle = {
      getOffset: () => getOffsetRef.current?.() ?? offsetRef.current,
      scrollTo: (y: number) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
      },
    };
    registry.registerScroll(key, handle);
    return () => registry.registerScroll(key, null);
  }, [key, registry, scrollRef]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  return { onScroll };
}
