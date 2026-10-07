/**
 * Alerts → notification prefs — House Rules digest aesthetics.
 * Smart delivery sits in a hero card; channels are condensed below.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';
import {
  DEFAULT_QUIET_HOURS_END,
  DEFAULT_QUIET_HOURS_START,
  formatQuietHmDisplay,
  normalizeQuietHm,
  quietHoursChipLabel,
  quietHoursPickerValues,
} from '@/lib/notifications/quiet-hours';
import {
  SMART_DELIVERY_CHIPS,
  SMART_DELIVERY_HERO,
  channelGroups,
  quietHoursCopy,
  type NotifPrefKey,
} from '@/lib/notifications/smart-delivery-ui';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { PoppinsNotificationPrefs } from '@/types/orbit';

const SMART_TONE = '#8E7CFF';
const QUIET_TONE = '#7C9CFF';
const OS_TONE = '#FF9F1C';
const QUIET_HOURS = quietHoursPickerValues();
const HOUR_CHIP_W = 64;

type QuietEdit = 'start' | 'end' | null;

type Props = {
  prefs: PoppinsNotificationPrefs;
  osStatus: 'unknown' | 'granted' | 'denied';
  accent: string;
  majordomoName: string;
  onUpdate: (patch: Partial<PoppinsNotificationPrefs>) => void;
  onEnableOsBanners: () => void;
  onOpenOsSettings: () => void;
  /** Household clock — Quiet chips follow 12h/24h. */
  use24h?: boolean;
};

function isOn(prefs: PoppinsNotificationPrefs, key: NotifPrefKey): boolean {
  if (key === 'quietHoursEnabled' || key === 'smartDelivery') {
    return prefs[key] !== false;
  }
  if (key === 'quietHoursStart' || key === 'quietHoursEnd') return true;
  return Boolean(prefs[key]);
}

