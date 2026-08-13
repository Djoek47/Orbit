import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
} from 'react-native-reanimated';

import { motion } from '@/constants/motion-tokens';

type Props = {
  progress: number;
  accent: string;
  frozen?: boolean;
  holding?: boolean;
  children: ReactNode;
};

/** Silence completes. Speech cancels. Breath around the object. */
export function IuiHoldRing({ progress, accent, frozen, holding, children }: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (frozen) return;
    if (holding) {
      scale.value = withRepeat(withSpring(1.045, motion.snappy), -1, true);
    } else {
      scale.value = withSpring(1, motion.snappy);
    }
  }, [frozen, holding, scale]);

  const breath = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const p = Math.min(1, Math.max(0, progress));

  return (
    <Animated.View style={[styles.wrap, breath]}>
      <View
        style={[
          styles.ring,
          {
            borderColor: `${accent}${holding ? '99' : '33'}`,
            shadowColor: accent,
            shadowOpacity: holding ? 0.35 : 0,
          },
        ]}>
        {children}
        <View style={[styles.progressTrack, { backgroundColor: `${accent}22` }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${p * 100}%`, backgroundColor: accent },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    borderWidth: 2,
    borderRadius: 28,
    padding: 10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  progressTrack: {
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 10,
    alignSelf: 'stretch',
  },
  progressFill: {
    height: 3,
    borderRadius: 999,
  },
});
