import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { motionDuration } from '@/constants/motion-tokens';
import { radius } from '@/constants/orbit-theme';

type SkeletonBlockProps = {
  width?: number | `${number}%`;
  height?: number;
  style?: ViewStyle;
};

/** One shimmering placeholder block — compose into row/card shapes below. */
export function SkeletonBlock({ width = '100%', height = 14, style }: SkeletonBlockProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.85, { duration: motionDuration.smooth, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius: Math.min(radius.control, height / 2) },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Matches a Task/Notification row's shape — see design-system/05 "Loading States". */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <SkeletonBlock width={40} height={40} style={{ borderRadius: radius.full }} />
      <View style={styles.rowCopy}>
        <SkeletonBlock width="70%" height={15} />
        <SkeletonBlock width="45%" height={12} />
      </View>
    </View>
  );
}

/** Matches a summary card's shape. */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonBlock width="50%" height={13} />
      <SkeletonBlock width="80%" height={20} />
      <SkeletonBlock width="90%" height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  rowCopy: {
    flex: 1,
    gap: 6,
  },
  card: {
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 8,
    padding: 16,
  },
});
