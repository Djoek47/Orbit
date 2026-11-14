import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/constants/motion-tokens';
import { radius, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

type SegmentedControlProps<T extends string> = {
  label?: string;
  subtitle?: string;
  /** `light`: a small pulsing dot after the label, in this color — something needs a look. */
  options: { value: T; label: string; light?: string | null; lightLabel?: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Override store accent — e.g. Tasks Who's on uses the viewed person's color. */
  accentColor?: string;
};

/**
 * Shared 2-4 option picker — replaces hand-rolled segmented rows across
 * app/settings.tsx. See docs/design-system/05-component-library.md.
 */
export function SegmentedControl<T extends string>({
  label,
  subtitle,
  options,
  value,
  onChange,
  disabled,
  accentColor,
}: SegmentedControlProps<T>) {
  const orbit = useOrbitOptional();
  const { c, glass } = useOrbitColors();
  const accent = accentColor ?? orbit?.accentTheme.primary ?? c.primary;
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
      {subtitle ? (
        <Text style={[typography.footnote, styles.subtitle, { color: c.textSubtle }]}>{subtitle}</Text>
      ) : null}
      <View
        style={[styles.track, { backgroundColor: glass(0.05) }, disabled ? { opacity: 0.5 } : null]}
        onLayout={onLayout}
        accessibilityRole="tablist"
        accessibilityState={{ disabled: Boolean(disabled) }}>
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
              onPress={() => {
                if (disabled) return;
                onChange(option.value);
              }}
              style={styles.segment}
              accessibilityRole="tab"
              accessibilityLabel={option.light && option.lightLabel ? `${option.label}, ${option.lightLabel}` : undefined}
              accessibilityState={{ selected: active }}>
              <View style={styles.segmentRow}>
                <Text
                  style={[
                    typography.footnote,
                    styles.segmentText,
                    { color: active ? accent : c.textMuted },
                    active && { fontWeight: '700' },
                  ]}>
                  {option.label}
                </Text>
                {option.light ? <SegmentLight color={option.light} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A 6pt dot that breathes slowly; still under Reduce Motion. */
function SegmentLight({ color }: { color: string }) {
  const reduce = useReducedMotion();
  const glow = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    glow.value = withRepeat(
      withSequence(withTiming(0.35, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1
    );
    return () => cancelAnimation(glow);
  }, [glow, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <Animated.View
      style={[styles.light, { backgroundColor: color, shadowColor: color }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

const styles = StyleSheet.create({
  segmentRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  light: {
    borderRadius: 3,
    height: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 3,
    width: 6,
  },
  label: {
    marginBottom: space.xs,
  },
  subtitle: {
    marginBottom: space.xs,
    marginTop: -2,
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
