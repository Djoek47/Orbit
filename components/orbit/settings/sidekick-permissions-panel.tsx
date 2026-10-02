/**
 * Sidekick permissions — household defaults (“Everyone”) or one kid at a time.
 * Face chips match Home → Today’s tasks person chips.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import {
  resolveCapabilitiesForMember,
  resolveMemberCapabilities,
} from '@/lib/member-capabilities';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember, HouseholdSnapshot, MemberCapabilities } from '@/types/orbit';

type Scope = 'all' | string;

type Props = {
  household: Pick<
    HouseholdSnapshot,
    'memberCapabilities' | 'sidekickGroceryAdd' | 'members'
  >;
  accent: string;
  busy?: boolean;
  /** Patch household defaults (Everyone). */
  onCapabilities: (patch: Partial<MemberCapabilities>) => void;
  onGrocery: (enabled: boolean) => void;
  /** Patch one Sidekick’s overrides. */
  onMemberCapabilities: (memberId: string, patch: Partial<MemberCapabilities>) => void;
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

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

export function SidekickPermissionsPanel({
  household,
  accent,
  busy,
  onCapabilities,
  onGrocery,
  onMemberCapabilities,
}: Props) {
  const { c, isDark, glassBorder } = useOrbitColors();
  const [scope, setScope] = useState<Scope>('all');

  const sidekicks = useMemo(
    () =>
      household.members.filter(
        (member) =>
          isSidekickRole(member.role) &&
          (member.status === 'active' || member.status === 'invited')
      ),
    [household.members]
  );

  const selected: HouseholdMember | null =
    scope === 'all' ? null : sidekicks.find((m) => m.id === scope) ?? null;

  const caps =
    scope === 'all'
      ? resolveMemberCapabilities(household)
      : resolveCapabilitiesForMember(household, scope);

  const calendarOn = caps.allowCalendarCreate;

  const apply = (patch: Partial<MemberCapabilities>) => {
    if (scope === 'all') {
      if (typeof patch.allowGroceryAdd === 'boolean') {
        onGrocery(patch.allowGroceryAdd);
        return;
      }
      onCapabilities(patch);
      return;
    }
    onMemberCapabilities(scope, patch);
  };

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
          onChange: (v) => apply({ allowRewardRedeem: v }),
        },
        {
          key: 'suggest',
          moji: 'sparkles',
          label: 'Suggest a reward',
          value: caps.allowSpecialRewardRequest,
          onChange: (v) => apply({ allowSpecialRewardRequest: v }),
        },
        {
          key: 'allowance',
          moji: 'moneyBag',
          label: 'See their allowance',
          value: caps.allowAllowance,
          onChange: (v) => apply({ allowAllowance: v }),
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
          sub:
            scope === 'all'
              ? 'Everyone — add only, no ticking off'
              : `Only ${selected?.name ?? 'this Sidekick'}`,
          value: caps.allowGroceryAdd,
          onChange: (v) => apply({ allowGroceryAdd: v }),
        },
        {
          key: 'calendar',
          moji: 'calendar',
          label: 'Add to the calendar',
          value: caps.allowCalendarCreate,
          onChange: (v) => apply({ allowCalendarCreate: v }),
        },
        {
          key: 'approve',
          moji: 'shield',
          label: 'A parent approves events',
          sub: '…after you approve',
          value: caps.requireSidekickEventApproval,
          onChange: (v) => apply({ requireSidekickEventApproval: v }),
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
  const who = selected?.name ?? 'Everyone';

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeInDown.duration(220)} style={styles.faces}>
        <Pressable
          onPress={() => setScope('all')}
          accessibilityRole="button"
          accessibilityState={{ selected: scope === 'all' }}
          style={[
            styles.faceChip,
            {
              backgroundColor: scope === 'all' ? `${accent}28` : glassFill(isDark),
              borderColor: scope === 'all' ? accent : glassBorder(0.12),
            },
          ]}>
          <View style={[styles.everyoneMark, { backgroundColor: `${accent}22` }]}>
            <Moji name="teddy" size={18} />
          </View>
          <Text
            style={[
              styles.faceName,
              { color: scope === 'all' ? accent : c.textMuted, fontWeight: '800' },
            ]}>
            Everyone
          </Text>
        </Pressable>

        {sidekicks.map((member) => {
          const active = scope === member.id;
          return (
            <Pressable
              key={member.id}
              onPress={() => setScope(member.id)}
              accessibilityRole="button"
              accessibilityLabel={`${member.name} permissions`}
              accessibilityState={{ selected: active }}
              style={[
                styles.faceChip,
                {
                  backgroundColor: active ? `${accent}28` : glassFill(isDark),
                  borderColor: active ? accent : glassBorder(0.12),
                },
              ]}>
              {isAvatarImageUri(member.avatar) ? (
                <Avatar name={member.name} imageUri={member.avatar} size="s" />
              ) : (
                <View style={[styles.mono, { backgroundColor: `${accent}22` }]}>
                  <Text style={[styles.monoText, { color: accent }]}>
                    {memberDisplayEmoji(member) || monogram(member.name)}
                  </Text>
                </View>
              )}
              <Text
                style={[
                  styles.faceName,
                  { color: active ? accent : c.text, fontWeight: active ? '800' : '600' },
                ]}
                numberOfLines={1}>
                {member.name}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(40).duration(240)}
        style={[styles.hero, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }]}>
        <View style={[styles.heroMoji, { backgroundColor: `${accent}26` }]}>
          {selected ? (
            isAvatarImageUri(selected.avatar) ? (
              <Avatar name={selected.name} imageUri={selected.avatar} size="m" />
            ) : (
              <Text style={{ fontSize: 26 }}>
                {memberDisplayEmoji(selected) || monogram(selected.name)}
              </Text>
            )
          ) : (
            <Moji name="teddy" size={30} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.title, { color: c.text }]}>
            {selected ? `${selected.name} can…` : 'Sidekicks can…'}
          </Text>
          <Text style={[styles.purpose, { color: c.textMuted }]}>
            {onCount} of {total} on · {who}
            {scope === 'all'
              ? ' · tap a face for one kid only'
              : ' · overrides Everyone for this person'}
          </Text>
        </View>
      </Animated.View>

      {groups.map((group, groupIndex) => (
        <Animated.View
          key={group.header}
          entering={FadeInDown.delay(80 + groupIndex * 50).duration(260)}
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
                      backgroundColor:
                        row.value && !row.disabled ? `${group.tone}22` : glassBorder(0.08),
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
  faces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  faceChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  everyoneMark: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  mono: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  monoText: { fontSize: 12, fontWeight: '800' },
  faceName: { fontSize: 13, maxWidth: 96 },
  hero: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
  },
  heroMoji: {
    alignItems: 'center',
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 54,
  },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  purpose: { fontSize: 13, lineHeight: 18 },
  groupHead: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  groupMoji: {
    alignItems: 'center',
    borderRadius: 10,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  card: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dependent: { paddingLeft: 28 },
  rowMoji: {
    alignItems: 'center',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  rowLabel: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12, lineHeight: 16 },
});
