/**
 * Sidekick permissions — WO14 §7.
 * One grocery switch (sidekickGroceryAdd). Calendar approval is dependent.
 */
import { StyleSheet, Switch, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdSnapshot, MemberCapabilities } from '@/types/orbit';

type Props = {
  household: Pick<HouseholdSnapshot, 'memberCapabilities' | 'sidekickGroceryAdd' | 'sidekickPoppinsAi'>;
  accent: string;
  busy?: boolean;
  onCapabilities: (patch: Partial<MemberCapabilities>) => void;
  onGrocery: (enabled: boolean) => void;
  onPoppinsAi: (enabled: boolean) => void;
};

type Row = {
  key: string;
  label: string;
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
  onPoppinsAi,
}: Props) {
  const { c, isDark, glassBorder } = useOrbitColors();
  const caps = resolveMemberCapabilities(household);
  const calendarOn = caps.allowCalendarCreate;

  const groups: { header: string; rows: Row[] }[] = [
    {
      header: 'REWARDS & MONEY',
      rows: [
        {
          key: 'redeem',
          label: 'Spend points on rewards',
          sub: 'From your catalogue',
          value: caps.allowRewardRedeem,
          onChange: (v) => onCapabilities({ allowRewardRedeem: v }),
        },
        {
          key: 'suggest',
          label: 'Suggest a reward',
          value: caps.allowSpecialRewardRequest,
          onChange: (v) => onCapabilities({ allowSpecialRewardRequest: v }),
        },
        {
          key: 'allowance',
          label: 'See their allowance',
          value: caps.allowAllowance,
          onChange: (v) => onCapabilities({ allowAllowance: v }),
        },
      ],
    },
    {
      header: 'ADDING THINGS',
      rows: [
        {
          key: 'grocery',
          label: 'Add to the grocery list',
          sub: 'Add only — no ticking off',
          value: household.sidekickGroceryAdd === true,
          onChange: onGrocery,
        },
        {
          key: 'calendar',
          label: 'Add to the calendar',
          value: caps.allowCalendarCreate,
          onChange: (v) => onCapabilities({ allowCalendarCreate: v }),
        },
        {
          key: 'approve',
          label: 'A parent approves events',
          sub: '…after you approve',
          value: caps.requireSidekickEventApproval,
          onChange: (v) => onCapabilities({ requireSidekickEventApproval: v }),
          dependent: true,
          disabled: !calendarOn,
        },
      ],
    },
    {
      header: 'POPPINS',
      rows: [
        {
          key: 'poppins',
          label: 'Talk to Poppins',
          sub: 'Base only',
          value: household.sidekickPoppinsAi === true,
          onChange: onPoppinsAi,
        },
      ],
    },
  ];

  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: c.text }]}>Sidekicks can…</Text>
      <Text style={[styles.purpose, { color: c.textMuted }]}>
        Applies to every kid · exceptions live on their card
      </Text>

      {groups.map((group) => (
        <View key={group.header} style={{ gap: 8 }}>
          <Text style={[styles.groupLabel, { color: c.textSubtle }]}>{group.header}</Text>
          <View
            style={[
              styles.card,
              { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
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
                  trackColor={{ false: glassBorder(0.14), true: accent }}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.3 },
  purpose: { fontSize: 14, lineHeight: 20, marginTop: -6 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dependent: { paddingLeft: 28 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 13 },
});
