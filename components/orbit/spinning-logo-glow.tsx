import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useOrbitOptional } from '@/store/orbit-store';

type SpinningLogoGlowProps = {
  size?: number;
  style?: ViewStyle;
};

/**
 * Soft gradient disk that slowly spins behind the Choremaxx mark (splash + tab chrome).
 */
export function SpinningLogoGlow({ size = 120, style }: SpinningLogoGlowProps) {
  const orbit = useOrbitOptional();
  const primary = orbit?.accentTheme.primary ?? '#59B2E1';
  const secondary = orbit?.accentTheme.secondary ?? '#A78BFA';
  const gold = orbit?.orbitPalette.rewardsGold ?? '#E8B84A';
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 14000, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
        <LinearGradient
          colors={[`${primary}55`, `${secondary}33`, `${gold}40`, `${primary}22`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.disk, { borderRadius: size / 2 }]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  disk: {
    ...StyleSheet.absoluteFillObject,
  },
});
