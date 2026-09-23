/**
 * Settle / result mark — one deliberate arrival; tappable undo while the window is live.
 * Mount animation is allowed here: settle is after WebRTC uplink is quiet.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
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
  /** When set, one tap reverses the last commit — no dialog. */
  undoable?: boolean;
  /** WO11 — e.g. "Undo 3 things". */
  undoLabel?: string;
  onUndo?: () => void;
};

const LABEL: Record<NonNullable<Props['kind']>, string> = {
  added: 'Added',
  done: 'Done',
  assigned: 'Assigned',
};

/** Green check after Poppins writes — one deliberate arrival, no toast/sound. */
export function IuiResultMark({ kind = 'added', title, undoable, undoLabel, onUndo }: Props) {
  const { c } = useOrbitColors();
  const scale = useSharedValue(0.82);
  const markGreen = c.success;

  useEffect(() => {
    scale.value = withSpring(1, motion.settle);
  }, [scale]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const body = (
    <>
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
        {undoable ? (
          <Text style={[styles.hint, { color: c.textMuted }]}>
            {undoLabel ?? 'Tap to undo'}
          </Text>
        ) : null}
      </Animated.View>
    </>
  );

  return (
    <Animated.View entering={FadeIn.duration(motionDuration.smooth)} style={styles.wrap}>
      {undoable && onUndo ? (
        <Pressable
          onPress={onUndo}
          accessibilityRole="button"
          accessibilityLabel={undoLabel ?? 'Undo'}
          style={styles.press}>
          {body}
        </Pressable>
      ) : (
        body
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: space.sm + 2,
    paddingVertical: space.sm,
  },
  press: {
    alignItems: 'center',
    gap: space.sm + 2,
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
  hint: {
    ...typography.caption1,
    marginTop: space.xs,
    textAlign: 'center',
  },
});
