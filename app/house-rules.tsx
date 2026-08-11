/**
 * House Rules — 4 directions × Adult/Kid.
 * Colors/layout from choremaxx-house-rules-full.html; typeface = Bricolage (AppText).
 * Admins see Adult (can preview Kid). Children / non-admins see Kid only.
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
import { space, typography } from '@/constants/orbit-theme';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import {
  resolveHouseRulesPalette,
  type HouseRulesDirection,
  type HouseRulesVoice,
} from '@/lib/rules/house-rules-palette';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import { rulesByPhase, visibleRuleCount, visibleRules } from '@/lib/rules/visible-rules';
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
  const { household, currentMember, permissions } = useOrbit();
  const isManager = Boolean(permissions.canManageHousehold);
  // Admins/owners → Adult (can preview Kid). Children + non-admin helpers → Kid only.
  const kidOnly = !isManager;
  const [voice, setVoice] = useState<HouseRulesVoice>(isManager ? 'adult' : 'kid');
  const [direction, setDirection] = useState<HouseRulesDirection>('chapters');

  const effectiveVoice: HouseRulesVoice = kidOnly ? 'kid' : voice;
  const palette = useMemo(
    () => resolveHouseRulesPalette(undefined, effectiveVoice, direction),
    [effectiveVoice, direction]
  );

  const doc = useMemo(() => getHouseRulesDoc(), []);

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

  const stops = useMemo(() => rulesByPhase(groups, effectiveVoice), [groups, effectiveVoice]);
  const dailyDeadlineLabel = formatDailyDeadline(doc.constants.deadlines.daily);
  const tokens = useMemo(() => ({ dailyDeadline: dailyDeadlineLabel }), [dailyDeadlineLabel]);
  const ruleCount = visibleRuleCount(groups);
  const canFlipVoice = !kidOnly;
  const canEdit = isManager && effectiveVoice === 'adult';

  const openSetting = (settingKey?: string) => {
    if (!canEdit) return;
    const route = SETTING_ROUTES[settingKey ?? ''];
    if (!route) return;
    router.push(route as never);
  };

  const leftNav =
    effectiveVoice === 'kid' ? (
      <Pressable onPress={() => router.back()}>
        <Text style={[typography.subheadline, { color: palette.nav, fontWeight: '600' }]}>‹ Back</Text>
      </Pressable>
    ) : (
      <Pressable onPress={() => router.back()}>
        <Text style={[typography.subheadline, { color: palette.nav }]}>‹ Settings</Text>
      </Pressable>
    );

  const rightNav =
    effectiveVoice === 'kid' ? (
      direction === 'ask' ? (
        <Pressable onPress={() => setDirection('chapters')}>
          <Text style={[typography.subheadline, { color: palette.nav, fontWeight: '600' }]}>Rules</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => setDirection('ask')}>
          <Text style={[typography.subheadline, { color: palette.nav, fontWeight: '600' }]}>
            Ask Poppins
          </Text>
        </Pressable>
      )
    ) : canEdit ? (
      <Pressable onPress={() => openSetting('rewardModel')}>
        <Text style={[typography.subheadline, { color: palette.nav }]}>Edit</Text>
      </Pressable>
    ) : (
      <View style={{ width: 48 }} />
    );

  return (
    <View style={[styles.shell, { backgroundColor: palette.surface, paddingTop: insets.top }]}>
      <View style={styles.header}>
        {leftNav}
        <View style={{ width: 48 }} />
        {rightNav}
      </View>

      {direction === 'chapters' && effectiveVoice === 'adult' ? (
        <Text
          style={[
            typography.caption1,
            { color: palette.muted, textAlign: 'center', marginBottom: 8, paddingHorizontal: 16 },
          ]}>
          {groups.length} chapters · {ruleCount} rules
        </Text>
      ) : null}

      <View style={[styles.tabs, { borderColor: `${palette.ink}22` }]}>
        {DIRECTIONS.map((d) => {
          const on = direction === d.id;
          return (
            <Pressable
              key={d.id}
              onPress={() => setDirection(d.id)}
              style={[
                styles.tab,
                {
                  backgroundColor: on ? palette.tabOnBg : 'transparent',
                  borderColor: on ? palette.tabOnBg : `${palette.muted}55`,
                },
              ]}>
              <Text
                style={[
                  styles.tabNum,
                  { color: on ? palette.tabOnInk : palette.muted },
                ]}>
                {d.num}
              </Text>
              <Text
                style={[
                  styles.tabLabel,
                  { color: on ? palette.tabOnInk : palette.muted },
                ]}
                numberOfLines={1}>
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {canFlipVoice ? (
        <View style={[styles.toggle, { backgroundColor: `${palette.ink}14` }]}>
          {(['adult', 'kid'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setVoice(v)}
              style={[
                styles.toggleBtn,
                voice === v && { backgroundColor: palette.modeOnBg },
              ]}>
              <Text
                style={[
                  typography.footnote,
                  {
                    color: voice === v ? '#fff' : palette.muted,
                    fontWeight: voice === v ? '700' : '600',
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
            voice={effectiveVoice}
            palette={palette}
            constants={doc.constants}
            tokens={tokens}
            canEdit={canEdit}
            onEdit={openSetting}
          />
        ) : null}
        {direction === 'glance' ? (
          <AtAGlanceView
            groups={groups}
            voice={effectiveVoice}
            palette={palette}
            constants={doc.constants}
            tokens={tokens}
            canEdit={canEdit}
            onEdit={openSetting}
          />
        ) : null}
        {direction === 'track' ? (
          <TrackView
            stops={stops}
            voice={effectiveVoice}
            palette={palette}
            tokens={tokens}
            constants={doc.constants}
          />
        ) : null}
        {direction === 'ask' ? (
          <AskPoppinsView
            groups={groups}
            voice={effectiveVoice}
            palette={palette}
            tokens={tokens}
          />
        ) : null}

        {doc.footnotes?.[effectiveVoice] ? (
          <Text style={[typography.caption2, { color: palette.foot, marginTop: space.md }]}>
            {doc.footnotes[effectiveVoice]}
          </Text>
        ) : null}
      </PersistentScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 4,
    paddingHorizontal: space.md,
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    marginHorizontal: space.md,
  },
  tab: {
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  tabNum: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
  toggle: {
    alignSelf: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
    padding: 4,
    width: 230,
  },
  toggleBtn: {
    borderRadius: 999,
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  content: {
    paddingBottom: 48,
    paddingHorizontal: space.md,
  },
});
