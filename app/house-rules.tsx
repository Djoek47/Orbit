/**
 * House Rules — digest + chapter screens (WO14 §1).
 * Chapters and grouping come only from data/house-rules.json.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChapterHero } from '@/components/orbit/house-rules/chapter-hero';
import { chapterLook, chapterStat, ruleMoji, visualPalette } from '@/components/orbit/house-rules/chapter-theme';
import { DeadlinePickerSheet } from '@/components/orbit/house-rules/deadline-picker';
import { RuleCard } from '@/components/orbit/house-rules/rule-card';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';
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
import type { RewardModel } from '@/lib/rewards/reward-model';
import { useMajordomoName } from '@/lib/ai/use-majordomo-name';
import { usePoppinsLive } from '@/lib/poppins/live-context';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

/** Where Change goes. Settings links carry the section so it opens on the right panel. */
const SETTING_ROUTES: Partial<Record<string, string>> = {
  recess: '/recess',
  rewardModel: '/settings?section=rewards',
  rewardFrequency: '/settings?section=rewards',
  rewardApproval: '/settings?section=rewards',
  allowanceSchedule: '/create-allowance',
  choreProof: '/settings?section=sidekick-perms',
  homeworkProofPerSidekick: '/household-members',
  taskFrequency: '/assign-task',
  invites: '/household-members',
};

