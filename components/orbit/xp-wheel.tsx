import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Platform, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text } from '@/components/orbit/app-text';

const ITEM_H = 44;
const VISIBLE = 3;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

/** XP steps for the sliding wheel — 0 XP through 100 XP in 5s. */
export const XP_WHEEL_VALUES: readonly number[] = Array.from({ length: 21 }, (_, i) => i * 5);

type XpWheelProps = {
  value: number;
  onChange: (xp: number) => void;
  accent?: string;
  values?: readonly number[];
};

function nearestIndex(value: number, values: readonly number[]) {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  values.forEach((item, index) => {
    const dist = Math.abs(item - value);
    if (dist < bestDist) {
      best = index;
      bestDist = dist;
    }
  });
  return best;
}

function indexFromOffset(y: number, count: number) {
  return Math.max(0, Math.min(count - 1, Math.round(y / ITEM_H)));
}

/**
 * Vertical snap wheel for picking task XP (0–100).
 * Uses RNGH ScrollView so nested page ScrollViews do not steal the gesture.
 */
export function XpWheel({
  value,
  onChange,
  accent,
  values = XP_WHEEL_VALUES,
}: XpWheelProps) {
  const { c } = useOrbitColors();
  const accentColor = accent ?? c.primary;
  const scrollRef = useRef<ScrollView>(null);
  const draggingRef = useRef(false);
  const lastEmittedRef = useRef(value);
  const [displayIndex, setDisplayIndex] = useState(() => nearestIndex(value, values));

  const snapOffsets = useMemo(
    () => values.map((_, i) => i * ITEM_H),
    [values]
  );

  useEffect(() => {
    if (draggingRef.current) return;
    const idx = nearestIndex(value, values);
    setDisplayIndex(idx);
    lastEmittedRef.current = values[idx] ?? value;
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [value, values]);

  const commitIndex = (next: number) => {
    const xp = values[next] ?? 0;
    setDisplayIndex(next);
    if (xp !== lastEmittedRef.current) {
      lastEmittedRef.current = xp;
      onChange(xp);
      if (Platform.OS !== 'web') {
        void Haptics.selectionAsync().catch(() => undefined);
      }
    }
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!draggingRef.current) return;
    const next = indexFromOffset(event.nativeEvent.contentOffset.y, values.length);
    if (next !== displayIndex) {
      setDisplayIndex(next);
    }
  };

  const onScrollBeginDrag = () => {
    draggingRef.current = true;
  };

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = indexFromOffset(event.nativeEvent.contentOffset.y, values.length);
    scrollRef.current?.scrollTo({ y: next * ITEM_H, animated: true });
    commitIndex(next);
    draggingRef.current = false;
  };

  const onScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const velocity = event.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocity) > 0.05) return;
    const next = indexFromOffset(y, values.length);
    scrollRef.current?.scrollTo({ y: next * ITEM_H, animated: true });
    commitIndex(next);
    draggingRef.current = false;
  };

  const selectedXp = values[displayIndex] ?? 0;

  return (
    <View style={styles.root}>
      <Text style={[styles.readout, { color: accentColor }]}>{selectedXp} XP</Text>
      <View style={styles.wrap}>
        <View
          style={[
            styles.selection,
            { borderColor: `${accentColor}66`, backgroundColor: `${accentColor}14` },
          ]}
          pointerEvents="none"
        />
        <ScrollView
          ref={scrollRef}
          nestedScrollEnabled
          waitFor={undefined}
          simultaneousHandlers={undefined}
          showsVerticalScrollIndicator={false}
          snapToOffsets={[...snapOffsets]}
          decelerationRate="fast"
          disableIntervalMomentum
          scrollEventThrottle={16}
          onScroll={onScroll}
          onScrollBeginDrag={onScrollBeginDrag}
          onMomentumScrollEnd={onMomentumEnd}
          onScrollEndDrag={onScrollEndDrag}
          contentContainerStyle={{ paddingVertical: PAD }}
          style={styles.scroll}>
          {values.map((item, i) => {
            const active = i === displayIndex;
            return (
              <View key={item} style={styles.item}>
                <Text
                  style={[
                    styles.itemText,
                    { color: active ? accentColor : c.textSubtle },
                    active && styles.itemTextActive,
                  ]}>
                  {item}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        <Text style={[styles.unit, { color: accentColor }]}>XP</Text>
      </View>
      <Text style={[styles.hint, { color: c.textMuted }]}>Slide · 0 to 100</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  readout: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  wrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    height: ITEM_H * VISIBLE,
    justifyContent: 'center',
  },
  scroll: {
    height: ITEM_H * VISIBLE,
    width: 88,
  },
  selection: {
    borderRadius: 14,
    borderWidth: 1.5,
    height: ITEM_H,
    left: 0,
    position: 'absolute',
    right: 36,
    top: PAD,
  },
  item: {
    alignItems: 'center',
    height: ITEM_H,
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemTextActive: {
    fontSize: 22,
    fontWeight: '800',
  },
  unit: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
    width: 28,
  },
  hint: {
    fontSize: 11,
    fontWeight: '600',
  },
});
