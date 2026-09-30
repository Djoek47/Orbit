/**
 * Poppins → Advanced.
 *
 * This used to be a bottom sheet, and the sheet scrolled past its own content: you could drag
 * the page up behind it and there was no clear way out. It is a screen now, so it scrolls the
 * way every other screen does and Back is always there.
 *
 * "Allow Sidekick AI" lives here, per the brief. It writes the same household setting as the
 * one in Sidekick permissions — one switch, two doors — and the row says so, so nobody thinks
 * there are two of them to keep in step.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';
import { SegmentedControl } from '@/components/orbit/segmented-control';
import { typography } from '@/constants/orbit-theme';
import {
  DEFAULT_POPPINS_INTERACTION_PREFS,
  loadPoppinsInteractionPrefs,
  poppinsTier,
  savePoppinsInteractionPrefs,
  type PoppinsConfirmTime,
  type PoppinsInteractionPrefs,
  type PoppinsUndoWindowSec,
} from '@/lib/poppins/poppins-prefs';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

const TONE = {
  waiting: '#4FA3FF',
  writing: '#8E7CFF',
  sidekicks: '#7FC24A',
} as const;

export default function PoppinsAdvancedScreen() {
  const insets = useSafeAreaInsets();
  const { c, glassBorder, isDark } = useOrbitColors();
  const { household, permissions, updateSidekickPoppinsAi } = useOrbit();
  const [prefs, setPrefs] = useState<PoppinsInteractionPrefs>(DEFAULT_POPPINS_INTERACTION_PREFS);
  const [busy, setBusy] = useState(false);
  const readOnly = !permissions.canManageHousehold;

  useEffect(() => {
    void loadPoppinsInteractionPrefs(household.id).then(setPrefs);
  }, [household.id]);

  const patch = useCallback(
    (next: Partial<PoppinsInteractionPrefs>) => {
      if (readOnly) return;
      setPrefs((current) => {
        const merged = { ...current, ...next };
        void savePoppinsInteractionPrefs(household.id, merged);
        return merged;
      });
    },
    [household.id, readOnly]
  );

  const tier = poppinsTier(prefs);
  const sidekickAi = household.sidekickPoppinsAi === true;

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
        <Text style={[typography.headline, { color: c.text }]}>Advanced</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>
        <Animated.View
          entering={FadeInDown.duration(240)}
          style={[styles.lede, { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) }]}>
          <View style={[styles.ledeMoji, { backgroundColor: `${TONE.waiting}22` }]}>
            <Moji name="tools" size={26} />
          </View>
          <Text style={[styles.ledeText, { color: c.textSoft }]}>
            How Poppins waits, writes and notifies. None of this changes what Base or Max cost.
            {tier === 'custom' ? ' This household is Custom because something here left the preset.' : ''}
          </Text>
        </Animated.View>

        <Group label="Waiting and undoing" moji="timer" tone={TONE.waiting} delay={60}>
          <Card tone={TONE.waiting}>
            <ToggleRow
              moji="bolt"
              tone={TONE.waiting}
              label="Act immediately"
              sub="Skips the pause before saving. You can still undo."
              value={prefs.actImmediately}
              disabled={readOnly}
              onChange={(actImmediately) => patch({ actImmediately })}
            />
            <View style={[styles.segment, { borderTopColor: glassBorder(0.08) }]}>
              <SegmentedControl<PoppinsConfirmTime>
                label="Confirm time"
                subtitle="How long Poppins waits in silence before it saves."
                disabled={readOnly}
                options={[
                  { value: 'quick', label: 'Quick' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'relaxed', label: 'Relaxed' },
                ]}
                value={prefs.confirmTime}
                onChange={(confirmTime) => patch({ confirmTime })}
              />
            </View>
            <View style={[styles.segment, { borderTopColor: glassBorder(0.08) }]}>
              <SegmentedControl<`${PoppinsUndoWindowSec}`>
                label="Undo window"
                subtitle="How long Undo stays on screen after something is saved."
                disabled={readOnly}
                options={[
                  { value: '5', label: '5s' },
                  { value: '10', label: '10s' },
                  { value: '15', label: '15s' },
                ]}
                value={`${prefs.undoWindowSec}`}
                onChange={(value) =>
                  patch({ undoWindowSec: Number(value) as PoppinsUndoWindowSec })
                }
              />
            </View>
          </Card>
        </Group>

        <Group label="What you see and hear" moji="sparkles" tone={TONE.writing} delay={120}>
          <Card tone={TONE.writing}>
            <ToggleRow
              moji="sparkles"
              tone={TONE.writing}
              label="Show thinking"
              sub="A short pause on screen while Poppins works it out."
              value={prefs.showThinking}
              disabled={readOnly}
              onChange={(showThinking) => patch({ showThinking })}
            />
            <ToggleRow
              moji="book"
              tone={TONE.writing}
              label="Written replies"
              sub="Poppins writes its answer on screen. Questions always show."
              value={prefs.writtenReplies}
              disabled={readOnly}
              divider
              onChange={(writtenReplies) => patch({ writtenReplies })}
            />
            <ToggleRow
              moji="bell"
              tone={TONE.writing}
              label="Notification actions"
              sub="Approve or change what Poppins suggests from the notification itself."
              value={prefs.notificationActions}
              disabled={readOnly}
              divider
              onChange={(notificationActions) => patch({ notificationActions })}
            />
          </Card>
        </Group>

        {permissions.canManageHousehold ? (
          <Group label="Sidekicks" moji="teddy" tone={TONE.sidekicks} delay={180}>
            <Card tone={TONE.sidekicks}>
              <ToggleRow
                moji="poppins"
                tone={TONE.sidekicks}
                label="Allow Sidekick AI"
                sub="Kids and Sidekicks get the Poppins tab, on Base only. Off until you turn it on."
                value={sidekickAi}
                disabled={busy}
                onChange={(value) => {
                  setBusy(true);
                  void Promise.resolve(updateSidekickPoppinsAi(value)).finally(() => setBusy(false));
                }}
              />
            </Card>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/settings?section=sidekicks' as never)}
              style={styles.linkRow}>
              <Moji name="shield" size={14} />
              <Text style={[styles.linkText, { color: TONE.sidekicks }]}>
                Same switch as Sidekick permissions — open the rest
              </Text>
            </Pressable>
          </Group>
        ) : null}

        {readOnly ? (
          <Text style={[styles.note, { color: c.textMuted }]}>
            Children and Sidekicks see this page, but only an admin can change it.
          </Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => patch({ ...DEFAULT_POPPINS_INTERACTION_PREFS, voiceId: prefs.voiceId })}
            style={[styles.reset, { borderColor: glassBorder(0.14) }]}>
            <Text style={[styles.resetText, { color: c.textMuted }]}>Back to the defaults</Text>
          </Pressable>
        )}
      </ScrollView>
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

function Card({ tone, children }: { tone: string; children: React.ReactNode }) {
  const { isDark } = useOrbitColors();
  return (
    <View style={[styles.card, { backgroundColor: glassFill(isDark), borderColor: `${tone}2E` }]}>
      {children}
    </View>
  );
}

function ToggleRow({
  moji,
  tone,
  label,
  sub,
  value,
  disabled,
  divider,
  onChange,
}: {
  moji: MojiName;
  tone: string;
  label: string;
  sub: string;
  value: boolean;
  disabled?: boolean;
  divider?: boolean;
  onChange: (value: boolean) => void;
}) {
  const { c, glassBorder } = useOrbitColors();
  return (
    <View
      style={[
        styles.row,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: glassBorder(0.08) },
      ]}>
      <View style={[styles.rowMoji, { backgroundColor: value ? `${tone}22` : glassBorder(0.08) }]}>
        <Moji name={moji} size={18} />
      </View>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
        <Text style={[styles.rowSub, { color: c.textMuted }]}>{sub}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: glassBorder(0.14), true: tone }}
      />
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
  content: { gap: 16, paddingHorizontal: 16, paddingTop: 8 },
  lede: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  ledeMoji: {
    alignItems: 'center',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  ledeText: { flex: 1, fontSize: 13, lineHeight: 18 },
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
    minHeight: 58,
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
  segment: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 14 },
  linkRow: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingTop: 2 },
  linkText: { fontSize: 12.5, fontWeight: '700' },
  note: { fontSize: 12.5, lineHeight: 18, paddingHorizontal: 4 },
  reset: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  resetText: { fontSize: 13.5, fontWeight: '600' },
});
