/**
 * The Smart Trips page when there is nothing planned yet — what a trip is, in three steps,
 * and one obvious button to make the first one.
 *
 * Plan my day = Poppins (sky blue). From calendar / Build my own = other hues so people
 * know those are DIY, not the AI path.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';
import { PoppinsOrb } from '@/components/orbit/poppins-orb';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const POPPINS_BLUE = '#38BDF8';
const CALENDAR_AMBER = '#F59E0B';
const BUILD_TEAL = '#2DD4BF';

type Props = {
  majordomoName: string;
  busy?: boolean;
  onAsk: () => void;
  onCalendar: () => void;
  onNew: () => void;
};

function PulsePressable({
  color,
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  color: string;
  children: ReactNode;
  onPress: () => void;
  style?: object;
  accessibilityLabel: string;
}) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.035, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      false
    );
  }, [pulse]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return (
    <Animated.View style={anim}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [style, { opacity: pressed ? 0.88 : 1, borderColor: `${color}88` }]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function SmartTripsIntro({ majordomoName, busy, onAsk, onCalendar, onNew }: Props) {
  const { c, glass, glassBorder } = useOrbitColors();

  const steps: { moji: MojiName; title: string; body: string }[] = [
    { moji: 'calendar', title: 'Pick a day', body: 'Events and errands.' },
    { moji: 'map', title: `${majordomoName} orders`, body: 'Shortest drive.' },
    { moji: 'car', title: 'Tap Start', body: 'Maps, stop by stop.' },
  ];

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={{ gap: 12 }}>
      <LinearGradient
        colors={['rgba(56,189,248,0.22)', 'rgba(129,140,248,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { borderColor: `${POPPINS_BLUE}55` }]}>
        <View style={styles.heroTop}>
          <PoppinsOrb size={52} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.title, { color: c.text }]}>One drive, every errand</Text>
            <Text style={[styles.body, { color: c.textMuted }]}>
              {majordomoName} bundles the day&apos;s stops into one route.
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onAsk}
          disabled={busy}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: POPPINS_BLUE, opacity: pressed ? 0.88 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Ask ${majordomoName} to plan my day`}>
          {busy ? (
            <ActivityIndicator size="small" color="#041018" />
          ) : (
            <MaterialIcons name="auto-awesome" size={18} color="#041018" />
          )}
          <Text style={styles.ctaLabel}>Plan my day</Text>
        </Pressable>
        <Text style={[styles.poppinsHint, { color: POPPINS_BLUE }]}>
          With {majordomoName}
        </Text>
      </LinearGradient>

      <View style={styles.steps}>
        {steps.map((step, index) => (
          <Animated.View
            key={step.title}
            entering={FadeInDown.delay(120 + index * 80).springify().damping(18)}
            style={[styles.step, { backgroundColor: glass(0.04), borderColor: glassBorder(0.08) }]}>
            <View style={[styles.stepNum, { backgroundColor: glass(0.08) }]}>
              <Text style={[styles.stepNumText, { color: c.textMuted }]}>{index + 1}</Text>
            </View>
            <Moji name={step.moji} size={24} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepTitle, { color: c.text }]}>{step.title}</Text>
              <Text style={[styles.stepBody, { color: c.textSubtle }]}>{step.body}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      <Text style={[styles.diyLabel, { color: c.textSubtle }]}>Or build it yourself</Text>
      <View style={styles.alt}>
        <PulsePressable
          color={CALENDAR_AMBER}
          onPress={onCalendar}
          accessibilityLabel="Build a trip from the calendar"
          style={[styles.altBtn, { backgroundColor: `${CALENDAR_AMBER}22`, flex: 1 }]}>
          <MaterialIcons name="event" size={16} color={CALENDAR_AMBER} />
          <Text style={[styles.altLabel, { color: CALENDAR_AMBER }]}>From calendar</Text>
        </PulsePressable>
        <PulsePressable
          color={BUILD_TEAL}
          onPress={onNew}
          accessibilityLabel="Build my own trip"
          style={[styles.altBtn, { backgroundColor: `${BUILD_TEAL}22`, flex: 1 }]}>
          <MaterialIcons name="add" size={16} color={BUILD_TEAL} />
          <Text style={[styles.altLabel, { color: BUILD_TEAL }]}>Build my own</Text>
        </PulsePressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 22, borderWidth: 1, gap: 12, padding: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  body: { fontSize: 14, lineHeight: 19 },
  cta: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
  },
  ctaLabel: { color: '#041018', fontSize: 16, fontWeight: '800' },
  poppinsHint: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  steps: { gap: 8 },
  step: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 12, fontWeight: '800' },
  stepTitle: { fontSize: 15, fontWeight: '700' },
  stepBody: { fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  diyLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  alt: { flexDirection: 'row', gap: 8 },
  altBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 10,
  },
  altLabel: { fontSize: 14, fontWeight: '800' },
});
