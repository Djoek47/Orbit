/**
 * Sidekick permissions — WO14 §7.
 * One grocery switch (sidekickGroceryAdd). Calendar approval is dependent.
 */
import { StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdSnapshot, MemberCapabilities } from '@/types/orbit';

type Props = {
  household: Pick<HouseholdSnapshot, 'memberCapabilities' | 'sidekickGroceryAdd'>;
  accent: string;
  busy?: boolean;
  onCapabilities: (patch: Partial<MemberCapabilities>) => void;
  onGrocery: (enabled: boolean) => void;
};

type Row = {
  key: string;
  label: string;
  moji: MojiName;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  dependent?: boolean;
  disabled?: boolean;
};

export function SidekickPermissionsPanel({
  household,
  accent,
  busy,
  onCapabilities,
  onGrocery,
}: Props) {
  const { c, isDark, glassBorder } = useOrbitColors();
  const caps = resolveMemberCapabilities(household);
  const calendarOn = caps.allowCalendarCreate;

  const groups: { header: string; moji: MojiName; tone: string; rows: Row[] }[] = [
    {
      header: 'Rewards & money',
      moji: 'gift',
      tone: '#FF9F1C',
      rows: [
        {
          key: 'redeem',
          moji: 'gift',
          label: 'Spend points on rewards',
          sub: 'From your catalogue',
          value: caps.allowRewardRedeem,
          onChange: (v) => onCapabilities({ allowRewardRedeem: v }),
        },
        {
          key: 'suggest',
          moji: 'sparkles',
          label: 'Suggest a reward',
          value: caps.allowSpecialRewardRequest,
          onChange: (v) => onCapabilities({ allowSpecialRewardRequest: v }),
        },
        {
          key: 'allowance',
          moji: 'moneyBag',
          label: 'See their allowance',
          value: caps.allowAllowance,
          onChange: (v) => onCapabilities({ allowAllowance: v }),
        },
      ],
    },
    {
      header: 'Adding things',
      moji: 'clipboard',
      tone: '#4FA3FF',
      rows: [
        {
          key: 'grocery',
          moji: 'cart',
          label: 'Add to the grocery list',
          sub: 'Add only — no ticking off',
          value: household.sidekickGroceryAdd === true,
          onChange: onGrocery,
        },
        {
          key: 'calendar',
          moji: 'calendar',
          label: 'Add to the calendar',
          value: caps.allowCalendarCreate,
          onChange: (v) => onCapabilities({ allowCalendarCreate: v }),
        },
        {
          key: 'approve',
          moji: 'shield',
          label: 'A parent approves events',
          sub: '…after you approve',
          value: caps.requireSidekickEventApproval,
          onChange: (v) => onCapabilities({ requireSidekickEventApproval: v }),
          dependent: true,
          disabled: !calendarOn,
        },
      ],
    },
  ];

  const onCount = groups.reduce(
    (sum, group) => sum + group.rows.filter((row) => row.value && !row.disabled).length,
    0
  );
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <View style={styles.root}>
      {/* What's on, at a glance — the page used to be a wall of grey switches. */}
      <Animated.View
        entering={FadeInDown.duration(240)}
        style={[styles.hero, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }]}>
        <View style={[styles.heroMoji, { backgroundColor: `${accent}26` }]}>
          <Moji name="teddy" size={30} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.title, { color: c.text }]}>Sidekicks can…</Text>
          <Text style={[styles.purpose, { color: c.textMuted }]}>
            {onCount} of {total} on · applies to every kid, exceptions live on their card
          </Text>
        </View>
      </Animated.View>

      {groups.map((group, groupIndex) => (
        <Animated.View
          key={group.header}
          entering={FadeInDown.delay(60 + groupIndex * 50).duration(260)}
          style={{ gap: 8 }}>
          <View style={styles.groupHead}>
            <View style={[styles.groupMoji, { backgroundColor: `${group.tone}22` }]}>
              <Moji name={group.moji} size={16} />
            </View>
            <Text style={[styles.groupLabel, { color: group.tone }]}>{group.header}</Text>
          </View>
          <View
            style={[
              styles.card,
              { backgroundColor: glassFill(isDark), borderColor: `${group.tone}2E` },
            ]}>
            {group.rows.map((row, index) => (
              <View
                key={row.key}
                style={[
                  styles.row,
                  row.dependent && styles.dependent,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: glassBorder(0.08),
                  },
                  row.disabled && { opacity: 0.45 },
                ]}>
                <View
                  style={[
                    styles.rowMoji,
                    {
                      backgroundColor: row.value && !row.disabled ? `${group.tone}22` : glassBorder(0.08),
                    },
                  ]}>
                  <Moji name={row.moji} size={18} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.rowLabel, { color: c.text }]}>{row.label}</Text>
                  {row.sub ? (
                    <Text style={[styles.rowSub, { color: c.textMuted }]}>{row.sub}</Text>
                  ) : null}
                </View>
                <Switch
                  value={row.value}
                  disabled={busy || row.disabled}
                  onValueChange={row.onChange}
                  trackColor={{ false: glassBorder(0.14), true: group.tone }}
                />
              </View>
            ))}
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  hero: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
  },
  heroMoji: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  purpose: { fontSize: 13, lineHeight: 18 },
  groupHead: { alignItems: 'center', flexDirection: 'row', gap: 8, marginLeft: 2 },
  groupMoji: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  groupLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  rowMoji: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dependent: { paddingLeft: 26 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 13 },
});
