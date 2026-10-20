import { useCallback, useEffect, useRef } from 'react';
import { View, type LayoutChangeEvent, type ViewProps } from 'react-native';

import type { TourTargetId } from '@/lib/tour/tour-types';
import { useTourRegistry } from '@/components/orbit/tour/tour-provider';

type Props = ViewProps & {
  id: TourTargetId;
  children: React.ReactNode;
};

/**
 * Registers a measurable window rect for the active tour step.
 * Zero visual effect when no tour is running — must not change layout.
 */
export function TourTarget({ id, children, style, onLayout, ...rest }: Props) {
  const registry = useTourRegistry();
  const ref = useRef<View>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const report = useCallback(() => {
    if (!registry) return;
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      registry.registerTarget(id, { x, y, width, height });
      lastRef.current = { x, y, w: width, h: height };
    });
  }, [id, registry]);

  const isActive = registry?.activeTargetId === id;

  useEffect(() => {
    if (!registry) return;
    report();
    return () => {
      registry.unregisterTarget(id);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [id, registry, report]);

  useEffect(() => {
    if (!isActive || !registry) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      ref.current?.measureInWindow((x, y, width, height) => {
        if (!alive) return;
        if (width > 0 && height > 0) {
          registry.registerTarget(id, { x, y, width, height });
        }
        rafRef.current = requestAnimationFrame(tick);
      });
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [id, isActive, registry]);

  const handleLayout = (e: LayoutChangeEvent) => {
    onLayout?.(e);
    report();
  };

  return (
    <View
      ref={ref}
      collapsable={false}
      style={style}
      onLayout={handleLayout}
      {...rest}>
      {children}
    </View>
  );
}
