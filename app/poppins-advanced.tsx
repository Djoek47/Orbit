/**
 * Poppins → Advanced.
 *
 * Household-facing knobs for how Poppins saves chores, shows replies, and alerts.
 * Base / Max cost is unchanged by anything here — tuning marks the household Custom.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, router, Stack } from 'expo-router';
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
import { isSidekickRole } from '@/lib/sidekick/permissions';

const TONE = {
  save: '#4FA3FF',
  show: '#8E7CFF',
  home: '#FF9F1C',
  sidekicks: '#7FC24A',
} as const;

function PoppinsAdvancedScreenInner() {
  const insets = useSafeAreaInsets();
  const { c, glassBorder, isDark } = useOrbitColors();
  const { household, permissions, updateNotificationPrefs } = useOrbit();
  const [prefs, setPrefs] = useState<PoppinsInteractionPrefs>(DEFAULT_POPPINS_INTERACTION_PREFS);
  const readOnly = !permissions.canManageHousehold;
  const quietHours = household.notificationPrefs?.quietHoursEnabled !== false;
  const quietStart = household.notificationPrefs?.quietHoursStart ?? '21:00';
  const quietEnd = household.notificationPrefs?.quietHoursEnd ?? '07:00';

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
          <View style={[styles.ledeMoji, { backgroundColor: `${TONE.save}22` }]}>
            <Moji name="tools" size={26} />
          </View>
          <Text style={[styles.ledeText, { color: c.textSoft }]}>
            How Poppins saves chores, shows replies, and alerts this house.
            {tier === 'custom' ? ' Tuned — this household is Custom.' : ''}
          </Text>
        </Animated.View>

        <Group label="Saving chores" moji="bolt" tone={TONE.save} delay={60}>
          <Card tone={TONE.save}>
            <ToggleRow
              moji="bolt"
              tone={TONE.save}
              label="Save right away"
              sub="Skip the pause before chores and shops land. Undo still works."
              value={prefs.actImmediately}
              disabled={readOnly}
              onChange={(actImmediately) => patch({ actImmediately })}
            />
            <View style={[styles.segment, { borderTopColor: glassBorder(0.08) }]}>
              <SegmentedControl<PoppinsConfirmTime>
                label="Pause before save"
                subtitle="How long Poppins waits in silence before it commits."
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
                label="Undo stays"
                subtitle="How long you can reverse a saved chore or shop."
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

        <Group label="On screen" moji="sparkles" tone={TONE.show} delay={120}>
          <Card tone={TONE.show}>
            <ToggleRow
              moji="sparkles"
              tone={TONE.show}
              label="Show thinking"
              sub="A short beat while Poppins figures out the ask."
              value={prefs.showThinking}
              disabled={readOnly}
              onChange={(showThinking) => patch({ showThinking })}
            />
            <ToggleRow
              moji="book"
              tone={TONE.show}
              label="Write it down"
              sub="Show what Poppins did on screen. Questions always appear."
              value={prefs.writtenReplies}
              disabled={readOnly}
              divider
              onChange={(writtenReplies) => patch({ writtenReplies })}
            />
            <ToggleRow
              moji="bell"
              tone={TONE.show}
              label="Act from alerts"
              sub="Approve or change a chore suggestion right from the notification."
              value={prefs.notificationActions}
              disabled={readOnly}
              divider
              onChange={(notificationActions) => patch({ notificationActions })}
            />
          </Card>
        </Group>

        <Group label="House quiet" moji="moon" tone={TONE.home} delay={160}>
          <Card tone={TONE.home}>
            <ToggleRow
              moji="moon"
              tone={TONE.home}
              label="Quiet hours"
              sub={`Hold non-urgent banners ${quietStart}–${quietEnd}. Adjust the window in Settings → Alerts. Deadlines still fire.`}
              value={quietHours}
              disabled={readOnly}
              onChange={(value) => {
                if (readOnly) return;
                updateNotificationPrefs({ quietHoursEnabled: value });
              }}
            />
          </Card>
        </Group>

        <Group label="Who uses Poppins" moji="teddy" tone={TONE.sidekicks} delay={200}>
          <Card tone={TONE.sidekicks}>
            <View style={styles.noAiRow}>
              <Moji name="shield" size={16} />
              <Text style={[styles.noAiText, { color: c.textSoft }]}>
                Grown-ups only. Sidekicks never see Poppins — chores and rewards stay kid-safe.
              </Text>
            </View>
          </Card>
        </Group>

        {readOnly ? (
          <Text style={[styles.note, { color: c.textMuted }]}>
            Only an admin can change this page.
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
  noAiRow: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 14 },
  noAiText: { flex: 1, fontSize: 13, lineHeight: 18 },
  note: { fontSize: 12.5, lineHeight: 18, paddingHorizontal: 4 },
  reset: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  resetText: { fontSize: 13.5, fontWeight: '600' },
});

/** Sidekicks never get Poppins — any way in lands on Home. */
export default function PoppinsAdvancedScreen() {
  const { currentMember } = useOrbit();
  if (isSidekickRole(currentMember?.role)) {
    return <Redirect href={'/(tabs)' as never} />;
  }
  return <PoppinsAdvancedScreenInner />;
}
