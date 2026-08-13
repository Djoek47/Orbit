/**
 * House Rules — Final Revision D/E/F.
 * Adult: sectioned JSON manual. Kid: one-screen HOW IT WORKS card, no scroll.
 * Copy comes from data/house-rules.json. Custom rules never alter mechanics.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { space, typography } from '@/constants/orbit-theme';
import { VOCAB } from '@/constants/vocabulary';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import {
  CUSTOM_HOUSE_RULE_MAX_COUNT,
  CUSTOM_HOUSE_RULE_MAX_LEN,
} from '@/lib/rules/custom-house-rules';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { formatHouseRulesTime, interpolateHouseRulesCopy } from '@/lib/rules/interpolate';
import { KID_CARD_RULE_IDS } from '@/lib/rules/kid-card';
import type { RuleConstants } from '@/lib/rules/types';
import { visibleRules } from '@/lib/rules/visible-rules';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdSnapshot } from '@/types/orbit';

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

function currentSettingValue(
  settingKey: string,
  household: HouseholdSnapshot,
  constants: RuleConstants
): string | undefined {
  switch (settingKey) {
    case 'deadlines':
      return formatHouseRulesTime(constants.deadlines.daily);
    case 'rewardModel': {
      const model = household.rewardModel ?? 'full';
      const jsonKey = model === 'full' ? 'full_system' : model;
      return constants.rewardModels.find((row) => row.key === jsonKey)?.label;
    }
    default:
      return undefined;
  }
}

export default function HouseRulesScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const {
    household,
    currentMember,
    permissions,
    addCustomHouseRule,
    updateCustomHouseRule,
    removeCustomHouseRule,
  } = useOrbit();
  const isManager = Boolean(permissions.canManageHousehold);
  const kidOnly = !isManager;
  const [previewKid, setPreviewKid] = useState(false);
  const showKid = kidOnly || previewKid;
  const [draft, setDraft] = useState('');
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

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

  const custom = [...(household.customHouseRules ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const kidLines = useMemo(() => {
    const byId = new Map(groups.flatMap((g) => g.rules.map((r) => [r.id, r] as const)));
    return KID_CARD_RULE_IDS.flatMap((id) => {
      const rule = byId.get(id);
      if (!rule) return [];
      return [{ id, body: interpolateHouseRulesCopy(rule.kid.body, doc.constants) }];
    });
  }, [groups, doc.constants]);

  const handleAdd = () => {
    const result = addCustomHouseRule(draft);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setDraft('');
    setFormError('');
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const result = updateCustomHouseRule(editingId, editDraft);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setEditingId(null);
    setEditDraft('');
    setFormError('');
  };

  const handleCustomEdit = (id: string, body: string) => {
    Alert.alert('Our House Rules', body, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Edit',
        onPress: () => {
          setEditingId(id);
          setEditDraft(body);
          setFormError('');
        },
      },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeCustomHouseRule(id),
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Settings">
          <Text style={[typography.headline, { color: c.primary }]}>Settings</Text>
        </Pressable>
        {isManager ? (
          <Pressable onPress={() => setPreviewKid((v) => !v)}>
            <Text style={[typography.headline, { color: c.textMuted }]}>
              {previewKid ? 'Adult' : 'Kid'}
            </Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>
      <Text style={[typography.largeTitle, styles.title, { color: c.text }]}>{VOCAB.houseRules}</Text>

      {showKid ? (
        <View style={styles.kidCard} pointerEvents="box-none">
          {custom.length ? (
            <View style={styles.kidCustom}>
              <Text style={[typography.caption1, styles.kicker, { color: c.textMuted }]}>
                Our House Rules
              </Text>
              {custom.map((rule) => (
                <Text key={rule.id} style={[typography.body, { color: c.text, marginBottom: 8 }]}>
                  {rule.body}
                </Text>
              ))}
            </View>
          ) : null}
          <Text style={[typography.caption1, styles.kicker, { color: c.textMuted }]}>How it works</Text>
          {kidLines.map((line) => (
            <Text key={line.id} style={[typography.body, styles.kidLine, { color: c.text }]}>
              {line.body}
            </Text>
          ))}
        </View>
      ) : (
        <PersistentScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingHorizontal: space.lg }}>
          <View
            style={[
              styles.section,
              { borderColor: glassBorder(0.12), backgroundColor: glass(0.04) },
            ]}>
            <Text style={[typography.title3, { color: c.text }]}>Our House Rules</Text>
            {custom.map((rule) => (
              <View key={rule.id} style={styles.customRow}>
                {editingId === rule.id ? (
                  <View style={{ flex: 1, gap: 8 }}>
                    <TextInput
                      value={editDraft}
                      onChangeText={setEditDraft}
                      maxLength={CUSTOM_HOUSE_RULE_MAX_LEN}
                      style={[
                        styles.input,
                        { color: c.text, borderColor: glassBorder(0.14), backgroundColor: glass(0.06) },
                      ]}
                    />
                    <Pressable onPress={handleSaveEdit}>
                      <Text style={[typography.footnote, { color: c.primary }]}>Edit</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text style={[typography.body, { color: c.text, flex: 1 }]}>{rule.body}</Text>
                    {isManager ? (
                      <Pressable onPress={() => handleCustomEdit(rule.id, rule.body)}>
                        <Text style={[typography.footnote, { color: c.primary }]}>Edit</Text>
                      </Pressable>
                    ) : null}
                  </>
                )}
              </View>
            ))}
            {isManager && custom.length < CUSTOM_HOUSE_RULE_MAX_COUNT ? (
              <View style={{ marginTop: space.sm, gap: 8 }}>
                <TextInput
                  value={draft}
                  onChangeText={(v) => {
                    setDraft(v);
                    setFormError('');
                  }}
                  placeholder="Screens off at 8:30"
                  placeholderTextColor={c.textSubtle}
                  maxLength={CUSTOM_HOUSE_RULE_MAX_LEN}
                  style={[
                    styles.input,
                    { color: c.text, borderColor: glassBorder(0.14), backgroundColor: glass(0.06) },
                  ]}
                />
                {formError ? (
                  <Text style={[typography.footnote, { color: c.danger }]}>{formError}</Text>
                ) : null}
                <OrbitButton onPress={handleAdd} tone="secondary">
                  Edit
                </OrbitButton>
              </View>
            ) : null}
          </View>

          {groups.map((group) => (
            <View key={group.chapter.key} style={styles.chapter}>
              <Text style={[typography.title3, { color: c.text }]}>{group.chapter.adultLabel}</Text>
              {group.rules.map((rule) => {
                const clause = interpolateHouseRulesCopy(rule.adult.clause, doc.constants);
                const route = rule.editable && rule.settingKey ? SETTING_ROUTES[rule.settingKey] : undefined;
                const setting =
                  rule.settingKey && rule.editable
                    ? currentSettingValue(rule.settingKey, household, doc.constants)
                    : undefined;
                return (
                  <View
                    key={rule.id}
                    style={[
                      styles.rule,
                      { borderColor: glassBorder(0.1), backgroundColor: glass(0.03) },
                    ]}>
                    <Text style={[typography.caption1, { color: c.textMuted }]}>{rule.displayNumber}</Text>
                    <Text style={[typography.headline, { color: c.text }]}>{rule.adult.question}</Text>
                    <Text style={[typography.body, { color: c.textSoft, marginTop: 4 }]}>{clause}</Text>
                    {setting ? (
                      <Text style={[typography.footnote, { color: c.textMuted, marginTop: 6 }]}>{setting}</Text>
                    ) : null}
                    {route ? (
                      <Pressable onPress={() => router.push(route as never)} style={styles.editLink}>
                        <Text style={[typography.footnote, { color: c.primary }]}>Edit</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </PersistentScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  title: { paddingHorizontal: space.lg, marginTop: 8, marginBottom: 12 },
  scroll: { flex: 1 },
  section: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  customRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  chapter: { marginBottom: 24, gap: 10 },
  rule: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  editLink: { marginTop: 8, alignSelf: 'flex-start' },
  kidCard: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
  },
  kidCustom: { marginBottom: 16 },
  kicker: {
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  kidLine: { marginBottom: 12, lineHeight: 22 },
});
