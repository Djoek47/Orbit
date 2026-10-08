/**
 * Settings → Poppins.
 *
 * One assistant, one name. There used to be characters to pick between (Steward,
 * Intelligence…) and a separate "personality" sheet; all of that is gone. What's left is the
 * three things a household actually decides:
 *
 *   how it answers   Base writes, Max talks — drawn, not explained (tier-cards)
 *   how it sounds    a colour on a wheel (voice-wheel)
 *   the rest         Advanced, credits, and a demo of the whole thing working
 *
 * Laid out like House rules and Sidekick permissions: a hero that leads with the one number
 * that matters, coloured group headers, and cards that arrive rather than appear.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';
import { PoppinsTierCards } from '@/components/orbit/poppins/tier-cards';
import { VoiceWheel } from '@/components/orbit/poppins/voice-wheel';
import { TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import { getMajordomoProfile } from '@/lib/ai/majordomo-profiles';
import { poppinsVoice, resolvePoppinsVoice } from '@/lib/ai/poppins-voices';
import type { PoppinsInteractionPrefs } from '@/lib/poppins/poppins-prefs';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

type Props = {
  prefs: PoppinsInteractionPrefs;
  /** Legacy character id, so a household that picked one keeps its voice. */
  legacyProfileId?: string | null;
  readOnly?: boolean;
  /** Actions used and left this period. */
  usage: { used: number; remaining: number; topUp: number; resetsAt: string; paused: boolean };
  isAdmin: boolean;
  onPrefs: (next: PoppinsInteractionPrefs) => void;
  /** True while the voice wheel is being dragged — Settings locks scroll / sheet gestures. */
  onVoiceWheelInteraction?: (active: boolean) => void;
};

export function PoppinsSettingsPanel({
  prefs,
  legacyProfileId,
  readOnly,
  usage,
  isAdmin,
  onPrefs,
  onVoiceWheelInteraction,
}: Props) {
  const { c, glassBorder, isDark } = useOrbitColors();
  const { currentMember } = useOrbit();
  const memberFirstName = currentMember?.name?.split(' ')[0] ?? null;
  const voiceId = useMemo(
    () =>
      resolvePoppinsVoice({
        voiceId: prefs.voiceId,
        legacyProfileId,
        legacyVoiceFor: (id) => getMajordomoProfile(id).voice,
      }),
    [legacyProfileId, prefs.voiceId]
  );
  const voice = poppinsVoice(voiceId);
  const tone = voice.color;

  const left = Math.max(0, usage.remaining);
  const resets = new Date(usage.resetsAt);
  const resetLabel = Number.isNaN(resets.getTime())
    ? ''
    : resets.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <View style={styles.root}>
      {/* The hero: what's left this month, in the voice's own colour. */}
      <Animated.View entering={FadeInDown.duration(260)}>
        <LinearGradient
          colors={[`${tone}3D`, `${tone}0F`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderColor: `${tone}55` }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.heroValue, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {usage.paused ? 'Paused' : left}
            </Text>
            <Text style={[styles.heroCaption, { color: tone }]}>
              {usage.paused
                ? 'out of actions — typing still works'
                : `action${left === 1 ? '' : 's'} left${resetLabel ? ` · resets ${resetLabel}` : ''}`}
            </Text>
            <Text style={[styles.heroSub, { color: c.textMuted }]}>
              {usage.topUp > 0
                ? `${usage.used} used of ${TOKENS_PER_MONTH} · ${usage.topUp} from top-ups`
                : `${usage.used} used of ${TOKENS_PER_MONTH} this month`}
            </Text>
          </View>
          <View style={[styles.heroMoji, { backgroundColor: `${tone}2E` }]}>
            <Moji name="poppins" size={44} />
          </View>
        </LinearGradient>
      </Animated.View>

      {/* How it answers. */}
      <Group label="How Poppins answers" moji="sparkles" tone={tone} delay={60}>
        <PoppinsTierCards
          prefs={prefs}
          disabled={readOnly}
          onSelectTier={(tier) => onPrefs({ ...prefs, speakBack: tier === 'max' })}
        />
      </Group>

      {/* How it sounds. */}
      <Group label="How Poppins sounds" moji="poppins" tone={tone} delay={120}>
        <View
          style={[styles.card, { backgroundColor: glassFill(isDark), borderColor: `${tone}2E`, padding: 16 }]}>
          <VoiceWheel
            voiceId={voiceId}
            disabled={readOnly}
            memberFirstName={memberFirstName}
            onSelect={(next) => onPrefs({ ...prefs, voiceId: next })}
            onInteractionChange={onVoiceWheelInteraction}
          />
        </View>
      </Group>

      {/* Everything else. */}
      <Group label="More" moji="tools" tone={tone} delay={180}>
        <View style={[styles.card, { backgroundColor: glassFill(isDark), borderColor: `${tone}2E` }]}>
          <NavRow
            moji="poppins"
            tone="#17B9A0"
            label="How it works"
            sub="Watch Poppins do a chore, a shop, a week and a trip"
            onPress={() => router.push('/poppins-how-it-works' as never)}
            divider={false}
          />
          {/* Two different things, two rows: a month's allowance, and a balance that keeps. */}
          <NavRow
            moji="receipt"
            tone="#FF9F1C"
            label="Actions"
            sub="Where this month's actions went, day by day"
            onPress={() => router.push('/poppins-actions' as never)}
            divider
          />
          {isAdmin ? (
            <NavRow
              moji="gem"
              tone="#FFD166"
              label="Credits"
              sub="Buy packs · never expire"
              onPress={() => router.push('/poppins-credits' as never)}
              divider
            />
          ) : null}
          <NavRow
            moji="tools"
            tone="#8E7CFF"
            label="Advanced"
            sub="Save timing, on-screen replies, quiet hours"
            onPress={() => router.push('/poppins-advanced' as never)}
            divider
          />
        </View>
      </Group>

      {readOnly ? (
        <Text style={[styles.note, { color: c.textMuted, borderColor: glassBorder(0.1) }]}>
          Only an admin can change how Poppins works for this household.
        </Text>
      ) : null}
    </View>
  );
}

