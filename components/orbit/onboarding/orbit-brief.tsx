/**
 * First screen after Get Started — visual brief (House Rules energy), then Continue.
 * Short labels + Moji cards; long explanations live later in the flow.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
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
  hint: string;
}> = [
  { moji: 'home', color: '#7FC24A', label: 'One home', hint: 'Shared picture' },
  { moji: 'poppins', color: '#4FA3FF', label: 'Poppins', hint: 'Speak it in' },
  { moji: 'star', color: '#FF9F1C', label: 'Your XP', hint: 'You set the rules' },
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
        <Text style={[styles.title, { color: c.text }]}>Chores into XP</Text>
        <Text style={[styles.lede, { color: c.textMuted }]}>Three beats. Then you choose.</Text>
      </Animated.View>

      <View style={styles.pillars}>
        {PILLARS.map((pillar, index) => (
          <PillarCard key={pillar.label} pillar={pillar} index={index} />
        ))}
      </View>

      <Animated.View entering={FadeInDown.delay(360).duration(320)} style={styles.cta}>
        <OrbitButton onPress={onContinue}>Continue</OrbitButton>
      </Animated.View>
    </View>
  );
}

function PillarCard({
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
      { translateY: -3.5 * bob.value },
      { rotate: `${(bob.value - 0.5) * 4}deg` },
    ],
  }));

  return (
    <Animated.View
      entering={ZoomIn.delay(100 + index * 90)
        .springify()
        .damping(16)}
      style={styles.pillarWrap}>
      <LinearGradient
        colors={[`${pillar.color}44`, `${pillar.color}12`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.pillar, { borderColor: `${pillar.color}66` }]}>
        <Animated.View
          style={[styles.mojiWrap, { backgroundColor: `${pillar.color}2E` }, bobStyle]}>
          <Moji name={pillar.moji} size={36} />
        </Animated.View>
        <Text style={[styles.pillarLabel, { color: c.text }]}>{pillar.label}</Text>
        <Text style={[styles.pillarHint, { color: pillar.color }]}>{pillar.hint}</Text>
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
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  pillarWrap: {
    flex: 1,
  },
  pillar: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    minHeight: 148,
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  mojiWrap: {
    alignItems: 'center',
    borderRadius: 22,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  pillarLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  pillarHint: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  cta: {
    marginTop: 8,
  },
});
