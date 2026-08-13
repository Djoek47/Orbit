import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { motion, motionDuration } from '@/constants/motion-tokens';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Stop = { id: string; label: string; emoji?: string };

type Props = {
  stop: Stop;
  accent: string;
  drawRoad?: boolean;
};

/** One stop, then the road draws to it. */
export function IuiRoad({ stop, accent, drawRoad = true }: Props) {
  const { c } = useOrbitColors();
  const height = useSharedValue(0);

  useEffect(() => {
    height.value = 0;
    if (!drawRoad) return;
    height.value = withDelay(
      80,
      withSpring(56, motion.smooth)
    );
  }, [drawRoad, height, stop.id]);

  const road = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <View style={styles.col}>
      {drawRoad ? (
        <Animated.View style={[styles.road, { backgroundColor: `${accent}88` }, road]} />
      ) : null}
      <Animated.View
        entering={FadeInDown.duration(motionDuration.smooth)}
        style={[styles.stop, { borderColor: `${accent}66`, backgroundColor: `${accent}18` }]}>
        <Text style={styles.emoji}>{stop.emoji ?? '📍'}</Text>
        <Text style={[styles.label, { color: c.text }]}>{stop.label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  col: { alignItems: 'center', minHeight: 80 },
  road: {
    width: 3,
    borderRadius: 999,
    marginBottom: 8,
  },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    minWidth: 200,
  },
  emoji: { fontSize: 22 },
  label: { fontSize: 18, fontWeight: '600' },
});