function Group({
  label,
  moji,
  tone,
  delay,
  children,
}: {
  label: string;
  moji: MojiName;
  tone: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(280)} style={{ gap: 8 }}>
      <View style={styles.groupHead}>
        <View style={[styles.groupMoji, { backgroundColor: `${tone}22` }]}>
          <Moji name={moji} size={16} />
        </View>
        <Text style={[styles.groupLabel, { color: tone }]}>{label}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

function NavRow({
  moji,
  tone,
  label,
  sub,
  onPress,
  divider,
}: {
  moji: MojiName;
  tone: string;
  label: string;
  sub: string;
  onPress: () => void;
  divider: boolean;
}) {
  const { c, glassBorder } = useOrbitColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${sub}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: glassBorder(0.08) },
        pressed && { opacity: 0.6 },
      ]}>
      <View style={[styles.rowMoji, { backgroundColor: `${tone}22` }]}>
        <Moji name={moji} size={18} />
      </View>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
        <Text style={[styles.rowSub, { color: c.textMuted }]}>{sub}</Text>
      </View>
      <Text style={[styles.chevron, { color: c.textSubtle }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  hero: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  heroValue: { fontSize: 42, fontWeight: '900', letterSpacing: -1, lineHeight: 46 },
  heroCaption: { fontSize: 14, fontWeight: '800', letterSpacing: 0.1 },
  heroSub: { fontSize: 12.5, marginTop: 2 },
  heroMoji: {
    alignItems: 'center',
    borderRadius: 24,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  groupHead: { alignItems: 'center', flexDirection: 'row', gap: 8, marginLeft: 2 },
  groupMoji: {
    alignItems: 'center',
    borderRadius: 9,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  groupLabel: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.2 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowMoji: {
    alignItems: 'center',
    borderRadius: 12,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12.5, lineHeight: 17 },
  chevron: { fontSize: 22, fontWeight: '400' },
  note: { fontSize: 12.5, lineHeight: 18, paddingHorizontal: 4 },
});
