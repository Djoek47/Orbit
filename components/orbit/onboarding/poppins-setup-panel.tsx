/**
 * Get Started → set up Poppins.
 *
 * There is one assistant and it is called Poppins, so this step is no longer a shelf of
 * characters to choose a personality from. Two decisions, the same two as Settings → Poppins:
 * whether it writes or talks, and what colour it sounds like.
 *
 * Advanced isn't offered during setup — the defaults are good and it is a screen in Settings.
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { PoppinsTierCards } from '@/components/orbit/poppins/tier-cards';
import { VoiceWheel } from '@/components/orbit/poppins/voice-wheel';
import { radius, space } from '@/constants/orbit-theme';
import {
  DEFAULT_MAJORDOMO_PROFILE_ID,
  type MajordomoProfileId,
} from '@/lib/ai/majordomo-profiles';
import { poppinsVoice, resolvePoppinsVoice } from '@/lib/ai/poppins-voices';
import { type PoppinsInteractionPrefs } from '@/lib/poppins/poppins-prefs';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export type PoppinsSetupValue = {
  prefs: PoppinsInteractionPrefs;
  /** Kept at Poppins. The field stays so the household record and the edge don't change shape. */
  majordomoProfileId: MajordomoProfileId;
};

type PoppinsSetupPanelProps = {
  value: PoppinsSetupValue;
  onChange: (next: PoppinsSetupValue) => void;
  accent?: string;
};

export function PoppinsSetupPanel({ value, onChange }: PoppinsSetupPanelProps) {
  const { c, glass, glassBorder } = useOrbitColors();
  const { prefs } = value;
  const voiceId = resolvePoppinsVoice({ voiceId: prefs.voiceId });
  const voice = poppinsVoice(voiceId);

  const patchPrefs = (patch: Partial<PoppinsInteractionPrefs>) => {
    onChange({
      ...value,
      majordomoProfileId: DEFAULT_MAJORDOMO_PROFILE_ID,
      prefs: { ...prefs, ...patch },
    });
  };

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeInDown.delay(20).springify()} style={styles.heroBlock}>
        <View style={[styles.heroBadge, { backgroundColor: `${voice.color}22` }]}>
          <View style={[styles.heroDot, { backgroundColor: voice.color }]} />
          <Text style={[styles.heroBadgeText, { color: voice.color }]}>Poppins · {voice.label}</Text>
        </View>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Two things to pick: whether Poppins writes or talks, and what it sounds like. Both can
          change any time in Settings.
        </Text>
      </Animated.View>

      <PoppinsTierCards prefs={prefs} onSelectTier={(tier) => patchPrefs({ speakBack: tier === 'max' })} />

      <Text style={[styles.sectionLabel, { color: c.textSubtle }]}>How it sounds</Text>
      <View style={[styles.wheelCard, { backgroundColor: glass(0.04), borderColor: `${voice.color}2E` }]}>
        <VoiceWheel voiceId={voiceId} onSelect={(next) => patchPrefs({ voiceId: next })} />
      </View>

      <Pressable
        onPress={() => router.push('/poppins-how-it-works' as never)}
        accessibilityRole="button"
        style={[styles.demoRow, { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) }]}>
        <Text style={[styles.demoLabel, { color: c.text }]}>See how it works</Text>
        <Text style={[styles.demoHint, { color: c.textMuted }]}>
          A short recording — a chore, a shop, a week, a trip
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: space.md,
    marginBottom: space.lg,
    width: '100%',
  },
  heroBlock: { gap: 8, marginBottom: 4 },
  heroBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroDot: { borderRadius: 5, height: 10, width: 10 },
  heroBadgeText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  lead: { fontSize: 14, lineHeight: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  wheelCard: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  demoRow: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  demoLabel: { fontSize: 15, fontWeight: '600' },
  demoHint: { fontSize: 12.5 },
});
