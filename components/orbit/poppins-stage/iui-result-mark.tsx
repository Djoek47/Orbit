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
import { motion } from '@/constants/motion-tokens';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const MARK_GREEN = '#34D399';

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

  useEffect(() => {
    scale.value = withSpring(1, motion.settle);
  }, [scale]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(280)} style={styles.wrap}>
      <Animated.View style={[styles.badge, badgeStyle]}>
        <MaterialIcons name="check" size={36} color="#ECFDF5" />
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(80).duration(360)}>
        <Text style={[styles.label, { color: MARK_GREEN }]}>{LABEL[kind]}</Text>
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
  wrap: { alignItems: 'center', gap: 14, paddingVertical: 12 },
  badge: {
    alignItems: 'center',
    backgroundColor: MARK_GREEN,
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  label: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  title: { fontSize: 15, marginTop: 4, textAlign: 'center' },
});
