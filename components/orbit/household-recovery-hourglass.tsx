/**
 * Recovery hero — large Poppins hourglass with breathe + gradient sand aura
 * and a live countdown to permanent deletion.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { PoppinsHourglass } from '@/components/orbit/poppins-hourglass';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  deletionCountdownParts,
  type RecoveryCountdownParts,
} from '@/lib/household/household-recovery';
import { formatHouseholdDeletionDate } from '@/lib/household/household-deletion';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const TONE = '#FBBF24';

type Props = {
  householdName: string;
  scheduledFor: string;
  /** Accent for sand / aura — defaults to amber deletion tone. */
  tone?: string;
};

export function HouseholdRecoveryHourglass({
  householdName,
  scheduledFor,
  tone = TONE,
}: Props) {
  const { c, glassBorder } = useOrbitColors();
  const breathe = useSharedValue(1);
  const [parts, setParts] = useState<RecoveryCountdownParts>(() =>
    deletionCountdownParts(scheduledFor)
  );

  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.045, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [breathe]);

  useEffect(() => {
    setParts(deletionCountdownParts(scheduledFor));
    const id = setInterval(() => {
      setParts(deletionCountdownParts(scheduledFor));
    }, 1000);
    return () => clearInterval(id);
  }, [scheduledFor]);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.root}>
      <LinearGradient
        colors={[`${tone}44`, `${tone}12`, 'transparent']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[styles.hero, { borderColor: `${tone}55` }]}>
        <Animated.View style={[styles.glassWrap, breatheStyle]}>
          <LinearGradient
            colors={[`${tone}33`, `${tone}08`]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.sandPlate, { borderColor: glassBorder(0.12) }]}>
            <PoppinsHourglass size={72} color={tone} active />
          </LinearGradient>
        </Animated.View>

        <Text style={[styles.countdown, { color: c.text }]} accessibilityRole="timer">
          {parts.label}
        </Text>
        <Text style={[styles.caption, { color: tone }]}>until permanent deletion</Text>
        <Text style={[typography.footnote, { color: c.textMuted, textAlign: 'center', marginTop: 6 }]}>
          {householdName} · {formatHouseholdDeletionDate(scheduledFor)}
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  hero: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.xs,
    overflow: 'hidden',
    paddingBottom: space.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
  },
  glassWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  sandPlate: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 132,
    justifyContent: 'center',
    width: 132,
  },
  countdown: {
    fontSize: 34,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  caption: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
