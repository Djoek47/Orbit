import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { motion } from '@/constants/motion-tokens';
import { radius, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

type SegmentedControlProps<T extends string> = {
  label?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Shared 2-4 option picker — replaces hand-rolled segmented rows across
 * app/settings.tsx. See docs/design-system/05-component-library.md.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const orbit = useOrbitOptional();
  const { c, glass } = useOrbitColors();
  const accent = orbit?.accentTheme.primary ?? c.primary;
  const [containerWidth, setContainerWidth] = useState(0);
  const segmentWidth = options.length > 0 ? containerWidth / options.length : 0;
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(activeIndex * segmentWidth, motion.snappy) }],
    width: segmentWidth,
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  return (
    <View>
      {label ? (
        <Text style={[typography.footnote, styles.label, { color: c.textMuted }]}>{label}</Text>
      ) : null}
      <View
        style={[styles.track, { backgroundColor: glass(0.05) }]}
        onLayout={onLayout}
        accessibilityRole="tablist">
        {segmentWidth > 0 ? (
          <Animated.View
            style={[
              styles.indicator,
              { backgroundColor: `${accent}28`, borderColor: accent },
              indicatorStyle,
            ]}
          />
        ) : null}
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={styles.segment}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}>
              <Text
                style={[
                  typography.footnote,
                  styles.segmentText,
                  { color: active ? accent : c.textMuted },
                  active && { fontWeight: '700' },
                ]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: space.xs,
  },
  track: {
    borderRadius: radius.control,
    borderCurve: 'continuous',
    flexDirection: 'row',
    padding: 3,
    position: 'relative',
  },
  indicator: {
    borderRadius: radius.control - 2,
    borderCurve: 'continuous',
    borderWidth: 1,
    bottom: 3,
    position: 'absolute',
    top: 3,
  },
  segment: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  segmentText: {
    fontWeight: '600',
  },
});
