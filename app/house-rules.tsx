/**
 * House Rules — At a glance only. Copy from data/house-rules.json.
 * Chrome: House Rules, Admin, Sidekick, Edit, Settings, Ask Poppins.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { AtAGlanceView } from '@/components/orbit/house-rules/at-a-glance-view';
import { DeadlinePickerSheet } from '@/components/orbit/house-rules/deadline-picker';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import {
  houseRulesHouseholdView,
  houseRulesVoiceForRole,
  isHouseRulesAdminRole,
} from '@/lib/rules/household-view';
import { HR, resolveHouseRulesPalette, type HouseRulesVoice } from '@/lib/rules/house-rules-palette';
import { interpolateHouseRulesCopy } from '@/lib/rules/interpolate';
import { visibleRules } from '@/lib/rules/visible-rules';
import { hasAllowanceModel, normalizeRewardModel } from '@/lib/rules/visibility';
import { useOrbit } from '@/store/orbit-store';

const SETTING_ROUTES: Partial<Record<string, string>> = {
  recess: '/recess',
  rewardModel: '/settings',
  rewardFrequency: '/(tabs)/rewards',
  rewardApproval: '/(tabs)/rewards',
  allowanceSchedule: '/create-allowance',
  choreProof: '/settings',
  homeworkProofPerSidekick: '/household-members',
  taskFrequency: '/assign-task',
  invites: '/household-members',
};

export default function HouseRulesScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ voice?: string; mode?: string }>();
  const { household, currentMember, permissions, queueDailyDeadline, setAllowanceRequestsEnabled } =
    useOrbit();
  const doc = useMemo(() => getHouseRulesDoc(), []);
  const isAdminSession = isHouseRulesAdminRole(currentMember?.role) && permissions.canManageHousehold;
  const [adminPreview, setAdminPreview] = useState<HouseRulesVoice>(doc.modes.admin.defaultVersion);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [allowanceSheet, setAllowanceSheet] = useState(false);

  useEffect(() => {
    void params;
  }, [params]);

  const voice: HouseRulesVoice = houseRulesVoiceForRole(
    currentMember?.role,
    isAdminSession ? adminPreview : doc.modes.sidekick.defaultVersion,
    doc.modes
  );
  const palette = useMemo(() => resolveHouseRulesPalette(voice), [voice]);
  const view = useMemo(() => houseRulesHouseholdView(household), [household]);
  const groups = useMemo(() => visibleRules(doc, view), [doc, view]);
  const canFlipVoice = isAdminSession && doc.modes.admin.switcherVisible && doc.modes.admin.mayViewSidekickVersion;
  const canEdit = isAdminSession && voice === 'admin';
  const activeRewardModel = normalizeRewardModel(household.rewardModel ?? 'full');
  const footnote =
    voice === 'admin' && doc.footnotes?.admin
      ? interpolateHouseRulesCopy(doc.footnotes.admin, doc.constants, view)
      : undefined;
  const showAllowanceToggle = canEdit && hasAllowanceModel(household.rewardModel);

  const openSetting = (settingKey?: string) => {
    if (!canEdit) return;
    if (settingKey === 'deadlines') {
      setDeadlineOpen(true);
      return;
    }
    if (settingKey === 'allowanceRequests') {
      if (!hasAllowanceModel(household.rewardModel)) return;
      setAllowanceSheet(true);
      return;
    }
    const route = SETTING_ROUTES[settingKey ?? ''] ?? '/settings';
    router.push(route as never);
  };

  const leftNav = (
    <Pressable onPress={() => router.back()} accessibilityLabel="Settings">
      <Text style={[styles.nav, { color: palette.nav, fontWeight: voice === 'sidekick' ? '600' : '400' }]}>
        {voice === 'sidekick' ? '‹ Back' : '‹ Settings'}
      </Text>
    </Pressable>
  );

  const rightNav =
    voice === 'sidekick' ? (
      <Pressable onPress={() => router.push('/(tabs)/poppins' as never)} accessibilityLabel="Ask Poppins">
        <Text style={[styles.nav, { color: palette.nav, fontWeight: '600' }]}>Ask Poppins</Text>
      </Pressable>
    ) : canEdit ? (
      <Pressable onPress={() => router.push('/settings' as never)} accessibilityLabel="Edit">
        <Text style={[styles.nav, { color: palette.nav }]}>Edit</Text>
      </Pressable>
    ) : (
      <View style={{ width: 48 }} />
    );

  return (
    <View style={[styles.shell, { backgroundColor: palette.surface, paddingTop: insets.top }]}>
      <View style={styles.header}>
        {leftNav}
        {rightNav}
      </View>
      <PersistentScrollView
        style={styles.scroll}
        indicatorColor={voice === 'sidekick' ? HR.skMango : HR.cream}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 44 }]}>
        <AtAGlanceView
          groups={groups}
          voice={voice}
          palette={palette}
          constants={doc.constants}
          household={view}
          canEdit={canEdit}
          onEdit={openSetting}
          activeRewardModel={activeRewardModel}
          switcher={
            canFlipVoice ? (
              <View style={styles.seg}>
                {(['admin', 'sidekick'] as const).map((v) => {
                  const on = adminPreview === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setAdminPreview(v)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[styles.segBtn, on && { backgroundColor: HR.navyCard }]}>
                      <Text style={[styles.segLabel, { color: on ? '#fff' : '#7E8DA6' }]}>
                        {v === 'admin' ? 'Admin' : 'Sidekick'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null
          }
        />
        {footnote ? <Text style={[styles.foot, { color: palette.foot }]}>{footnote}</Text> : null}
      </PersistentScrollView>

      <DeadlinePickerSheet
        visible={deadlineOpen}
        doc={doc}
        current={view.dailyDeadline ?? doc.settings.dailyDeadline.default}
        pending={household.dailyDeadlinePending}
        appliesOn={household.dailyDeadlineAppliesOn}
        use24h={view.use24h}
        onClose={() => setDeadlineOpen(false)}
        onSelect={(hhmm) => {
          queueDailyDeadline(hhmm);
        }}
      />

      {allowanceSheet && showAllowanceToggle ? (
        <View style={styles.sheetMask}>
          <View style={styles.allowSheet}>
            <Text style={styles.allowTitle}>{doc.settings.allowanceRequests.label}</Text>
            <Text style={styles.allowHelp}>{doc.settings.allowanceRequests.help}</Text>
            <View style={styles.allowRow}>
              <Text style={styles.allowOn}>
                {household.allowanceRequestsEnabled !== false ? 'On' : 'Off'}
              </Text>
              <Switch
                value={household.allowanceRequestsEnabled !== false}
                onValueChange={(value) => setAllowanceRequestsEnabled(value)}
                trackColor={{ false: '#2A3A57', true: HR.amber }}
                thumbColor="#fff"
              />
            </View>
            <Pressable onPress={() => setAllowanceSheet(false)} style={styles.allowDone}>
              <Text style={styles.allowDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
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
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  nav: { fontSize: 14 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  seg: {
    backgroundColor: HR.navyDeep,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
    padding: 4,
  },
  segBtn: { alignItems: 'center', borderRadius: 9, flex: 1, paddingVertical: 9 },
  segLabel: { fontSize: 13, fontWeight: '600' },
  foot: { fontSize: 11.5, lineHeight: 18, marginTop: 8, paddingBottom: 12 },
  sheetMask: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  allowSheet: {
    backgroundColor: HR.navyCard,
    borderRadius: 16,
    padding: 18,
    width: '100%',
  },
  allowTitle: { color: '#E7EDF6', fontSize: 17, fontWeight: '700' },
  allowHelp: { color: '#8DA0BC', fontSize: 13, lineHeight: 18, marginTop: 8 },
  allowRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  allowOn: { color: '#E7EDF6', fontSize: 15, fontWeight: '600' },
  allowDone: { alignSelf: 'flex-end', marginTop: 16 },
  allowDoneText: { color: HR.amber, fontSize: 16, fontWeight: '600' },
});