export function NotificationPrefsPanel({
  prefs,
  osStatus,
  accent,
  majordomoName,
  onUpdate,
  onEnableOsBanners,
  onOpenOsSettings,
  use24h = true,
}: Props) {
  const { c, glassBorder, isDark } = useOrbitColors();
  const smartOn = isOn(prefs, 'smartDelivery');
  const quietOn = isOn(prefs, 'quietHoursEnabled');
  const quietStart = normalizeQuietHm(prefs.quietHoursStart, DEFAULT_QUIET_HOURS_START);
  const quietEnd = normalizeQuietHm(prefs.quietHoursEnd, DEFAULT_QUIET_HOURS_END);
  const [quietEdit, setQuietEdit] = useState<QuietEdit>(null);
  const hourScrollRef = useRef<ScrollView>(null);
  const channelOn = channelGroups()
    .flatMap((g) => g.keys)
    .filter((key) => isOn(prefs, key)).length;

  const activeQuietHm = quietEdit === 'end' ? quietEnd : quietStart;

  useEffect(() => {
    if (!quietOn) setQuietEdit(null);
  }, [quietOn]);

  useEffect(() => {
    if (!quietEdit) return;
    const index = QUIET_HOURS.indexOf(activeQuietHm);
    if (index < 0) return;
    const timer = setTimeout(() => {
      hourScrollRef.current?.scrollTo({
        x: Math.max(0, index * (HOUR_CHIP_W + 8) - 40),
        animated: true,
      });
    }, 40);
    return () => clearTimeout(timer);
  }, [quietEdit, activeQuietHm]);

  const facts = useMemo(
    () => [
      {
        moji: (osStatus === 'granted' ? 'bell' : 'bell') as MojiName,
        value: osStatus === 'granted' ? 'On' : 'Off',
        label: 'banners',
        color: OS_TONE,
      },
      {
        moji: 'sparkles' as MojiName,
        value: smartOn ? 'Smart' : 'Manual',
        label: 'delivery',
        color: SMART_TONE,
      },
      {
        moji: 'moon' as MojiName,
        value: quietOn ? quietHoursChipLabel(quietStart, quietEnd, use24h) : 'Off',
        label: 'quiet',
        color: QUIET_TONE,
      },
    ],
    [osStatus, smartOn, quietOn, quietStart, quietEnd, use24h]
  );

  return (
    <View style={styles.root}>
      <View style={styles.factRow}>
        {facts.map((fact, i) => (
          <Animated.View
            key={fact.label}
            entering={FadeInDown.delay(i * 45).duration(240)}
            style={[styles.fact, { backgroundColor: `${fact.color}1C`, borderColor: `${fact.color}44` }]}>
            <Moji name={fact.moji} size={20} />
            <Text style={[styles.factValue, { color: c.text }]} numberOfLines={1}>
              {fact.value}
            </Text>
            <Text style={[styles.factLabel, { color: fact.color }]}>{fact.label}</Text>
          </Animated.View>
        ))}
      </View>

      <Animated.View entering={FadeInDown.delay(80).duration(280)}>
        <Pressable
          onPress={osStatus === 'granted' ? onOpenOsSettings : onEnableOsBanners}
          style={[styles.osCard, { borderColor: `${OS_TONE}55`, backgroundColor: `${OS_TONE}14` }]}
          accessibilityRole="button"
          accessibilityLabel="iPhone notification settings">
          <View style={[styles.osIcon, { backgroundColor: `${OS_TONE}28` }]}>
            <MaterialIcons
              name={osStatus === 'granted' ? 'notifications-active' : 'notifications-off'}
              size={20}
              color={OS_TONE}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={[styles.osTitle, { color: c.text }]}>iPhone notifications</Text>
            <Text style={[styles.osSub, { color: c.textMuted }]}>
              {osStatus === 'granted'
                ? 'Banners and lock screen are on for ChoreMaxx.'
                : 'Turn banners on so alerts aren’t silent.'}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={OS_TONE} />
        </Pressable>
      </Animated.View>

      {/* Smart Delivery hero — distinct from individual channel toggles */}
      <Animated.View entering={FadeInDown.delay(120).duration(300)} style={styles.smartWrap}>
        <LinearGradient
          colors={
            smartOn
              ? [`${SMART_TONE}55`, `${SMART_TONE}18`, `${accent}12`]
              : [`${SMART_TONE}22`, `${SMART_TONE}0A`]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.smartCard, { borderColor: smartOn ? `${SMART_TONE}99` : `${SMART_TONE}44` }]}>
          <View style={styles.smartTop}>
            <View style={[styles.smartMoji, { backgroundColor: `${SMART_TONE}33` }]}>
              <Moji name="sparkles" size={28} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text style={[styles.smartEyebrow, { color: SMART_TONE }]}>
                {SMART_DELIVERY_HERO.eyebrow}
              </Text>
              <Text style={[styles.smartTitle, { color: c.text }]}>{SMART_DELIVERY_HERO.title}</Text>
            </View>
            <Switch
              value={smartOn}
              onValueChange={(value) => {
                // Smart is a mode: turning it on keeps Tasks + Quiet ready so digests work.
                if (value) {
                  onUpdate({
                    smartDelivery: true,
                    tasks: true,
                    quietHoursEnabled: true,
                  });
                  return;
                }
                onUpdate({ smartDelivery: false });
              }}
              trackColor={{ false: glassBorder(0.14), true: SMART_TONE }}
              thumbColor="#fff"
              accessibilityLabel="Smart delivery"
            />
          </View>
          <Text style={[styles.smartBody, { color: c.textSoft }]}>
            {smartOn ? SMART_DELIVERY_HERO.bodyOn : SMART_DELIVERY_HERO.bodyOff}
          </Text>
          <View style={styles.chipRow}>
            {SMART_DELIVERY_CHIPS.map((chip) => (
              <View
                key={chip.label}
                style={[
                  styles.chip,
                  {
                    backgroundColor: smartOn ? `${chip.color}28` : glassFill(isDark),
                    borderColor: smartOn ? `${chip.color}66` : glassBorder(0.1),
                    opacity: smartOn ? 1 : 0.55,
                  },
                ]}>
                <Moji name={chip.moji} size={14} />
                <Text style={[styles.chipText, { color: smartOn ? chip.color : c.textMuted }]}>
                  {chip.label}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[styles.smartFoot, { color: c.textSubtle }]}>
            {smartOn
              ? `${majordomoName} keeps details in Activity — not a wall of banners.`
              : 'Turn on for a calmer day. Individual channels below still apply.'}
          </Text>
        </LinearGradient>
      </Animated.View>

      {/* Quiet hours — toggle + premium adjustable window */}
      <Animated.View entering={FadeInDown.delay(160).duration(260)}>
        <LinearGradient
          colors={
            quietOn
              ? [`${QUIET_TONE}40`, `${QUIET_TONE}14`, `${SMART_TONE}10`]
              : [`${QUIET_TONE}18`, `${QUIET_TONE}08`]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.quietCard,
            { borderColor: quietOn ? `${QUIET_TONE}88` : `${QUIET_TONE}33` },
          ]}>
          <View style={styles.quietTop}>
            <View style={[styles.quietIcon, { backgroundColor: `${QUIET_TONE}28` }]}>
              <Moji name="moon" size={20} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[styles.rowTitle, { color: c.text }]}>Quiet hours</Text>
              <Text style={[styles.rowSub, { color: c.textMuted }]}>
                {quietHoursCopy(quietStart, quietEnd, use24h)}
              </Text>
            </View>
            <Switch
              value={quietOn}
              onValueChange={(value) => {
                if (!value) setQuietEdit(null);
                onUpdate({ quietHoursEnabled: value });
              }}
              trackColor={{ false: glassBorder(0.14), true: QUIET_TONE }}
              thumbColor="#fff"
              accessibilityLabel="Quiet hours"
            />
          </View>

          {quietOn ? (
            <View style={styles.quietSchedule}>
              <View style={styles.quietEnds}>
                <QuietBoundChip
                  label="Starts"
                  value={formatQuietHmDisplay(quietStart, use24h)}
                  selected={quietEdit === 'start'}
                  tone={QUIET_TONE}
                  textColor={c.text}
                  mutedColor={c.textMuted}
                  onPress={() => setQuietEdit((cur) => (cur === 'start' ? null : 'start'))}
                />
                <View style={[styles.quietArrow, { backgroundColor: `${QUIET_TONE}22` }]}>
                  <MaterialIcons name="arrow-forward" size={14} color={QUIET_TONE} />
                </View>
                <QuietBoundChip
                  label="Ends"
                  value={formatQuietHmDisplay(quietEnd, use24h)}
                  selected={quietEdit === 'end'}
                  tone={QUIET_TONE}
                  textColor={c.text}
                  mutedColor={c.textMuted}
                  onPress={() => setQuietEdit((cur) => (cur === 'end' ? null : 'end'))}
                />
              </View>

              {quietEdit ? (
                <View style={styles.quietPicker}>
                  <Text style={[styles.quietPickerLabel, { color: QUIET_TONE }]}>
                    {quietEdit === 'start' ? 'Start time' : 'End time'}
                  </Text>
                  <ScrollView
                    ref={hourScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.hourRow}>
                    {QUIET_HOURS.map((hm) => {
                      const on = hm === activeQuietHm;
                      return (
                        <Pressable
                          key={hm}
                          onPress={() => {
                            if (quietEdit === 'start') {
                              onUpdate({ quietHoursStart: hm });
                            } else {
                              onUpdate({ quietHoursEnd: hm });
                            }
                          }}
                          style={[
                            styles.hourChip,
                            {
                              width: HOUR_CHIP_W,
                              backgroundColor: on ? `${QUIET_TONE}33` : glassFill(isDark),
                              borderColor: on ? `${QUIET_TONE}99` : glassBorder(0.1),
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={`Quiet ${quietEdit} ${formatQuietHmDisplay(hm, use24h)}`}>
                          <Text
                            style={[
                              styles.hourChipText,
                              { color: on ? c.text : c.textMuted },
                            ]}>
                            {formatQuietHmDisplay(hm, use24h)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <Text style={[styles.quietHint, { color: c.textSubtle }]}>
                    Tap Starts or Ends again to close. Window can wrap past midnight.
                  </Text>
                </View>
              ) : (
                <Text style={[styles.quietHint, { color: c.textSubtle }]}>
                  Tap Starts or Ends to set the window.
                </Text>
              )}
            </View>
          ) : null}
        </LinearGradient>
      </Animated.View>

      <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
        Channels · {channelOn} on
        {smartOn ? ' · Smart shapes how tasks arrive' : ''}
      </Text>

      {channelGroups().map((group, gi) => (
        <Animated.View
          key={group.id}
          entering={FadeInDown.delay(190 + gi * 40).duration(260)}
          style={[
            styles.groupCard,
            { backgroundColor: glassFill(isDark), borderColor: `${group.color}33` },
          ]}>
          <View style={styles.groupHead}>
            <View style={[styles.groupDot, { backgroundColor: group.color }]} />
            <Text style={[styles.groupTitle, { color: group.color }]}>{group.title}</Text>
          </View>
          {group.keys.map((key, index) => {
            const meta = group.meta[key];
            return (
              <View
                key={key}
                style={[
                  styles.channelRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: glassBorder(0.08),
                  },
                ]}>
                <Moji emoji={meta.emoji} size={22} />
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <Text style={[styles.rowTitle, { color: c.text }]}>{meta.label}</Text>
                  <Text style={[styles.rowSub, { color: c.textMuted }]} numberOfLines={2}>
                    {meta.sub}
                  </Text>
                </View>
                <Switch
                  value={isOn(prefs, key)}
                  onValueChange={(value) => onUpdate({ [key]: value })}
                  trackColor={{ false: glassBorder(0.12), true: '#38BDF8' }}
                  thumbColor="#fff"
                  accessibilityLabel={meta.label}
                />
              </View>
            );
          })}
        </Animated.View>
      ))}

      <Pressable
        onPress={() => router.push('/notifications' as never)}
        style={({ pressed }) => [
          styles.inboxLink,
          { borderColor: `${accent}44`, backgroundColor: `${accent}14`, opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open household inbox">
        <Moji name="bell" size={18} />
        <Text style={[styles.inboxLinkText, { color: accent }]}>Open household inbox</Text>
        <MaterialIcons name="chevron-right" size={18} color={accent} />
      </Pressable>
    </View>
  );
}

function QuietBoundChip({
  label,
  value,
  selected,
  tone,
  textColor,
  mutedColor,
  onPress,
}: {
  label: string;
  value: string;
  selected: boolean;
  tone: string;
  textColor: string;
  mutedColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.boundChip,
        {
          backgroundColor: selected ? `${tone}2E` : `${tone}14`,
          borderColor: selected ? `${tone}AA` : `${tone}44`,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} ${value}`}>
      <Text style={[styles.boundLabel, { color: tone }]}>{label}</Text>
      <Text style={[styles.boundValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.boundHint, { color: mutedColor }]}>
        {selected ? 'Scroll hours' : 'Tap to edit'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  factRow: { flexDirection: 'row', gap: 8 },
  fact: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  factValue: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  factLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  osCard: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  osIcon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  osTitle: { fontSize: 15, fontWeight: '800' },
  osSub: { fontSize: 12, lineHeight: 16 },
  smartWrap: { marginTop: 2 },
  smartCard: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1.5,
    gap: 10,
    overflow: 'hidden',
    padding: 14,
  },
  smartTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  smartMoji: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  smartEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  smartTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  smartBody: { fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chipText: { fontSize: 11, fontWeight: '800' },
  smartFoot: { fontSize: 11.5, fontWeight: '600', lineHeight: 15 },
  quietCard: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 12,
    overflow: 'hidden',
    padding: 12,
  },
  quietTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  quietIcon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  quietSchedule: { gap: 10 },
  quietEnds: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  quietArrow: {
    alignItems: 'center',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  boundChip: {
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  boundLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  boundValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  boundHint: { fontSize: 10.5, fontWeight: '600' },
  quietPicker: { gap: 8 },
  quietPickerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  hourRow: { gap: 8, paddingRight: 8 },
  hourChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  hourChipText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  quietHint: { fontSize: 11, fontWeight: '600', lineHeight: 15 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginLeft: 2,
    marginTop: 4,
  },
  groupCard: {
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  groupHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  groupDot: { borderRadius: 3, height: 6, width: 6 },
  groupTitle: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  channelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 9,
  },
  rowTitle: { fontSize: 14.5, fontWeight: '800' },
  rowSub: { fontSize: 11.5, lineHeight: 15 },
  inboxLink: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    paddingVertical: 12,
  },
  inboxLinkText: { flex: 1, fontSize: 14, fontWeight: '800' },
});
