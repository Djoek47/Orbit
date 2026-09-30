/**
 * The tour's mock windows.
 *
 *   ┌ Your phone ─────────────────┐
 *   │ ╭── Assign a chore ──────╮  │   ← a fake window, drawn here, labelled as fake
 *   │ │ Chore  Take out the bins│  │
 *   │ │ Who    Nero             │  │
 *   │ │ When   ▁▁▁▁             │  │
 *   │ │            [ Assign ]   │  │
 *   │ ╰─────────────────────────╯  │
 *   └─────────────────────────────┘
 *
 * The tour used to open the real Assign sheet and wait for a real task, which put two screens on
 * top of each other and glitched on homework. Nothing here touches the app: no sheet opens, no
 * task is made, nothing is saved. The scripts live in lib/tour/mock-flows (tested); this file
 * only draws them.
 *
 * ?flow=assign | homework | sidekick
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { MemberGlyph } from '@/components/orbit/member-glyph';
import { Moji } from '@/components/orbit/moji/moji';
import { MockWindow } from '@/components/orbit/tour/mock-window';
import { typography } from '@/constants/orbit-theme';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import {
  isMockFlowId,
  MOCK_FLOW_TITLE,
  mockFlowProgress,
  mockFlowSteps,
  type MockScreen,
} from '@/lib/tour/mock-flows';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function MockFlowScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const { household, accentTheme } = useOrbit();
  const params = useLocalSearchParams<{ flow?: string }>();
  const flow = isMockFlowId(params.flow) ? params.flow : 'assign';

  const sidekick = household.members.find(
    (member) => isSidekickRole(member.role) && member.status !== 'inactive'
  );
  const steps = useMemo(() => mockFlowSteps(flow, sidekick?.name), [flow, sidekick?.name]);
  const [index, setIndex] = useState(0);
  const step = steps[Math.min(index, steps.length - 1)]!;
  const last = index >= steps.length - 1;
  const accent = accentTheme.primary;
  const isKid = step.side === 'sidekick';
  const tone = isKid ? '#8E7CFF' : accent;

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top + 8 }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <MaterialIcons name="close" size={22} color={c.textMuted} />
        </Pressable>
        <Text style={[typography.footnote, { color: c.textMuted, fontWeight: '700' }]}>
          {MOCK_FLOW_TITLE[flow]}
        </Text>
        <Text style={[typography.footnote, { color: c.textSubtle }]}>
          {index + 1}/{steps.length}
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: glassBorder(0.1) }]}>
        <View
          style={[
            styles.trackFill,
            { width: `${mockFlowProgress(steps, index) * 100}%`, backgroundColor: tone },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <Animated.View key={`stage-${step.id}`} entering={FadeIn.duration(220)} style={styles.stageRow}>
          <View style={[styles.stageDot, { backgroundColor: `${tone}26` }]}>
            {isKid && sidekick ? (
              <MemberGlyph member={sidekick} size={18} />
            ) : (
              <Moji name={isKid ? 'teddy' : 'home'} size={18} />
            )}
          </View>
          <Text style={[styles.stageLabel, { color: tone }]}>{step.stage}</Text>
        </Animated.View>

        <Animated.View
          key={step.id}
          entering={FadeInRight.duration(280)}
          exiting={FadeOut.duration(140)}
          style={styles.stack}>
          <MockScreenView screen={step.screen} tone={tone} />

          <View style={[styles.copyCard, { backgroundColor: glass(0.05), borderColor: `${tone}3D` }]}>
            <Text style={[styles.title, { color: c.text }]}>{step.title}</Text>
            <Text style={[styles.copy, { color: c.textMuted }]}>{step.body}</Text>
            {step.note ? (
              <View style={[styles.note, { backgroundColor: glass(0.06) }]}>
                <MaterialIcons name="lightbulb-outline" size={14} color={c.textSubtle} />
                <Text style={[styles.noteText, { color: c.textSubtle }]}>{step.note}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={() => (last ? router.back() : setIndex((value) => value + 1))}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: tone, opacity: pressed ? 0.88 : 1 },
          ]}>
          <Text style={styles.ctaLabel}>{step.cta}</Text>
        </Pressable>
        {last ? null : (
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
            <Text style={[typography.footnote, { color: c.textSubtle }]}>Skip</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** The fake window's contents. */
