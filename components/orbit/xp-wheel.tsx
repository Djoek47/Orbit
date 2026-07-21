import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { orbitColors } from '@/constants/orbit-theme';

const ITEM_H = 44;
const VISIBLE = 3;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

/** Common XP steps for the sliding wheel. */
export const XP_WHEEL_VALUES = [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 75, 100] as const;

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

/**
 * Vertical snap wheel for picking task XP — scroll to settle on a value.
 */
export function XpWheel({
  value,
  onChange,
  accent = orbitColors.primary,
  values = XP_WHEEL_VALUES,
}: XpWheelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const index = nearestIndex(value, values);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: index * ITEM_H, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [index]);

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const next = Math.max(0, Math.min(values.length - 1, Math.round(y / ITEM_H)));
    scrollRef.current?.scrollTo({ y: next * ITEM_H, animated: true });
    if (values[next] !== value) {
      onChange(values[next]);
      if (Platform.OS !== 'web') {
        void Haptics.selectionAsync().catch(() => undefined);
      }
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.selection, { borderColor: `${accent}66` }]} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        onScrollEndDrag={onMomentumEnd}
        contentContainerStyle={{ paddingVertical: PAD }}
        style={styles.scroll}>
        {values.map((item, i) => {
          const active = i === index;
          return (
            <View key={item} style={styles.item}>
              <Text style={[styles.itemText, active && { color: accent, fontSize: 22, fontWeight: '800' }]}>
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <Text style={[styles.unit, { color: accent }]}>XP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    color: orbitColors.textSubtle,
    fontSize: 16,
    fontWeight: '600',
  },
  unit: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
