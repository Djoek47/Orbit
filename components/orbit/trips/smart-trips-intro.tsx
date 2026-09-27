/**
 * The Smart Trips page when there is nothing planned yet — what a trip is, in three steps,
 * and one obvious button to make the first one.
 *
 *   ┌────────────────────────────────────┐
 *   │  (orb)  One drive, every errand    │
 *   │         Poppins puts the stops in  │
 *   │         the order that drives best │
 *   │  [ ✨ Plan my day ]                 │
 *   │  ① Pick a day  ② Poppins orders    │
 *   │  ③ Tap Start and it opens Maps     │
 *   │  [ From calendar ] [ Build my own ]│
 *   └────────────────────────────────────┘
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';
import { PoppinsOrb } from '@/components/orbit/poppins-orb';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  majordomoName: string;
  busy?: boolean;
  onAsk: () => void;
  onCalendar: () => void;
  onNew: () => void;
};

export function SmartTripsIntro({ majordomoName, busy, onAsk, onCalendar, onNew }: Props) {
  const { c, glass, glassBorder } = useOrbitColors();

  const steps: { moji: MojiName; title: string; body: string }[] = [
    { moji: 'calendar', title: 'Pick a day', body: 'Your events and errands for that day.' },
    { moji: 'map', title: `${majordomoName} orders the stops`, body: 'Shortest drive, in a sensible order.' },
    { moji: 'car', title: 'Tap Start', body: 'It opens in your maps app, stop by stop.' },
  ];

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={{ gap: 12 }}>
      <LinearGradient
        colors={['rgba(56,189,248,0.18)', 'rgba(129,140,248,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { borderColor: glassBorder(0.14) }]}>
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
          style={({ pressed }) => [styles.cta, { backgroundColor: '#38BDF8', opacity: pressed ? 0.88 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={`Ask ${majordomoName} to plan my day`}>
          {busy ? (
            <ActivityIndicator size="small" color="#041018" />
          ) : (
            <MaterialIcons name="auto-awesome" size={18} color="#041018" />
          )}
          <Text style={styles.ctaLabel}>Plan my day</Text>
        </Pressable>
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

      <View style={styles.alt}>
        <Pressable
          onPress={onCalendar}
          style={[styles.altBtn, { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) }]}
          accessibilityRole="button">
          <MaterialIcons name="event" size={16} color={c.textMuted} />
          <Text style={[styles.altLabel, { color: c.textMuted }]}>From calendar</Text>
        </Pressable>
        <Pressable
          onPress={onNew}
          style={[styles.altBtn, { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) }]}
          accessibilityRole="button">
          <MaterialIcons name="add" size={16} color={c.textMuted} />
          <Text style={[styles.altLabel, { color: c.textMuted }]}>Build my own</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 22, borderWidth: 1, gap: 14, padding: 16 },
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
  alt: { flexDirection: 'row', gap: 8 },
  altBtn: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
  },
  altLabel: { fontSize: 14, fontWeight: '700' },
});
