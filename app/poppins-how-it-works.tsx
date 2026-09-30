/**
 * Poppins → How it works.
 *
 * A pre-recorded demonstration. Two Poppins voices — Rose asking the way a person would,
 * Indigo doing it — and the card between them fills in as they speak: a chore, then four
 * groceries on one card, then three appointments, then a trip with addresses.
 *
 * Recorded means recorded: it is a timed script (lib/poppins/how-it-works-script) drawing mock
 * cards. No model is called, no microphone opens, nothing is saved and it costs nothing to
 * watch. The cards are drawn here rather than borrowed from the live stage, so the demo can
 * never wander into real data or leave a half-finished card behind.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';
import { typography } from '@/constants/orbit-theme';
import {
  beatAt,
  chapterOf,
  chapterStartMs,
  DEMO_BEATS,
  DEMO_CHAPTERS,
  DEMO_SPEAKERS,
  demoProgress,
  demoTotalMs,
  formatDemoClock,
  type DemoCard,
} from '@/lib/poppins/how-it-works-script';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';

const TICK_MS = 100;

export default function PoppinsHowItWorksScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const total = useMemo(() => demoTotalMs(), []);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setElapsed((ms) => {
        const next = ms + TICK_MS;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
    }, TICK_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [playing, total]);

  const index = beatAt(elapsed);
  const beat = DEMO_BEATS[index]!;
  const chapter = DEMO_CHAPTERS.find((item) => item.id === chapterOf(index))!;
  const finished = elapsed >= total;
  const progress = demoProgress(elapsed);

  const jump = (ms: number) => {
    setElapsed(ms);
    setPlaying(true);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top + 8 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <MaterialIcons name="chevron-left" size={28} color={c.text} />
        </Pressable>
        <Text style={[typography.headline, { color: c.text }]}>How it works</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.lede, { color: c.textMuted }]}>
          A recording, not a live session. Two Poppins voices — one asking, one doing — and the
          card follows along. Nothing here is saved, and watching it costs nothing.
        </Text>

        {/* Chapter rail. */}
        <View style={styles.rail}>
          {DEMO_CHAPTERS.map((item) => {
            const on = item.id === chapter.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => jump(chapterStartMs(item.id))}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={item.label}
                style={[
                  styles.railChip,
                  {
                    backgroundColor: on ? `${item.color}26` : glass(0.05),
                    borderColor: on ? `${item.color}77` : glassBorder(0.1),
                  },
                ]}>
                <Moji name={item.moji as MojiName} size={14} />
                <Text
                  style={[styles.railText, { color: on ? item.color : c.textMuted }]}
                  numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* The stage: the two voices with the card between them. */}
        <View
          style={[
            styles.stage,
            { backgroundColor: glassFill(isDark), borderColor: `${chapter.color}3D` },
          ]}>
          <LinearGradient
            colors={[`${chapter.color}1F`, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.stageWash}
            pointerEvents="none"
          />

          <View style={styles.voicesRow}>
            {(['rose', 'indigo'] as const).map((id) => {
              const speaker = DEMO_SPEAKERS[id];
              const live = beat.speaker === id;
              return (
                <View key={id} style={styles.voice}>
                  <View
                    style={[
                      styles.voiceOrb,
                      {
                        backgroundColor: `${speaker.color}${live ? '33' : '14'}`,
                        borderColor: live ? speaker.color : `${speaker.color}33`,
                      },
                    ]}>
                    <Moji name="poppins" size={22} />
                  </View>
                  <Text
                    style={[styles.voiceName, { color: live ? speaker.color : c.textSubtle }]}
                    numberOfLines={1}>
                    {speaker.label}
                  </Text>
                  <Text style={[styles.voiceRole, { color: c.textSubtle }]} numberOfLines={1}>
                    {speaker.role}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* What was just said. */}
          <Animated.View key={beat.id} entering={FadeInRight.duration(260)} style={styles.bubbleWrap}>
            <View
              style={[
                styles.bubble,
                {
                  alignSelf: beat.speaker === 'indigo' ? 'flex-end' : 'flex-start',
                  backgroundColor: beat.speaker
                    ? `${DEMO_SPEAKERS[beat.speaker].color}1F`
                    : glass(0.05),
                  borderColor: beat.speaker
                    ? `${DEMO_SPEAKERS[beat.speaker].color}4D`
                    : glassBorder(0.1),
                },
              ]}>
              <Text style={[styles.bubbleText, { color: c.text }]}>{beat.line}</Text>
            </View>
          </Animated.View>

          {/* The card. */}
          <View style={styles.cardSlot}>
            <DemoCardView card={beat.card} tone={chapter.color} />
          </View>

          {beat.note ? (
            <Animated.View key={`${beat.id}-note`} entering={FadeIn.duration(280)} exiting={FadeOut.duration(140)}>
              <Text style={[styles.note, { color: chapter.color }]}>{beat.note}</Text>
            </Animated.View>
          ) : null}
        </View>

        {/* Transport. */}
        <View style={styles.transport}>
          <Pressable
            onPress={() => (finished ? jump(0) : setPlaying((on) => !on))}
            accessibilityRole="button"
            accessibilityLabel={finished ? 'Watch it again' : playing ? 'Pause' : 'Play'}
            style={[styles.playBtn, { backgroundColor: `${chapter.color}26`, borderColor: `${chapter.color}66` }]}>
            <MaterialIcons
              name={finished ? 'replay' : playing ? 'pause' : 'play-arrow'}
              size={22}
              color={chapter.color}
            />
          </Pressable>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={[styles.track, { backgroundColor: glassBorder(0.12) }]}>
              <View
                style={[
                  styles.trackFill,
                  { width: `${Math.round(progress * 100)}%`, backgroundColor: chapter.color },
                ]}
              />
            </View>
            <View style={styles.clockRow}>
              <Text style={[styles.clock, { color: c.textMuted }]}>{formatDemoClock(elapsed)}</Text>
              <Text style={[styles.clock, { color: c.textSubtle }]}>{formatDemoClock(total)}</Text>
            </View>
          </View>
        </View>

        {finished ? (
          <Animated.View entering={FadeInDown.duration(280)}>
            <Pressable
              onPress={() => router.push('/(tabs)/poppins' as never)}
              accessibilityRole="button"
              style={[styles.cta, { backgroundColor: `${chapter.color}1F`, borderColor: `${chapter.color}66` }]}>
              <Moji name="poppins" size={18} />
              <Text style={[styles.ctaText, { color: c.text }]}>Try it yourself</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        <Text style={[styles.footnote, { color: c.textSubtle }]}>
          Rose and Indigo are two of the colours on the voice wheel. Whichever you pick is the one
          Poppins uses everywhere it speaks.
        </Text>
      </ScrollView>
    </View>
  );
}

/** The mock cards. Deliberately simple — they teach the shape, not the pixel. */
function DemoCardView({ card, tone }: { card: DemoCard; tone: string }) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const shell = [
    styles.card,
    { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,28,42,0.04)', borderColor: glassBorder(0.12) },
  ];

  if (card.kind === 'idle') return <View style={[...shell, { minHeight: 120 }]} />;

  if (card.kind === 'thinking') {
    return (
      <Animated.View entering={FadeIn.duration(220)} style={[...shell, styles.centered]}>
        <View style={styles.dots}>
          {[0, 1, 2].map((dot) => (
            <View key={dot} style={[styles.dot, { backgroundColor: tone, opacity: 0.4 + dot * 0.25 }]} />
          ))}
        </View>
        <Text style={[styles.thinking, { color: c.textMuted }]}>{card.line}</Text>
      </Animated.View>
    );
  }

  if (card.kind === 'task') {
    const slot = (key: 'title' | 'assignee' | 'due', value: string, label: string) => {
      const on = card.filled.includes(key);
      return (
        <View key={key} style={styles.slotRow}>
          <Text style={[styles.slotLabel, { color: c.textSubtle }]}>{label}</Text>
          {on ? (
            <Animated.View entering={FadeInRight.duration(220)}>
              <Text style={[styles.slotValue, { color: c.text }]}>{value}</Text>
            </Animated.View>
          ) : (
            <View style={[styles.slotBlank, { backgroundColor: glassBorder(0.12) }]} />
          )}
        </View>
      );
    };
    return (
      <View style={shell}>
        <CardHead tone={tone} moji="clipboard" label="New chore" />
        {slot('title', card.title, 'What')}
        {slot('assignee', card.assignee, 'Who')}
        {slot('due', card.due, 'When')}
      </View>
    );
  }

  if (card.kind === 'groceries') {
    return (
      <View style={shell}>
        <CardHead tone={tone} moji="cart" label={`Shopping list · ${card.items.length}`} />
        {card.items.map((item) => (
          <Animated.View key={item.label} entering={FadeInRight.duration(220)} style={styles.itemRow}>
            <View style={[styles.itemDot, { backgroundColor: tone }]} />
            <Text style={[styles.itemLabel, { color: c.text }]}>{item.label}</Text>
            <Text style={[styles.itemMeta, { color: c.textSubtle }]}>{item.aisle}</Text>
          </Animated.View>
        ))}
      </View>
    );
  }

  if (card.kind === 'events') {
    return (
      <View style={shell}>
        <CardHead tone={tone} moji="calendar" label="This week" />
        {card.events.map((event) => (
          <Animated.View key={event.title} entering={FadeInRight.duration(220)} style={styles.itemRow}>
            <View style={[styles.when, { backgroundColor: `${tone}1F` }]}>
              <Text style={[styles.whenText, { color: tone }]}>{event.when}</Text>
            </View>
            <Text style={[styles.itemLabel, { color: c.text }]} numberOfLines={1}>
              {event.title}
            </Text>
            {event.who ? (
              <Text style={[styles.itemMeta, { color: c.textSubtle }]}>{event.who}</Text>
            ) : null}
          </Animated.View>
        ))}
      </View>
    );
  }

  if (card.kind === 'trip') {
    return (
      <View style={shell}>
        <CardHead tone={tone} moji="pin" label={card.title} />
        {card.stops.map((stop, index) => (
          <Animated.View key={stop.label} entering={FadeInRight.duration(220)} style={styles.stopRow}>
            <View style={styles.spine}>
              <View style={[styles.stopDot, { backgroundColor: tone }]} />
              {index < card.stops.length - 1 ? (
                <View style={[styles.stopLine, { backgroundColor: `${tone}55` }]} />
              ) : null}
            </View>
            <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
              <Text style={[styles.itemLabel, { color: c.text }]}>{stop.label}</Text>
              <Text style={[styles.itemMeta, { color: c.textSubtle }]} numberOfLines={1}>
                {stop.address}
              </Text>
            </View>
            <Text style={[styles.stopTime, { color: tone }]}>{stop.time}</Text>
          </Animated.View>
        ))}
      </View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      style={[
        ...shell,
        styles.centered,
        { backgroundColor: `${tone}14`, borderColor: `${tone}55` },
      ]}>
      <View style={[styles.doneRing, { borderColor: tone, backgroundColor: `${tone}26` }]}>
        <Moji name="check" size={22} />
      </View>
      <Text style={[styles.doneLabel, { color: c.text }]}>{card.label}</Text>
      {card.detail ? (
        <Text style={[styles.doneDetail, { color: c.textMuted }]}>{card.detail}</Text>
      ) : null}
      <View style={{ height: 0, width: 0, backgroundColor: glass(0) }} />
    </Animated.View>
  );
}

function CardHead({ tone, moji, label }: { tone: string; moji: MojiName; label: string }) {
  return (
    <View style={styles.cardHead}>
      <View style={[styles.cardHeadMoji, { backgroundColor: `${tone}22` }]}>
        <Moji name={moji} size={14} />
      </View>
      <Text style={[styles.cardHeadText, { color: tone }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  content: { gap: 14, paddingHorizontal: 16, paddingTop: 8 },
  lede: { fontSize: 13, lineHeight: 19 },
  rail: { flexDirection: 'row', gap: 6 },
  railChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 7,
  },
  railText: { fontSize: 11, fontWeight: '700' },
  stage: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
    padding: 16,
  },
  stageWash: { height: 120, left: 0, position: 'absolute', right: 0, top: 0 },
  voicesRow: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  voice: { alignItems: 'center', gap: 2, width: 76 },
  voiceOrb: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  voiceName: { fontSize: 12.5, fontWeight: '800' },
  voiceRole: { fontSize: 10.5 },
  bubbleWrap: { minHeight: 52 },
  bubble: {
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: '92%',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  cardSlot: { minHeight: 150 },
  card: { borderRadius: 18, borderWidth: 1, gap: 8, padding: 14 },
  centered: { alignItems: 'center', gap: 8, justifyContent: 'center', minHeight: 150 },
  cardHead: { alignItems: 'center', flexDirection: 'row', gap: 7, marginBottom: 2 },
  cardHeadMoji: {
    alignItems: 'center',
    borderRadius: 8,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  cardHeadText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.2 },
  slotRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 26 },
  slotLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, width: 42 },
  slotValue: { fontSize: 15, fontWeight: '600' },
  slotBlank: { borderRadius: 5, height: 10, width: 82 },
  itemRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 26 },
  itemDot: { borderRadius: 4, height: 8, width: 8 },
  itemLabel: { flex: 1, fontSize: 14.5, fontWeight: '600' },
  itemMeta: { fontSize: 11.5 },
  when: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  whenText: { fontSize: 11, fontWeight: '800' },
  stopRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 40 },
  spine: { alignItems: 'center', height: 40, width: 10 },
  stopDot: { borderRadius: 5, height: 10, marginTop: 6, width: 10 },
  stopLine: { flex: 1, marginTop: 2, width: 2 },
  stopTime: { fontSize: 12, fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { borderRadius: 4, height: 8, width: 8 },
  thinking: { fontSize: 13 },
  doneRing: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  doneLabel: { fontSize: 18, fontWeight: '800' },
  doneDetail: { fontSize: 13, textAlign: 'center' },
  note: { fontSize: 12.5, fontWeight: '700', lineHeight: 18, textAlign: 'center' },
  transport: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  playBtn: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  track: { borderRadius: 3, height: 5, overflow: 'hidden' },
  trackFill: { borderRadius: 3, height: 5 },
  clockRow: { flexDirection: 'row', justifyContent: 'space-between' },
  clock: { fontSize: 11, fontVariant: ['tabular-nums'] },
  cta: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  ctaText: { fontSize: 15, fontWeight: '700' },
  footnote: { fontSize: 11.5, lineHeight: 16 },
});