function MockScreenView({ screen, tone }: { screen: MockScreen; tone: string }) {
  const { c, glassBorder, isDark } = useOrbitColors();
  const blank = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,28,42,0.10)';

  if (screen.kind === 'form') {
    return (
      <MockWindow title={screen.window} tone={tone}>
        {screen.rows.map((row) => (
          <View key={row.label} style={styles.formRow}>
            <Text style={[styles.formLabel, { color: c.textSubtle }]}>{row.label}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              {row.filled ? (
                <Animated.View entering={FadeInRight.duration(220)}>
                  <Text style={[styles.formValue, { color: c.text }]} numberOfLines={1}>
                    {row.value}
                  </Text>
                </Animated.View>
              ) : (
                <View style={[styles.formBlank, { backgroundColor: blank }]} />
              )}
              {row.hint && !row.filled ? (
                <Text style={[styles.formHint, { color: c.textSubtle }]} numberOfLines={1}>
                  {row.hint}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
        <View
          style={[
            styles.formBtn,
            screen.buttonReady
              ? { backgroundColor: tone, borderColor: tone }
              : { backgroundColor: 'transparent', borderColor: glassBorder(0.16) },
          ]}>
          <Text
            style={[
              styles.formBtnText,
              { color: screen.buttonReady ? '#0B1220' : c.textSubtle },
            ]}>
            {screen.button}
          </Text>
        </View>
      </MockWindow>
    );
  }

  if (screen.kind === 'list') {
    return (
      <MockWindow title={screen.window} tone={tone}>
        {screen.rows.map((row) => (
          <View key={row.title} style={styles.listRow}>
            <View
              style={[
                styles.tick,
                row.done
                  ? { backgroundColor: `${tone}26`, borderColor: tone }
                  : { borderColor: glassBorder(0.24) },
              ]}>
              {row.done ? <MaterialIcons name="check" size={13} color={tone} /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[
                  styles.listTitle,
                  { color: c.text, textDecorationLine: row.done ? 'line-through' : 'none' },
                ]}
                numberOfLines={1}>
                {row.title}
              </Text>
              {row.detail ? (
                <Text style={[styles.listDetail, { color: c.textSubtle }]} numberOfLines={1}>
                  {row.detail}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </MockWindow>
    );
  }

  if (screen.kind === 'qr') {
    return (
      <MockWindow title={screen.window} tone={tone}>
        <View style={styles.qrWrap}>
          <QrBlock code={screen.code} tone={tone} />
          {/* The other phone, held over the code. */}
          <Animated.View
            key={screen.scanned ? 'scanned' : 'waiting'}
            entering={FadeIn.duration(260)}
            style={[
              styles.phone,
              {
                borderColor: screen.scanned ? tone : glassBorder(0.28),
                backgroundColor: isDark ? 'rgba(8,12,20,0.94)' : 'rgba(255,255,255,0.96)',
              },
            ]}>
            <View style={[styles.phoneNotch, { backgroundColor: glassBorder(0.24) }]} />
            {screen.scanned ? (
              <View style={styles.phoneBody}>
                <View style={[styles.phoneTick, { backgroundColor: `${tone}26`, borderColor: tone }]}>
                  <MaterialIcons name="check" size={18} color={tone} />
                </View>
                <Text style={[styles.phoneText, { color: c.text }]}>Joined</Text>
              </View>
            ) : (
              <View style={styles.phoneBody}>
                <View style={[styles.frame, { borderColor: tone }]} />
                <Text style={[styles.phoneText, { color: c.textSubtle }]}>Scanning…</Text>
              </View>
            )}
            <Text style={[styles.phoneLabel, { color: c.textSubtle }]}>{screen.phoneLabel}</Text>
          </Animated.View>
        </View>
        <Text style={[styles.codeText, { color: c.textMuted }]}>{screen.code}</Text>
      </MockWindow>
    );
  }

  return (
    <MockWindow title={screen.window} tone={tone}>
      <View style={styles.joinedRow}>
        <LinearGradient
          colors={[`${tone}4D`, `${tone}1A`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.joinedAvatar, { borderColor: `${tone}66` }]}>
          <Moji name="teddy" size={26} />
        </LinearGradient>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Text style={[styles.joinedName, { color: c.text }]}>{screen.name}</Text>
          <Text style={[styles.joinedDetail, { color: c.textSubtle }]}>{screen.detail}</Text>
        </View>
        <View style={[styles.tick, { backgroundColor: `${tone}26`, borderColor: tone }]}>
          <MaterialIcons name="check" size={13} color={tone} />
        </View>
      </View>
    </MockWindow>
  );
}

/**
 * A QR code shape. Deliberately not a real code — it's a picture of one, drawn from the
 * characters of the join code so it looks the same every time you see this step.
 */
function QrBlock({ code, tone }: { code: string; tone: string }) {
  const { isDark } = useOrbitColors();
  const cells = 9;
  const on = (row: number, col: number) => {
    // Finder squares in three corners, like a real code.
    const corner = (r0: number, c0: number) =>
      row >= r0 && row < r0 + 3 && col >= c0 && col < c0 + 3;
    if (corner(0, 0) || corner(0, cells - 3) || corner(cells - 3, 0)) {
      const r = row % 3 === 1;
      const cc = col % 3 === 1;
      return !(r && cc);
    }
    const seed = code.charCodeAt((row * cells + col) % code.length);
    return (seed + row * 7 + col * 13) % 3 !== 0;
  };
  return (
    <View
      style={[
        styles.qr,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.96)' : '#FFFFFF' },
      ]}>
      {Array.from({ length: cells }, (_, row) => (
        <View key={row} style={styles.qrRow}>
          {Array.from({ length: cells }, (_, col) => (
            <View
              key={col}
              style={[
                styles.qrCell,
                { backgroundColor: on(row, col) ? (row + col) % 7 === 0 ? tone : '#0B1220' : 'transparent' },
              ]}
            />
          ))}
        </View>
      ))}
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
    paddingVertical: 8,
  },
  track: { borderRadius: 2, height: 3, marginHorizontal: 16, overflow: 'hidden' },
  trackFill: { borderRadius: 2, height: 3 },
  body: { gap: 14, paddingHorizontal: 16, paddingTop: 16 },
  stack: { gap: 14 },
  stageRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  stageDot: {
    alignItems: 'center',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  stageLabel: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.2 },
  copyCard: { borderRadius: 20, borderWidth: 1, gap: 8, padding: 16 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  copy: { fontSize: 14.5, lineHeight: 21 },
  note: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  footer: { alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  cta: {
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 15,
    width: '100%',
  },
  ctaLabel: { color: '#0B1220', fontSize: 16, fontWeight: '800' },
  // Form
  formRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, minHeight: 34 },
  formLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, paddingTop: 3, width: 58 },
  formValue: { fontSize: 15.5, fontWeight: '600' },
  formBlank: { borderRadius: 5, height: 11, width: 104 },
  formHint: { fontSize: 11, marginTop: 3 },
  formBtn: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  formBtnText: { fontSize: 13.5, fontWeight: '800' },
  // List
  listRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 40 },
  tick: {
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  listTitle: { fontSize: 15, fontWeight: '600' },
  listDetail: { fontSize: 11.5, marginTop: 1 },
  // QR
  qrWrap: { alignItems: 'center', flexDirection: 'row', gap: 14, justifyContent: 'center' },
  qr: { borderRadius: 10, gap: 2, padding: 8 },
  qrRow: { flexDirection: 'row', gap: 2 },
  qrCell: { borderRadius: 1, height: 8, width: 8 },
  phone: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    gap: 4,
    height: 126,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    width: 78,
  },
  phoneNotch: { borderRadius: 2, height: 3, position: 'absolute', top: 6, width: 22 },
  phoneBody: { alignItems: 'center', gap: 6 },
  frame: { borderRadius: 6, borderWidth: 2, height: 32, opacity: 0.8, width: 32 },
  phoneTick: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  phoneText: { fontSize: 10, fontWeight: '700' },
  phoneLabel: { bottom: 6, fontSize: 9, position: 'absolute' },
  codeText: {
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 10,
    textAlign: 'center',
  },
  // Joined
  joinedRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  joinedAvatar: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  joinedName: { fontSize: 16, fontWeight: '700' },
  joinedDetail: { fontSize: 12 },
});