export default function HouseRulesScreen() {
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const accent = c.primary;
  const params = useLocalSearchParams<{ chapter?: string; voice?: string }>();
  const {
    household,
    currentMember,
    permissions,
    queueDailyDeadline,
    setAllowanceRequestsEnabled,
    updateHouseholdRewardModel,
  } = useOrbit();
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

  const deadlineHm = view.dailyDeadline ?? doc.settings.dailyDeadline.default;
  const statCtx = {
    constants: doc.constants,
    voice,
    deadline: deadlineHm,
    use24h: view.use24h,
    modelLabel,
    proofCount,
    memberCount: household.members.length,
  };
  const themeForVisuals = {
    text: c.text,
    muted: c.textMuted,
    card: glass(0.05),
    border: glassBorder(0.1),
    deep: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,28,42,0.05)',
  };
  const chapterLabel = (chapter: (typeof groups)[number]['chapter']) =>
    voice === 'sidekick' ? chapter.sidekickLabel : chapter.title ?? chapter.adminLabel;

  if (activeGroup) {
    const chapter = activeGroup.chapter;
    const key = chapter.id ?? chapter.key;
    const look = chapterLook(key);
    const prev = chapterIndex > 0 ? groups[chapterIndex - 1] : null;
    const next = chapterIndex < groups.length - 1 ? groups[chapterIndex + 1] : null;
    const visualProps = {
      constants: doc.constants,
      palette: visualPalette(voice, look.color, themeForVisuals),
      voice,
      activeRewardModel: model,
      dailyDeadline: deadlineHm,
      use24h: view.use24h,
      onSelectRewardModel: canEdit
        ? (key: string) => updateHouseholdRewardModel(key as RewardModel)
        : undefined,
    };

    return (
      <SettingsModalChrome
        backLabel="House rules"
        onBack={() => router.replace('/house-rules' as never)}
        title={chapterLabel(chapter)}>
        <PersistentScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          indicatorColor={look.color}>
          <ChapterHero color={look.color} moji={look.moji} stat={chapterStat(key, statCtx)} />

          {activeGroup.rules.map((rule, index) => {
            const copy = voice === 'sidekick' ? rule.sidekick : rule.admin;
            const headline = interpolateHouseRulesCopy(copy.headline, doc.constants, view);
            const body = interpolateHouseRulesCopy(
              voice === 'sidekick' ? rule.sidekick.body : rule.admin.clause,
              doc.constants,
              view
            );
            const action =
              canEdit && rule.editable
                ? rule.settingKey === 'allowanceRequests'
                  ? {
                      kind: 'switch' as const,
                      value: household.allowanceRequestsEnabled !== false,
                      onChange: (v: boolean) => void setAllowanceRequestsEnabled(v),
                    }
                  : {
                      kind: 'button' as const,
                      label: rule.settingKey === 'deadlines' ? 'Time' : 'Change',
                      onPress: () => openSetting(rule.settingKey),
                    }
                : undefined;
            return (
              <RuleCard
                key={rule.id}
                index={index}
                color={look.color}
                moji={ruleMoji(rule.id, key)}
                headline={headline}
                body={body}
                visual={rule.visual}
                visualProps={visualProps}
                fixed={!rule.editable}
                action={action}
              />
            );
          })}

          <View style={styles.hintRow}>
            <MaterialIcons name="touch-app" size={14} color={c.textSubtle} />
            <Text style={[styles.fixedNote, { color: c.textSubtle }]}>Tap a rule for the details</Text>
            {voice === 'admin' ? (
              <>
                <MaterialIcons name="lock-outline" size={13} color={c.textSubtle} />
                <Text style={[styles.fixedNote, { color: c.textSubtle }]}>set by the app</Text>
              </>
            ) : null}
          </View>

          <View style={styles.chapterNav}>
            {[prev, next].map((g, i) =>
              g ? (
                <Pressable
                  key={i}
                  onPress={() =>
                    router.replace(`/house-rules?chapter=${g.chapter.id ?? g.chapter.key}` as never)
                  }
                  style={[
                    styles.navPill,
                    { backgroundColor: `${chapterLook(g.chapter.id ?? g.chapter.key).color}1F` },
                    i === 1 && { marginLeft: 'auto' },
                  ]}
                  accessibilityRole="button">
                  {i === 0 ? <MaterialIcons name="chevron-left" size={18} color={c.textMuted} /> : null}
                  <Moji name={chapterLook(g.chapter.id ?? g.chapter.key).moji} size={16} />
                  <Text style={[styles.navLabel, { color: c.text }]}>{chapterLabel(g.chapter)}</Text>
                  {i === 1 ? <MaterialIcons name="chevron-right" size={18} color={c.textMuted} /> : null}
                </Pressable>
              ) : (
                <View key={i} />
              )
            )}
          </View>
        </PersistentScrollView>
        <DeadlinePickerSheet
          visible={deadlineOpen}
          onClose={() => setDeadlineOpen(false)}
          doc={doc}
          current={deadlineHm}
          pending={household.dailyDeadlinePending}
          appliesOn={household.dailyDeadlineAppliesOn}
          use24h={view.use24h}
          onSelect={(time) => void queueDailyDeadline(time)}
        />
      </SettingsModalChrome>
    );
  }

  // Digest: three facts up top, then a colourful tile per chapter.
  const facts: { moji: MojiName; value: string; label: string; color: string }[] = [
    { moji: 'timer', value: deadlineLabel, label: 'deadline', color: chapterLook('deadlines').color },
    { moji: 'gift', value: modelLabel, label: 'scoring', color: chapterLook('rewards').color },
    allowanceWeekly
      ? {
          moji: 'moneyBag',
          value: household.allowanceRequestsEnabled !== false ? 'On' : 'Off',
          label: 'requests',
          color: chapterLook('earning').color,
        }
      : { moji: 'fire', value: streakOn ? 'On' : 'Off', label: 'streaks', color: chapterLook('streaks').color },
  ];

  return (
    <SettingsModalChrome backLabel="Settings" title={voice === 'sidekick' ? 'The rules' : 'House rules'}>
      <PersistentScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        indicatorColor={accent}>
        <View style={styles.factRow}>
          {facts.map((fact, i) => (
            <Animated.View
              key={fact.label}
              entering={FadeInDown.delay(i * 70).springify().damping(18)}
              style={[styles.fact, { backgroundColor: `${fact.color}1C`, borderColor: `${fact.color}44` }]}>
              <Moji name={fact.moji} size={22} />
              <Text style={[styles.factValue, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {fact.value}
              </Text>
              <Text style={[styles.factLabel, { color: fact.color }]}>{fact.label}</Text>
            </Animated.View>
          ))}
        </View>

        <View style={styles.grid}>
          {groups.map(({ chapter, rules }, index) => {
            const id = chapter.id ?? chapter.key;
            const look = chapterLook(id);
            const stat = chapterStat(id, statCtx);
            return (
              <Animated.View
                key={id}
                entering={FadeInDown.delay(180 + index * 60).springify().damping(18)}
                style={styles.tileWrap}>
                <Pressable
                  onPress={() => router.push(`/house-rules?chapter=${id}` as never)}
                  style={({ pressed }) => [
                    styles.tile,
                    {
                      backgroundColor: `${look.color}17`,
                      borderColor: `${look.color}40`,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${chapterLabel(chapter)}: ${stat.value} ${stat.caption}. ${rules.length} rules`}>
                  <View style={styles.tileTop}>
                    <View style={[styles.tileMoji, { backgroundColor: `${look.color}2E` }]}>
                      <Moji name={look.moji} size={26} />
                    </View>
                    <Text style={[styles.tileCount, { color: look.color }]}>{rules.length}</Text>
                  </View>
                  <Text style={[styles.tileTitle, { color: c.text }]} numberOfLines={1}>
                    {chapterLabel(chapter)}
                  </Text>
                  <Text style={[styles.tileStat, { color: c.textMuted }]} numberOfLines={1}>
                    <Text style={{ color: look.color, fontWeight: '800' }}>{stat.value}</Text> {stat.caption}
                  </Text>
                </Pressable>
              </Animated.View>
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
              <Moji name="teddy" size={18} />
              <Text style={[styles.readKidLabel, { color: kidVoice ? '#041018' : c.text }]}>
                {kidVoice ? 'Reading as a kid' : 'Read as a kid'}
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
        current={deadlineHm}
        pending={household.dailyDeadlinePending}
        appliesOn={household.dailyDeadlineAppliesOn}
        use24h={view.use24h}
        onSelect={(time) => void queueDailyDeadline(time)}
      />
    </SettingsModalChrome>
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
    flexDirection: 'row',
    gap: 8,
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
  fixedNote: { fontSize: 12, lineHeight: 16 },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4 },
  navLabel: { fontSize: 14, fontWeight: '700' },
  factRow: { flexDirection: 'row', gap: 10 },
  fact: { flex: 1, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, gap: 4 },
  factValue: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  factLabel: { fontSize: 12, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileWrap: { width: '48.5%' },
  tile: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 6, minHeight: 124 },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  tileMoji: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tileCount: { fontSize: 13, fontWeight: '900' },
  tileTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginTop: 4 },
  tileStat: { fontSize: 12.5, fontWeight: '600' },
  chapterNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },
  navPill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
  },
});
