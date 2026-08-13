/**
 * House Rules — four HTML directions × Admin / Sidekick.
 * Copy from data/house-rules.json only. Chrome labels: House Rules, Admin, Sidekick,
 * Edit, Search the rules, Settings, plus the four direction names.
 */

import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { AskPoppinsView } from '@/components/orbit/house-rules/ask-poppins-view';
import { AtAGlanceView } from '@/components/orbit/house-rules/at-a-glance-view';
import { ChaptersView } from '@/components/orbit/house-rules/chapters-view';
import { TrackView } from '@/components/orbit/house-rules/track-view';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import {
  HR,
  resolveHouseRulesPalette,
  type HouseRulesDirection,
  type HouseRulesVoice,
} from '@/lib/rules/house-rules-palette';
import { rulesByPhase, visibleRules } from '@/lib/rules/visible-rules';
import { normalizeRewardModel } from '@/lib/rules/visibility';
import { useOrbit } from '@/store/orbit-store';

const SETTING_ROUTES: Partial<Record<string, string>> = {
  deadlines: '/settings',
  recess: '/recess',
  rewardModel: '/settings',
  rewardFrequency: '/(tabs)/rewards',
  rewardApproval: '/(tabs)/rewards',
  allowanceSchedule: '/create-allowance',
  choreProof: '/settings',
  homeworkProofPerChild: '/household-members',
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
  const sidekickOnly = !isManager;
  const [voice, setVoice] = useState<HouseRulesVoice>(isManager ? 'adult' : 'kid');
  const [direction, setDirection] = useState<HouseRulesDirection>('chapters');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    return () => sub.remove();
  }, []);

  const effectiveVoice: HouseRulesVoice = sidekickOnly ? 'kid' : voice;
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
  const homeworkEnabled =
    currentMember?.homeworkProofRequired !== false && household.homeworkEnabled !== false;

  const groups = useMemo(
    () =>
      visibleRules(doc, {
        rewardModel: household.rewardModel ?? 'full',
        helperCount,
        homeworkEnabled,
      }),
    [doc, household.rewardModel, helperCount, homeworkEnabled]
  );

  const stops = useMemo(() => rulesByPhase(doc, groups), [doc, groups]);
  const canFlipVoice = !sidekickOnly;
  const canEdit = isManager && effectiveVoice === 'adult';
  const activeRewardModel = normalizeRewardModel(household.rewardModel ?? 'full');
  const footnote =
    effectiveVoice === 'adult' && (direction === 'chapters' || direction === 'ask')
      ? doc.footnotes?.adult
      : undefined;

  const openSetting = (settingKey?: string) => {
    if (!canEdit) return;
    const route = SETTING_ROUTES[settingKey ?? ''] ?? '/settings';
    router.push(route as never);
  };

  const leftNav =
    effectiveVoice === 'kid' ? (
      <Pressable onPress={() => router.back()} accessibilityLabel="Settings">
        <Text style={[styles.nav, { color: palette.nav, fontWeight: '600' }]}>‹ Back</Text>
      </Pressable>
    ) : (
      <Pressable onPress={() => router.back()} accessibilityLabel="Settings">
        <Text style={[styles.nav, { color: palette.nav }]}>‹ Settings</Text>
      </Pressable>
    );

  const rightNav =
    effectiveVoice === 'kid' ? (
      direction === 'ask' ? (
        <Pressable onPress={() => setDirection('chapters')}>
          <Text style={[styles.nav, { color: palette.nav, fontWeight: '600' }]}>House Rules</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => setDirection('ask')}>
          <Text style={[styles.nav, { color: palette.nav, fontWeight: '600' }]}>Ask Poppins</Text>
        </Pressable>
      )
    ) : canEdit ? (
      <Pressable onPress={() => openSetting('rewardModel')}>
        <Text style={[styles.nav, { color: palette.nav }]}>Edit</Text>
      </Pressable>
    ) : (
      <View style={{ width: 48 }} />
    );

  return (
    <View style={[styles.shell, { backgroundColor: HR.explorer, paddingTop: insets.top }]}>
      <View style={styles.controls}>
        <View style={styles.tabs}>
          {DIRECTIONS.map((d) => {
            const on = direction === d.id;
            return (
              <Pressable
                key={d.id}
                onPress={() => setDirection(d.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[
                  styles.tab,
                  {
                    backgroundColor: on ? HR.cream : 'transparent',
                    borderColor: on ? HR.cream : HR.explorerTabBorder,
                  },
                ]}>
                <Text style={[styles.tabNum, { color: on ? HR.explorer : HR.creamDim }]}>{d.num}</Text>
                <Text style={[styles.tabLabel, { color: on ? HR.explorer : HR.creamDim }]} numberOfLines={1}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {canFlipVoice ? (
          <View style={styles.modeswitch}>
            {(['adult', 'kid'] as const).map((v) => {
              const on = voice === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => setVoice(v)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.modeBtn, on && { backgroundColor: HR.ember }]}>
                  <Text style={[styles.modeLabel, { color: on ? '#fff' : HR.creamDim }]}>
                    {v === 'adult' ? 'Admin' : 'Sidekick'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.screen,
          {
            backgroundColor: palette.surface,
            opacity: reduceMotion ? 1 : 1,
          },
        ]}>
        <View style={styles.header}>
          {leftNav}
          {rightNav}
        </View>
        <PersistentScrollView
          style={styles.scroll}
          indicatorColor={effectiveVoice === 'kid' && direction === 'chapters' ? HR.kidInk : HR.cream}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 44 },
          ]}>
          {direction === 'chapters' ? (
            <ChaptersView
              groups={groups}
              voice={effectiveVoice}
              palette={palette}
              constants={doc.constants}
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
              canEdit={canEdit}
              onEdit={openSetting}
              activeRewardModel={activeRewardModel}
            />
          ) : null}
          {direction === 'track' ? (
            <TrackView
              stops={stops}
              voice={effectiveVoice}
              palette={palette}
              constants={doc.constants}
            />
          ) : null}
          {direction === 'ask' ? (
            <AskPoppinsView
              groups={groups}
              voice={effectiveVoice}
              palette={palette}
              constants={doc.constants}
            />
          ) : null}
          {footnote ? <Text style={[styles.foot, { color: palette.foot }]}>{footnote}</Text> : null}
        </PersistentScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  controls: {
    backgroundColor: HR.explorer,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  tabs: { flexDirection: 'row', gap: 6 },
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
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
  modeswitch: {
    alignSelf: 'center',
    backgroundColor: HR.explorerModeBg,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    marginTop: 10,
    padding: 4,
    width: 230,
  },
  modeBtn: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    paddingVertical: 8,
  },
  modeLabel: { fontSize: 13, fontWeight: '600' },
  screen: { borderTopLeftRadius: 0, borderTopRightRadius: 0, flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 4,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  nav: { fontSize: 14 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  foot: { fontSize: 11.5, lineHeight: 18, marginTop: 8, paddingBottom: 12 },
});
