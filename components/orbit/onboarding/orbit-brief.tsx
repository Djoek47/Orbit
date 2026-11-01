/**
 * First screen after Get Started — visual brief, then Continue.
 * Merges the v32 Moji pillar cards with the earlier explained steps:
 * colored Moji rows, each with a short title and one plain line.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { BrandLegalFooter } from '@/components/orbit/brand-legal-footer';
import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { space } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const PILLARS: ReadonlyArray<{
  moji: MojiName;
  color: string;
  label: string;
  body: string;
}> = [
  {
    moji: 'home',
    color: '#7FC24A',
    label: 'One Home. One App.',
    body: 'From tasks to rewards, with Choremaxx, every household aspect is covered.',
  },
  {
    moji: 'poppins',
    color: '#4FA3FF',
    label: 'Poppins',
    body: 'Speak your wishes into existence with Poppins AI.',
  },
  {
    moji: 'star',
    color: '#FF9F1C',
    label: 'Household Management.',
    body: 'Turn chores into XP. And XP into rewards.',
  },
];

export function OrbitBrief({
  accent,
  onContinue,
  onBack,
}: {
  accent: string;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { c } = useOrbitColors();

  return (
    <View style={styles.root}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={10}
        style={styles.backRow}>
        <MaterialIcons name="chevron-left" size={22} color={accent} />
        <Text style={[styles.back, { color: accent }]}>Back</Text>
      </Pressable>

      <Animated.View entering={FadeIn.duration(280)} style={styles.heroBlock}>
        <ChoremaxxLogo size="md" />
        <Text style={[styles.title, { color: c.text }]}>Turn chores into XP</Text>
        <Text style={[styles.lede, { color: c.textMuted }]}>
          Run your household like never before.
        </Text>
      </Animated.View>

      <View style={styles.pillars}>
        {PILLARS.map((pillar, index) => (
          <PillarRow key={pillar.label} pillar={pillar} index={index} />
        ))}
      </View>

      <Animated.View entering={FadeInDown.delay(420).duration(320)} style={styles.cta}>
        <OrbitButton onPress={onContinue}>Continue</OrbitButton>
        <BrandLegalFooter showLogo={false} compact />
      </Animated.View>
    </View>
  );
}

function PillarRow({
  pillar,
  index,
}: {
  pillar: (typeof PILLARS)[number];
  index: number;
}) {
  const { c } = useOrbitColors();
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.set(
      withDelay(
        index * 120,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })
          ),
          -1
        )
      )
    );
  }, [bob, index]);

  const bobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -3 * bob.value },
      { rotate: `${(bob.value - 0.5) * 4}deg` },
    ],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(120 + index * 90)
        .springify()
        .damping(16)}>
      <LinearGradient
        colors={[`${pillar.color}3D`, `${pillar.color}0F`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.pillar, { borderColor: `${pillar.color}5C` }]}
        accessible
        accessibilityLabel={`${index + 1}. ${pillar.label} ${pillar.body}`}>
        <Animated.View
          style={[styles.mojiWrap, { backgroundColor: `${pillar.color}2E` }, bobStyle]}>
          <Moji name={pillar.moji} size={32} />
        </Animated.View>
        <View style={styles.pillarText}>
          <Text style={[styles.pillarLabel, { color: c.text }]}>{pillar.label}</Text>
          <Text style={[styles.pillarBody, { color: c.textMuted }]}>{pillar.body}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    gap: space.lg,
    justifyContent: 'center',
    paddingBottom: space.xl,
  },
  backRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
    marginLeft: -6,
  },
  back: {
    fontSize: 17,
    fontWeight: '600',
  },
  heroBlock: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 40,
    textAlign: 'center',
  },
  lede: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  pillars: {
    gap: 12,
    marginTop: 4,
  },
  pillar: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  mojiWrap: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  pillarText: {
    flex: 1,
    gap: 4,
  },
  pillarLabel: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  pillarBody: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
  },
  cta: {
    gap: 10,
    marginTop: 8,
  },
});
