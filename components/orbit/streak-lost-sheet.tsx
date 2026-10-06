/**
 * Cliff “streak lost” — short, visual, House Rules hero energy.
 * Shown once per cliff until Got it (acked); cleared on full sign-out.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { Moji } from '@/components/orbit/moji/moji';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const TONE = '#FB923C';

type Props = {
  visible: boolean;
  streakDays: number;
  reason?: string | null;
  onDismiss: () => void;
};

export function StreakLostSheet({ visible, streakDays, reason, onDismiss }: Props) {
  const { c } = useOrbitColors();
  const bob = useSharedValue(0);
  const days = Math.max(1, streakDays);

  useEffect(() => {
    if (!visible) return;
    bob.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    );
  }, [bob, visible]);

  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 * bob.value }, { scale: 1 + 0.04 * bob.value }],
  }));

  const blurb =
    reason === 'rolling' ? 'Too many quiet days.' : 'Rescue wasn’t open this time.';

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} heightRatio={0.38}>
      <Animated.View entering={FadeIn.duration(220)} style={styles.body}>
        <Animated.View entering={FadeInDown.springify().damping(16)}>
          <LinearGradient
            colors={[`${TONE}55`, `${TONE}14`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { borderColor: `${TONE}66` }]}>
            <View style={styles.copy}>
              <Text style={[styles.eyebrow, { color: TONE }]}>Streak</Text>
              <Text style={[styles.days, { color: c.text }]}>{days}</Text>
              <Text style={[styles.caption, { color: TONE }]}>
                {days === 1 ? 'day · ended' : 'days · ended'}
              </Text>
            </View>
            <Animated.View style={[styles.mojiWrap, { backgroundColor: `${TONE}2E` }, bobStyle]}>
              <Moji name="fire" size={48} />
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        <Text style={[typography.body, { color: c.textSoft, textAlign: 'center' }]}>{blurb}</Text>
        <Text style={[typography.footnote, { color: c.textMuted, textAlign: 'center' }]}>
          Fresh start on your next finish.
        </Text>

        <OrbitButton onPress={onDismiss}>Got it</OrbitButton>
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button">
          <Text style={[typography.footnote, { color: c.accent, textAlign: 'center' }]}>Close</Text>
        </Pressable>
      </Animated.View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.md },
  hero: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  days: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 52,
    fontVariant: ['tabular-nums'],
  },
  caption: { fontSize: 15, fontWeight: '800' },
  mojiWrap: {
    alignItems: 'center',
    borderRadius: 28,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
});
