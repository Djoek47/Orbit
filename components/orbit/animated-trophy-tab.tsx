import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { FontFamily } from '@/constants/typography';
import { motion } from '@/constants/motion-tokens';

type AnimatedTrophyTabProps = {
  color: string;
  focused: boolean;
  /** Bumps when the Rewards tab label morphs. */
  morphKey: string | number;
  /** Member can afford at least one reward. */
  canRedeem: boolean;
  /** Current cycling label (Ranks / Rewards / Redeem). */
  label: string;
};

/**
 * Trophy icon that dances in sync with Rewards-tab label morphs.
 * Stronger bounce + gold shimmer when redeem XP is available / on “Redeem”.
 */
export function AnimatedTrophyTab({
  color,
  focused,
  morphKey,
  canRedeem,
  label,
}: AnimatedTrophyTabProps) {
  const bounce = useSharedValue(0);
  const spin = useSharedValue(0);
  const glow = useSharedValue(canRedeem ? 0.45 : 0);
  const isRedeemWord = label === 'Redeem';

  // Idle shimmer when redeem is available
  useEffect(() => {
    if (canRedeem) {
      glow.value = withRepeat(
        withSequence(
          withTiming(isRedeemWord ? 1 : 0.7, {
            duration: 900,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0.35, { duration: 1100, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      glow.value = withTiming(0, { duration: 280 });
    }
  }, [canRedeem, glow, isRedeemWord]);

  // Morph pulse — sync with letter transform
  useEffect(() => {
    const intensity = isRedeemWord ? 1 : canRedeem ? 0.75 : 0.55;
    bounce.value = 0;
    spin.value = 0;
    bounce.value = withSequence(
      withSpring(intensity, motion.snappy),
      withDelay(80, withSpring(0, motion.smooth))
    );
    spin.value = withSequence(
      withTiming(-10 * intensity, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withTiming(12 * intensity, { duration: 180, easing: Easing.inOut(Easing.ease) }),
      withTiming(-6 * intensity, { duration: 140 }),
      withSpring(0, motion.smooth)
    );
  }, [bounce, canRedeem, isRedeemWord, morphKey, spin]);

  const iconStyle = useAnimatedStyle(() => {
    const scale = 1 + bounce.value * 0.22;
    return {
      transform: [{ scale }, { rotateZ: `${spin.value}deg` }],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.85, 1.35]) }],
  }));

  const sparkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bounce.value, [0, 1], [0, isRedeemWord ? 1 : 0.7]),
    transform: [
      { translateY: interpolate(bounce.value, [0, 1], [4, -6]) },
      { scale: interpolate(bounce.value, [0, 1], [0.4, 1]) },
    ],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          { backgroundColor: canRedeem || isRedeemWord ? '#FBBF24' : color },
          glowStyle,
        ]}
      />
      <Animated.View style={iconStyle}>
        <IconSymbol name="trophy.fill" size={20} color={focused || canRedeem ? color : color} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.spark, sparkStyle]}>
        <Animated.Text style={[styles.sparkText, { color: isRedeemWord ? '#FBBF24' : color }]}>
          ✦
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  glow: {
    borderRadius: 16,
    height: 28,
    opacity: 0,
    position: 'absolute',
    width: 28,
  },
  spark: {
    position: 'absolute',
    right: -2,
    top: -2,
  },
  sparkText: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
  },
});
