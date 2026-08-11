/**
 * House Rules — 4 directions (Chapters / At a glance / Track / Ask Poppins)
 * × Adult/Kid voice. Layout from HTML; colors from ChoreMaxx tokens.
 * All rule copy from data/house-rules.json.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { AskPoppinsView } from '@/components/orbit/house-rules/ask-poppins-view';
import { AtAGlanceView } from '@/components/orbit/house-rules/at-a-glance-view';
import { ChaptersView } from '@/components/orbit/house-rules/chapters-view';
import { TrackView } from '@/components/orbit/house-rules/track-view';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { VOCAB } from '@/constants/vocabulary';
import { space, typography } from '@/constants/orbit-theme';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import {
  resolveHouseRulesPalette,
  type HouseRulesDirection,
  type HouseRulesVoice,
} from '@/lib/rules/house-rules-palette';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import { rulesByPhase, visibleRuleCount, visibleRules } from '@/lib/rules/visible-rules';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

function formatDailyDeadline(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}

const SETTING_ROUTES: Partial<Record<string, string>> = {
  recess: '/recess',
  rewardModel: '/settings',
};

const DIRECTIONS: { id: HouseRulesDirection; num: string; label: string }[] = [
  { id: 'chapters', num: '01', label: 'Chapters' },
  { id: 'glance', num: '02', label: 'At a glance' },
  { id: 'track', num: '03', label: 'The Track' },
  { id: 'ask', num: '04', label: 'Ask Poppins' },
];

export default function HouseRulesScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass } = useOrbitColors();
  const { household, currentMember, permissions } = useOrbit();
  const [voice, setVoice] = useState<HouseRulesVoice>(
    currentMember?.role === 'child' ? 'kid' : 'adult'
  );
  const [direction, setDirection] = useState<HouseRulesDirection>('chapters');

  const doc = useMemo(() => getHouseRulesDoc(), []);
  const palette = useMemo(
    () => resolveHouseRulesPalette(c, voice, direction),
    [c, voice, direction]
  );

  const helperCount = useMemo(
    () =>
      household.members.filter(
        (m) => m.status === 'active' && m.role !== 'guest' && !isSharedDeviceRole(m.role)
      ).length,
    [household.members]
  );

  const groups = useMemo(
    () =>
      visibleRules(doc, {
        rewardModel: household.rewardModel ?? 'full',
        helperCount,
        homeworkEnabled: household.homeworkEnabled !== false,
      }),
    [doc, household.homeworkEnabled, household.rewardModel, helperCount]
  );

  const stops = useMemo(() => rulesByPhase(groups, voice), [groups, voice]);
  const dailyDeadlineLabel = formatDailyDeadline(doc.constants.deadlines.daily);
  const tokens = useMemo(() => ({ dailyDeadline: dailyDeadlineLabel }), [dailyDeadlineLabel]);
  const ruleCount = visibleRuleCount(groups);
  const canFlipVoice = permissions.canManageHousehold || currentMember?.role !== 'child';

  const openSetting = (settingKey?: string) => {
    if (!settingKey || !permissions.canManageHousehold) return;
    const route = SETTING_ROUTES[settingKey];
    if (!route) return;
    router.push(route as never);
  };

  return (
    <View style={[styles.shell, { backgroundColor: palette.surface, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.subheadline, { color: palette.accent }]}>‹ Settings</Text>
        </Pressable>
        <Text style={[typography.title3, { color: palette.ink }]}>{VOCAB.houseRules}</Text>
        <View style={{ width: 64 }} />
      </View>

      <Text style={[typography.caption1, { color: palette.muted, textAlign: 'center', marginBottom: 8 }]}>
        {groups.length} chapters · {ruleCount} rules
      </Text>

      <View style={[styles.tabs, { backgroundColor: glass(0.06) }]}>
        {DIRECTIONS.map((d) => {
          const on = direction === d.id;
          return (
            <Pressable
              key={d.id}
              onPress={() => setDirection(d.id)}
              style={[styles.tab, on && { backgroundColor: `${palette.accent}28` }]}>
              <Text
                style={[
                  typography.caption2,
                  {
                    color: on ? palette.accent : palette.muted,
                    fontWeight: on ? '800' : '500',
                    textAlign: 'center',
                  },
                ]}>
                {d.num}
              </Text>
              <Text
                style={[
                  typography.caption2,
                  {
                    color: on ? palette.ink : palette.muted,
                    fontWeight: on ? '700' : '500',
                    textAlign: 'center',
                    fontSize: 10,
                  },
                ]}
                numberOfLines={1}>
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {canFlipVoice ? (
        <View style={[styles.toggle, { backgroundColor: glass(0.06) }]}>
          {(['adult', 'kid'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setVoice(v)}
              style={[styles.toggleBtn, voice === v && { backgroundColor: `${palette.accent}28` }]}>
              <Text
                style={[
                  typography.footnote,
                  {
                    color: voice === v ? palette.accent : palette.muted,
                    fontWeight: voice === v ? '700' : '500',
                  },
                ]}>
                {v === 'adult' ? 'Adult' : 'Kid'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <PersistentScrollView contentContainerStyle={styles.content}>
        {direction === 'chapters' ? (
          <ChaptersView
            groups={groups}
            voice={voice}
            palette={palette}
            constants={doc.constants}
            tokens={tokens}
            canEdit={Boolean(permissions.canManageHousehold)}
            onEdit={openSetting}
          />
        ) : null}
        {direction === 'glance' ? (
          <AtAGlanceView
            groups={groups}
            voice={voice}
            palette={palette}
            constants={doc.constants}
            tokens={tokens}
            canEdit={Boolean(permissions.canManageHousehold)}
            onEdit={openSetting}
          />
        ) : null}
        {direction === 'track' ? (
          <TrackView stops={stops} voice={voice} palette={palette} tokens={tokens} />
        ) : null}
        {direction === 'ask' ? (
          <AskPoppinsView groups={groups} voice={voice} palette={palette} tokens={tokens} />
        ) : null}

        {doc.footnotes?.[voice] ? (
          <Text style={[typography.caption2, { color: palette.muted, marginTop: space.md }]}>
            {doc.footnotes[voice]}
          </Text>
        ) : null}
      </PersistentScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: 8,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: space.md,
    borderRadius: 12,
    padding: 3,
    gap: 2,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  toggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 999,
    padding: 3,
    marginBottom: 8,
    gap: 2,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  content: {
    paddingHorizontal: space.md,
    paddingBottom: 48,
  },
});
