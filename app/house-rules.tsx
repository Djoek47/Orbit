/**
 * House Rules — Direction 01 Chapters (commandment spine).
 * All rule copy comes from data/house-rules.json. Views hold chrome only.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { VOCAB } from '@/constants/vocabulary';
import { space, typography } from '@/constants/orbit-theme';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { validateCustomHouseRule, type CustomHouseRule } from '@/lib/rules/registry';
import { substituteTokens, visibleRuleCount, visibleRules } from '@/lib/rules/visible-rules';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
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

const SETTING_ROUTES: Record<string, string> = {
  deadlines: '/settings',
  recess: '/recess',
  rewardModel: '/settings',
  rewardFrequency: '/settings',
  rewardApproval: '/settings',
  allowanceSchedule: '/settings',
  choreProof: '/settings',
  homeworkProofPerChild: '/settings',
};

export default function HouseRulesScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const { household, currentMember, permissions } = useOrbit();
  const [voice, setVoice] = useState<'adult' | 'kid'>(
    currentMember?.role === 'child' ? 'kid' : 'adult'
  );
  const [custom, setCustom] = useState<CustomHouseRule[]>([]);
  const [draft, setDraft] = useState('');

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
        homeworkEnabled: true,
      }),
    [doc, household.rewardModel, helperCount]
  );

  const dailyDeadlineLabel = formatDailyDeadline(doc.constants.deadlines.daily);
  const ruleCount = visibleRuleCount(groups);

  const addCustom = () => {
    const result = validateCustomHouseRule(draft, custom.length);
    if (!result.ok) {
      Alert.alert(VOCAB.houseRules, result.message);
      return;
    }
    setCustom((prev) => [
      ...prev,
      { id: `custom_${Date.now()}`, body: result.body, sortOrder: prev.length },
    ]);
    setDraft('');
  };

  const openSetting = (settingKey?: string) => {
    if (!settingKey || !permissions.canManageHousehold) return;
    const route = SETTING_ROUTES[settingKey] ?? '/settings';
    router.push(route as never);
  };

  return (
    <View style={[styles.shell, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.subheadline, { color: c.accent }]}>‹ Settings</Text>
        </Pressable>
        <Text style={[typography.title3, { color: c.text }]}>{VOCAB.houseRules}</Text>
        <View style={{ width: 64 }} />
      </View>

      <Text style={[typography.caption1, { color: c.textMuted, textAlign: 'center', marginBottom: 8 }]}>
        {groups.length} chapters · {ruleCount} rules
      </Text>

      {permissions.canManageHousehold ? (
        <View style={[styles.toggle, { backgroundColor: glass(0.06) }]}>
          {(['adult', 'kid'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setVoice(v)}
              style={[styles.toggleBtn, voice === v && { backgroundColor: `${c.accent}28` }]}>
              <Text
                style={[
                  typography.footnote,
                  {
                    color: voice === v ? c.accent : c.textSubtle,
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
        {custom.length ? (
          <View style={styles.section}>
            <Text style={[typography.caption1, { color: c.textMuted }]}>Our {VOCAB.houseRules}</Text>
            {custom.map((r) => (
              <Text key={r.id} style={[typography.body, { color: c.text }]}>
                {r.body}
              </Text>
            ))}
          </View>
        ) : null}

        {groups.map(({ chapter, rules }) => (
          <View key={chapter.key} style={styles.chapterBlock}>
            <View style={styles.chapterHead}>
              <View style={[styles.spine, { backgroundColor: `${c.accent}33` }]}>
                <Text style={[styles.spineLabel, { color: c.accent }]}>
                  {voice === 'kid' ? chapter.kidLabel : chapter.adultLabel}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[typography.caption1, { color: c.textMuted }]}>
                  Chapter {chapter.order} · {rules.length} rules
                </Text>
                {rules.map((rule) => {
                  const kidHeadline = substituteTokens(rule.kid.headline, {
                    dailyDeadline: dailyDeadlineLabel,
                  }).replace('7:00 PM', dailyDeadlineLabel);
                  const kidBody = substituteTokens(rule.kid.body, {
                    dailyDeadline: dailyDeadlineLabel,
                  });
                  return (
                    <View
                      key={rule.id}
                      style={[
                        styles.ruleCard,
                        { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) },
                      ]}>
                      {voice === 'adult' ? (
                        <>
                          <View style={styles.ruleTop}>
                            <Text style={[typography.caption2, { color: c.accent }]}>
                              {rule.displayNumber}
                            </Text>
                            {rule.editable && permissions.canManageHousehold ? (
                              <Pressable onPress={() => openSetting(rule.settingKey)}>
                                <Text style={[typography.caption2, { color: c.accent }]}>Edit</Text>
                              </Pressable>
                            ) : null}
                          </View>
                          <Text style={[typography.headline, { color: c.text }]}>
                            {rule.adult.headline}
                          </Text>
                          <Text style={[typography.body, { color: c.textSoft }]}>
                            {rule.adult.clause}
                          </Text>
                          {rule.id === 'DEAD-03' ? (
                            <View style={styles.pills}>
                              {Object.entries(doc.constants.lateCredit).map(([full, late]) => (
                                <View
                                  key={full}
                                  style={[
                                    styles.pill,
                                    { borderColor: glassBorder(0.14), backgroundColor: glass(0.04) },
                                  ]}>
                                  <Text style={[typography.caption2, { color: c.text }]}>
                                    {full} → {late}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <Text style={[typography.headline, { color: c.text }]}>{kidHeadline}</Text>
                          <Text style={[typography.body, { color: c.textSoft }]}>{kidBody}</Text>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        ))}

        {voice === 'adult' && permissions.canManageHousehold ? (
          <View style={styles.section}>
            <Text style={[typography.caption1, { color: c.textMuted }]}>Add a house rule</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Screens off at 8:30"
              placeholderTextColor={c.textSubtle}
              maxLength={500}
              style={[
                styles.input,
                { color: c.text, borderColor: glassBorder(0.12), backgroundColor: glass(0.04) },
              ]}
            />
            <Pressable onPress={addCustom}>
              <Text style={[typography.subheadline, { color: c.accent, fontWeight: '700' }]}>
                Save rule
              </Text>
            </Pressable>
          </View>
        ) : null}

        {doc.footnotes?.adult && voice === 'adult' ? (
          <Text style={[typography.caption1, { color: c.textSubtle }]}>{doc.footnotes.adult}</Text>
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
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  toggle: {
    borderRadius: 12,
    flexDirection: 'row',
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    padding: 4,
  },
  toggleBtn: {
    borderRadius: 10,
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  content: {
    gap: space.lg,
    paddingBottom: 48,
    paddingHorizontal: space.lg,
  },
  section: { gap: 8 },
  chapterBlock: { gap: 8 },
  chapterHead: { flexDirection: 'row', gap: 12 },
  spine: {
    alignItems: 'center',
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 12,
    width: 28,
  },
  spineLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    // Vertical-ish label without native rotate on all platforms: stacked via narrow width.
    width: 12,
  },
  ruleCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  ruleTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
