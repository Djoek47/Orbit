/**
 * House Rules — digest + chapter screens (WO14 §1).
 * Chapters and grouping come only from data/house-rules.json.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { DeadlinePickerSheet } from '@/components/orbit/house-rules/deadline-picker';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { SettingsModalChrome } from '@/components/orbit/settings/modal-chrome';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import {
  houseRulesHouseholdView,
  houseRulesVoiceForRole,
  isHouseRulesAdminRole,
} from '@/lib/rules/household-view';
import { formatHouseRulesTime, interpolateHouseRulesCopy } from '@/lib/rules/interpolate';
import type { ChapterKey } from '@/lib/rules/types';
import { visibleRules } from '@/lib/rules/visible-rules';
import { hasAllowanceModel, normalizeRewardModel } from '@/lib/rules/visibility';
import { useMajordomoName } from '@/lib/ai/use-majordomo-name';
import { usePoppinsLive } from '@/lib/poppins/live-context';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
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
  const { c, isDark, glassBorder } = useOrbitColors();
  const accent = c.primary;
  const params = useLocalSearchParams<{ chapter?: string; voice?: string }>();
  const { household, currentMember, permissions, queueDailyDeadline, setAllowanceRequestsEnabled } =
    useOrbit();
  const live = usePoppinsLive();
  const majordomoName = useMajordomoName();
  const doc = useMemo(() => getHouseRulesDoc(), []);
  const isAdminSession = isHouseRulesAdminRole(currentMember?.role) && permissions.canManageHousehold;
  const [kidVoice, setKidVoice] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);

  const voice = houseRulesVoiceForRole(
    currentMember?.role,
    kidVoice || params.voice === 'sidekick' ? 'sidekick' : 'admin',
    doc.modes
  );
  const view = useMemo(() => houseRulesHouseholdView(household), [household]);
  const groups = useMemo(() => visibleRules(doc, view), [doc, view]);
  const canEdit = isAdminSession && voice === 'admin';

  const openChapter = params.chapter?.trim() as ChapterKey | undefined;
  const chapterIndex = openChapter
    ? groups.findIndex((g) => (g.chapter.id ?? g.chapter.key) === openChapter)
    : -1;
  const activeGroup = chapterIndex >= 0 ? groups[chapterIndex] : null;

  const deadlineLabel = formatHouseRulesTime(
    view.dailyDeadline ?? doc.settings.dailyDeadline.default,
    view.use24h
  );
  const model = normalizeRewardModel(household.rewardModel ?? 'full');
  const modelLabel =
    doc.constants.rewardModels.find((m) => m.key === model)?.label ?? 'Everything';
  const proofCount = household.tasks.filter((t) => t.proofRequired).length;
  const streakOn = true;
  const allowanceWeekly = hasAllowanceModel(household.rewardModel);

  const summarySentence = `${deadlineLabel} deadline · ${modelLabel} scoring · ${
    household.allowanceRequestsEnabled !== false ? 'requests on' : 'requests off'
  }`;

  const openSetting = (settingKey?: string) => {
    if (!canEdit) return;
    if (settingKey === 'deadlines') {
      setDeadlineOpen(true);
      return;
    }
    if (settingKey === 'allowanceRequests') {
      if (!hasAllowanceModel(household.rewardModel)) return;
      void setAllowanceRequestsEnabled(!(household.allowanceRequestsEnabled !== false));
      return;
    }
    const route = SETTING_ROUTES[settingKey ?? ''] ?? '/settings';
    router.push(route as never);
  };

  if (activeGroup) {
    const chapter = activeGroup.chapter;
    const title = voice === 'sidekick' ? chapter.sidekickLabel : chapter.title ?? chapter.adminLabel;
    const prev = chapterIndex > 0 ? groups[chapterIndex - 1] : null;
    const next = chapterIndex < groups.length - 1 ? groups[chapterIndex + 1] : null;
    const fixedNote =
      voice === 'admin'
        ? 'Grey rules are fixed by how the app works.'
        : undefined;

    return (
      <SettingsModalChrome
        backLabel="House rules"
        onBack={() => router.replace('/house-rules' as never)}
        title={title}
        purpose={chapter.description}>
        <PersistentScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          indicatorColor={accent}>
          {activeGroup.rules.map((rule) => {
            const body =
              voice === 'sidekick'
                ? interpolateHouseRulesCopy(rule.sidekick.body, doc.constants, view)
                : interpolateHouseRulesCopy(rule.admin.clause, doc.constants, view);
            const fixed = !rule.editable;
            return (
              <View
                key={rule.id}
                style={[
                  styles.ruleCard,
                  {
                    backgroundColor: glassFill(isDark),
                    borderColor: glassBorder(0.1),
                    opacity: fixed ? 0.72 : 1,
                  },
                ]}>
                <View style={styles.ruleRow}>
                  <Text
                    style={[
                      styles.ruleBody,
                      { color: fixed ? c.textMuted : c.text, flex: 1 },
                    ]}>
                    <RuleSentence text={body} boldLive />
                  </Text>
                  {canEdit && rule.editable ? (
                    rule.settingKey === 'allowanceRequests' ? (
                      <Switch
                        value={household.allowanceRequestsEnabled !== false}
                        onValueChange={(v) => void setAllowanceRequestsEnabled(v)}
                        trackColor={{ false: glassBorder(0.14), true: accent }}
                        accessibilityLabel={rule.admin.headline}
                      />
                    ) : (
                      <Pressable
                        onPress={() => openSetting(rule.settingKey)}
                        style={[styles.changeBtn, { borderColor: `${accent}55` }]}
                        accessibilityRole="button">
                        <Text style={[styles.changeLabel, { color: accent }]}>
                          {rule.settingKey === 'deadlines' ? 'Change the time' : 'Change'}
                        </Text>
                      </Pressable>
                    )
                  ) : null}
                </View>
              </View>
            );
          })}
          {fixedNote ? (
            <Text style={[styles.fixedNote, { color: c.textSubtle }]}>{fixedNote}</Text>
          ) : null}
          <View style={styles.chapterNav}>
            <Pressable
              disabled={!prev}
              onPress={() =>
                prev &&
                router.replace(
                  `/house-rules?chapter=${prev.chapter.id ?? prev.chapter.key}` as never
                )
              }
              style={[styles.navPill, !prev && { opacity: 0.35 }]}>
              <MaterialIcons name="chevron-left" size={20} color={c.textMuted} />
              <Text style={{ color: c.textMuted, fontWeight: '600' }}>
                {prev
                  ? voice === 'sidekick'
                    ? prev.chapter.sidekickLabel
                    : prev.chapter.adminLabel
                  : 'Prev'}
              </Text>
            </Pressable>
            <Pressable
              disabled={!next}
              onPress={() =>
                next &&
                router.replace(
                  `/house-rules?chapter=${next.chapter.id ?? next.chapter.key}` as never
                )
              }
              style={[styles.navPill, !next && { opacity: 0.35 }]}>
              <Text style={{ color: c.textMuted, fontWeight: '600' }}>
                {next
                  ? voice === 'sidekick'
                    ? next.chapter.sidekickLabel
                    : next.chapter.adminLabel
                  : 'Next'}
              </Text>
              <MaterialIcons name="chevron-right" size={20} color={c.textMuted} />
            </Pressable>
          </View>
        </PersistentScrollView>
        <DeadlinePickerSheet
          visible={deadlineOpen}
          onClose={() => setDeadlineOpen(false)}
          doc={doc}
          current={view.dailyDeadline ?? doc.settings.dailyDeadline.default}
          pending={household.dailyDeadlinePending}
          appliesOn={household.dailyDeadlineAppliesOn}
          use24h={view.use24h}
          onSelect={(time) => void queueDailyDeadline(time)}
        />
      </SettingsModalChrome>
    );
  }

  // Digest
  return (
    <SettingsModalChrome
      backLabel="Settings"
      title={voice === 'sidekick' ? 'The rules' : 'House rules'}
      purpose={
        voice === 'sidekick'
          ? 'Everything you need to know.'
          : undefined
      }>
      <PersistentScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        indicatorColor={accent}>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
          ]}>
          <Text style={[styles.summaryText, { color: c.text }]}>{summarySentence}</Text>
          <View style={styles.chipRow}>
            {streakOn ? (
              <View style={[styles.chip, { backgroundColor: `${accent}22` }]}>
                <Text style={[styles.chipLabel, { color: accent }]}>Streaks on</Text>
              </View>
            ) : null}
            {allowanceWeekly ? (
              <View style={[styles.chip, { backgroundColor: `${accent}22` }]}>
                <Text style={[styles.chipLabel, { color: accent }]}>Allowance weekly</Text>
              </View>
            ) : null}
            <View style={[styles.chip, { backgroundColor: `${accent}22` }]}>
              <Text style={[styles.chipLabel, { color: accent }]}>
                {proofCount} need a photo
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.groupCard,
            { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
          ]}>
          {groups.map(({ chapter, rules }, index) => {
            const id = chapter.id ?? chapter.key;
            const label = voice === 'sidekick' ? chapter.sidekickLabel : chapter.title ?? chapter.adminLabel;
            const icon = (chapter.icon ?? 'menu-book') as keyof typeof MaterialIcons.glyphMap;
            return (
              <Pressable
                key={id}
                onPress={() => router.push(`/house-rules?chapter=${id}` as never)}
                style={[
                  styles.chapterRow,
                  index < groups.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: glassBorder(0.08),
                    marginLeft: 50,
                    paddingLeft: 0,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${label}, ${rules.length} rules`}>
                <View style={[styles.chapterIcon, { backgroundColor: `${accent}22` }]}>
                  <MaterialIcons name={icon} size={18} color={accent} />
                </View>
                <View style={styles.chapterBody}>
                  <Text style={[styles.chapterTitle, { color: c.text }]}>{label}</Text>
                  {chapter.description ? (
                    <Text style={[styles.chapterDesc, { color: c.textMuted }]} numberOfLines={1}>
                      {chapter.description}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.chapterCount, { color: c.textSubtle }]}>{rules.length}</Text>
                <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
              </Pressable>
            );
          })}
        </View>

        {isAdminSession && doc.modes.admin.mayViewSidekickVersion ? (
          <View style={styles.readKidRow}>
            <Pressable
              onPress={() => setKidVoice((v) => !v)}
              style={[
                styles.readKidBtn,
                {
                  backgroundColor: kidVoice ? accent : glassFill(isDark),
                  borderColor: kidVoice ? accent : glassBorder(0.1),
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Read as a kid">
              <Text style={[styles.readKidLabel, { color: kidVoice ? '#041018' : c.text }]}>
                Read as a kid
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void live?.startInPlace('house-rules')}
              style={[styles.micBtn, { borderColor: glassBorder(0.12), backgroundColor: glassFill(isDark) }]}
              accessibilityLabel={`Ask ${majordomoName}`}>
              <MaterialIcons name="mic" size={22} color={accent} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => void live?.startInPlace('house-rules')}
            style={[styles.askRow, { borderColor: glassBorder(0.1), backgroundColor: glassFill(isDark) }]}>
            <MaterialIcons name="mic" size={20} color={accent} />
            <Text style={{ color: c.text, fontWeight: '600' }}>Ask {majordomoName}</Text>
          </Pressable>
        )}
      </PersistentScrollView>
      <DeadlinePickerSheet
        visible={deadlineOpen}
        onClose={() => setDeadlineOpen(false)}
        doc={doc}
        current={view.dailyDeadline ?? doc.settings.dailyDeadline.default}
        pending={household.dailyDeadlinePending}
        appliesOn={household.dailyDeadlineAppliesOn}
        use24h={view.use24h}
        onSelect={(time) => void queueDailyDeadline(time)}
      />
    </SettingsModalChrome>
  );
}

/** Bold numbers / times inside a rule sentence for the chapter cards. */
function RuleSentence({ text, boldLive }: { text: string; boldLive?: boolean }) {
  const { c } = useOrbitColors();
  if (!boldLive) {
    return <>{text}</>;
  }
  const parts = text.split(/(\d{1,2}:\d{2}|\d+\s*(?:XP|%|days?|points?)|\b\d+\b)/gi);
  return (
    <>
      {parts.map((part, i) =>
        /\d/.test(part) ? (
          <Text key={i} style={{ fontWeight: '700', color: c.text }}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { gap: 16, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  summaryText: { fontSize: 16, fontWeight: '600', lineHeight: 22, letterSpacing: -0.2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipLabel: { fontSize: 13, fontWeight: '600' },
  groupCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chapterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chapterIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  chapterBody: { flex: 1, gap: 2, minWidth: 0 },
  chapterTitle: { fontSize: 16, fontWeight: '600' },
  chapterDesc: { fontSize: 13, lineHeight: 17 },
  chapterCount: { fontSize: 13, fontWeight: '500', marginRight: 2 },
  readKidRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  readKidBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  readKidLabel: { fontSize: 16, fontWeight: '600' },
  micBtn: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  askRow: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 48,
  },
  ruleCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  ruleRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  ruleBody: { fontSize: 15, lineHeight: 22 },
  changeBtn: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  changeLabel: { fontSize: 13, fontWeight: '600' },
  fixedNote: { fontSize: 12, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  chapterNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },
  navPill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 4,
  },
});
