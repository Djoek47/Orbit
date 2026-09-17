/**
 * Settle / result mark — one deliberate arrival.
 * Mount animation is allowed here: settle is after WebRTC uplink is quiet.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { motion, motionDuration } from '@/constants/motion-tokens';
import { space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  kind?: 'added' | 'done' | 'assigned';
  title?: string;
};

const LABEL: Record<NonNullable<Props['kind']>, string> = {
  added: 'Added',
  done: 'Done',
  assigned: 'Assigned',
};

/** Green check after Poppins writes — one deliberate arrival, no toast/sound. */
export function IuiResultMark({ kind = 'added', title }: Props) {
  const { c } = useOrbitColors();
  const scale = useSharedValue(0.82);
  const markGreen = c.success;

  useEffect(() => {
    scale.value = withSpring(1, motion.settle);
  }, [scale]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(motionDuration.smooth)} style={styles.wrap}>
      <Animated.View style={[styles.badge, { backgroundColor: markGreen }, badgeStyle]}>
        <MaterialIcons name="check" size={36} color="#ECFDF5" />
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(80).duration(motionDuration.smooth + 60)}>
        <Text style={[styles.label, { color: markGreen }]}>{LABEL[kind]}</Text>
        {title ? (
          <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: space.sm + 2,
    paddingVertical: space.sm,
  },
  badge: {
    alignItems: 'center',
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  label: {
    ...typography.title2,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  title: {
    ...typography.subheadline,
    marginTop: space.xxs,
    textAlign: 'center',
  },
});
