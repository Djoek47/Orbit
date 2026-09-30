/**
 * "How proof works" — a short playlet.
 *
 *   ┌ Your phone ───────────────┐      ┌ Mia's phone ──────────────┐
 *   │ ☐ Wipe the counters       │  →   │ [ photo: ✗ not done ]     │
 *   │        [ Give it to Mia ] │      │      [ Send the photo ]   │
 *   └───────────────────────────┘      └───────────────────────────┘
 *
 * Nothing here is real: no task is created and nothing is saved. It exists so the loop —
 * ask, refuse, ask again, accept — is seen once before it matters. The beats live in
 * lib/tour/proof-walkthrough (tested); this file only plays them.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { MemberGlyph } from '@/components/orbit/member-glyph';
import { Moji } from '@/components/orbit/moji/moji';
import { typography } from '@/constants/orbit-theme';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import {
  walkthroughBeats,
  walkthroughProgress,
  type WalkthroughBeat,
  type WalkthroughKind,
} from '@/lib/tour/proof-walkthrough';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

const KIND_LABEL: Record<WalkthroughKind, string> = {
  chore: 'Chores & proof',
  homework: 'Homework & proof',
  plan: 'Calendar & approval',
};

export default function ProofWalkthroughScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const { household, accentTheme } = useOrbit();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: WalkthroughKind =
    params.kind === 'homework' || params.kind === 'plan' ? params.kind : 'chore';

  const sidekick = household.members.find(
    (member) => isSidekickRole(member.role) && member.status !== 'inactive'
  );
  const kidName = sidekick?.name ?? 'your Sidekick';

  const beats = useMemo(() => walkthroughBeats(kind, kidName), [kind, kidName]);
  const [index, setIndex] = useState(0);
  const beat = beats[index]!;
  const last = index === beats.length - 1;
  const accent = accentTheme.primary;
  const isKid = beat.actor === 'sidekick';
  const stageTone = isKid ? '#8E7CFF' : accent;

  const next = () => {
    if (last) {
      router.back();
      return;
    }
    setIndex((value) => value + 1);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top + 8 }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close">
          <MaterialIcons name="close" size={22} color={c.textMuted} />
        </Pressable>
        <Text style={[typography.footnote, { color: c.textMuted, fontWeight: '700' }]}>
          {KIND_LABEL[kind]}
        </Text>
        <Text style={[typography.footnote, { color: c.textSubtle }]}>
          {index + 1}/{beats.length}
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: glassBorder(0.1) }]}>
        <View
          style={[
            styles.trackFill,
            { width: `${walkthroughProgress(beats, index) * 100}%`, backgroundColor: accent },
          ]}
        />
      </View>

      <View style={styles.body}>
        <Animated.View key={`stage-${beat.id}`} entering={FadeIn.duration(220)} style={styles.stageRow}>
          <View style={[styles.stageDot, { backgroundColor: `${stageTone}26` }]}>
            {isKid && sidekick ? (
              <MemberGlyph member={sidekick} size={18} />
            ) : (
              <Moji name={isKid ? 'teddy' : 'home'} size={18} />
            )}
          </View>
          <Text style={[styles.stageLabel, { color: stageTone }]}>{beat.stage}</Text>
        </Animated.View>

        <Animated.View
          key={beat.id}
          entering={FadeInRight.duration(280)}
          exiting={FadeOut.duration(140)}
          style={[styles.card, { backgroundColor: glass(0.05), borderColor: `${stageTone}44` }]}>
          <BeatArt beat={beat} accent={accent} title={beats[0]!.title} />

          <Text style={[styles.title, { color: c.text }]}>{beat.title}</Text>
          <Text style={[styles.copy, { color: c.textMuted }]}>{beat.body}</Text>
          {beat.note ? (
            <View style={[styles.note, { backgroundColor: glass(0.06) }]}>
              <MaterialIcons name="lightbulb-outline" size={14} color={c.textSubtle} />
              <Text style={[styles.noteText, { color: c.textSubtle }]}>{beat.note}</Text>
            </View>
          ) : null}
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={next}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: stageTone, opacity: pressed ? 0.88 : 1 },
          ]}>
          <Text style={styles.ctaLabel}>{beat.cta}</Text>
        </Pressable>
        {!last ? (
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={[typography.footnote, { color: c.textSubtle }]}>Skip</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** The little mock screen above the words: a task row, a photo, or a tick. */
function BeatArt({ beat, accent, title }: { beat: WalkthroughBeat; accent: string; title: string }) {
  const { c, glass, glassBorder } = useOrbitColors();

  if (beat.show === 'photo') {
    const bad = beat.verdict === 'messy';
    const tone = bad ? '#F87171' : '#34D399';
    return (
      <LinearGradient
        colors={[`${tone}2E`, `${tone}0D`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.shot, { borderColor: `${tone}66` }]}>
        <Moji name={bad ? 'trashBag' : 'sparkles'} size={44} />
        <View style={[styles.verdict, { backgroundColor: tone }]}>
          <MaterialIcons name={bad ? 'close' : 'check'} size={26} color="#0B1220" />
        </View>
        <Text style={[styles.shotLabel, { color: tone }]}>
          {bad ? 'Not done yet' : 'Done properly'}
        </Text>
      </LinearGradient>
    );
  }

  if (beat.show === 'confirmed') {
    return (
      <View style={[styles.shot, { borderColor: '#34D39966', backgroundColor: '#34D3991F' }]}>
        <View style={[styles.verdict, { backgroundColor: '#34D399' }]}>
          <MaterialIcons name="check" size={26} color="#0B1220" />
        </View>
        <Text style={[styles.shotLabel, { color: '#34D399' }]}>Confirmed</Text>
      </View>
    );
  }

  const done = beat.show === 'task_done';
  const asking = beat.show === 'asking';
  return (
    <View style={[styles.mockRow, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}>
      <MaterialIcons
        name={done ? 'check-circle' : 'radio-button-unchecked'}
        size={22}
        color={done ? '#34D399' : accent}
      />
      <Text
        style={[
          styles.mockTitle,
          { color: c.text },
          done && { color: c.textMuted, textDecorationLine: 'line-through' },
        ]}
        numberOfLines={1}>
        {title}
      </Text>
      {asking ? (
        <View style={[styles.mockPill, { backgroundColor: `${accent}26` }]}>
          <MaterialIcons name="photo-camera" size={13} color={accent} />
          <Text style={[styles.mockPillText, { color: accent }]}>Photo</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  track: { height: 3, marginHorizontal: 20, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: 3, borderRadius: 2 },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, gap: 12 },
  stageRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  stageDot: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stageLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.1 },
  card: { borderRadius: 24, borderWidth: 1, gap: 10, padding: 18 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  copy: { fontSize: 15.5, lineHeight: 22 },
  note: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 8, padding: 10 },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  shot: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 170,
    padding: 16,
  },
  verdict: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  shotLabel: { fontSize: 14, fontWeight: '800' },
  mockRow: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  mockTitle: { flex: 1, fontSize: 15.5, fontWeight: '700' },
  mockPill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  mockPillText: { fontSize: 12, fontWeight: '800' },
  footer: { gap: 12, paddingHorizontal: 20, alignItems: 'center' },
  cta: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 54,
    width: '100%',
  },
  ctaLabel: { color: '#0B1220', fontSize: 16.5, fontWeight: '800' },
});
