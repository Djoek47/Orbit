/**
 * People — WO14 §2.
 * Signed-in parent on top; Sidekicks with progress; pending amber Share;
 * Add someone + Shared devices last.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { HouseholdSwitcher } from '@/components/orbit/household-switcher';
import { SharedAccountRow } from '@/components/orbit/members/shared-account-row';
import { SharedIpadCard } from '@/components/orbit/members/shared-ipad-card';
import { Avatar } from '@/components/orbit/avatar';
import { radius, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import {
  countMembersForMembersScreen,
  membersScreenStatusLine,
} from '@/lib/household/join-policy';
import { familyAdminSeatsLabel, usesFamilyAdminCap } from '@/lib/household/admins';
import {
  findSharedDeviceForMember,
  listSharedDevices,
  nestedSharedAccountIds,
  resolveSharedDevicePeople,
  sharedDeviceLinkCandidates,
} from '@/lib/household/shared-device';
import { markNeedsProfilePick } from '@/lib/device/device-session';
import { isHouseholdSwitchDisabled } from '@/lib/feature-flags';
import { memberCanReceiveInvite } from '@/lib/household/member-invite-routing';
import { formatHouseholdRole } from '@/lib/permissions';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

type Props = {
  accent: string;
  variant?: 'embedded' | 'screen';
  onAddMember: () => void;
  onShareInvite: (member: HouseholdMember) => void;
  onPersonalize: (memberId: string) => void;
  onOpenPersonaSwitch?: () => void;
};

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

function ageLabel(member: HouseholdMember): string | null {
  const age = (member as { age?: number }).age;
  if (typeof age === 'number' && age > 0) return String(age);
  return null;
}

function todayProgress(
  member: HouseholdMember,
  household: { tasks: { assignees?: string[]; assignee: string; status: string; due: string }[] }
) {
  const today = new Date().toISOString().slice(0, 10);
  const mine = household.tasks.filter((t) => {
    const ids = t.assignees?.length ? t.assignees : [t.assignee];
    return (
      (ids.includes(member.id) || ids.includes(member.name)) && t.due.startsWith(today)
    );
  });
  const done = mine.filter((t) => t.status === 'Completed').length;
  const total = mine.length;
  return { done, total, ratio: total === 0 ? 0 : done / total };
}

export function HouseholdMembersRoster({
  accent,
  variant = 'embedded',
  onAddMember,
  onShareInvite,
  onPersonalize,
  onOpenPersonaSwitch,
}: Props) {
  const {
    currentMember,
    household,
    householdMemberships,
    permissions,
    approveMember,
    removeMember,
    switchPersona,
    updateSharedDeviceLinks,
  } = useOrbit();
  const { c, isDark, glassBorder } = useOrbitColors();

  const nestedAccountIds = useMemo(
    () => nestedSharedAccountIds(household.members),
    [household.members]
  );
  const sharedDevices = useMemo(() => listSharedDevices(household.members), [household.members]);
  const topLevel = useMemo(
    () =>
      household.members.filter(
        (member) => member.role !== 'shared-device' && !nestedAccountIds.has(member.id)
      ),
    [household.members, nestedAccountIds]
  );
  const linkCandidates = useMemo(
    () => sharedDeviceLinkCandidates(household.members),
    [household.members]
  );

  const signedIn =
    topLevel.find((m) => m.id === currentMember?.id) ??
    topLevel.find((m) => m.role === 'owner' || m.role === 'admin') ??
    null;

  // Nested shared-device Sidekicks must still appear (audit WO14 P1).
  const sidekicks = household.members.filter(
    (m) =>
      m.role === 'child' &&
      m.status === 'active' &&
      m.id !== signedIn?.id
  );
  const pending = topLevel.filter(
    (m) =>
      m.status === 'invited' ||
      m.status === 'pending' ||
      (memberCanReceiveInvite(m) && m.status !== 'active')
  );
  const otherAdults = topLevel.filter(
    (m) =>
      m.id !== signedIn?.id &&
      m.role !== 'child' &&
      m.status === 'active'
  );

  const canSwitchHousehold =
    householdMemberships.length > 1 && !isHouseholdSwitchDisabled();

  const counts = useMemo(() => countMembersForMembersScreen(household.members), [household.members]);
  const familyCap = usesFamilyAdminCap();
  const adminSeats = familyAdminSeatsLabel(household.members);
  const statusLine = membersScreenStatusLine(
    counts,
    'automatic',
    familyCap && counts.awaiting === 0 ? adminSeats : undefined
  );

  const sharedSubtitle = useMemo(() => {
    const device = sharedDevices[0];
    if (!device) return 'Set up a shared phone or tablet';
    const people = resolveSharedDevicePeople(device, household.members);
    const names = people.map((p) => p.name).join(', ');
    return names
      ? `${device.name?.trim() || 'Shared device'} · ${names}`
      : device.name?.trim() || 'Shared device';
  }, [sharedDevices, household.members]);

  const requestSwitch = (memberId: string) => {
    if (onOpenPersonaSwitch) {
      onOpenPersonaSwitch();
      return;
    }
    switchPersona(memberId);
  };

  const handleRemoveMember = (member: HouseholdMember) => {
    if (member.role === 'owner') {
      Alert.alert('Cannot remove', 'The household owner cannot be removed.');
      return;
    }
    const isDevice = member.role === 'shared-device';
    Alert.alert(
      isDevice ? 'Remove this device' : `Remove ${member.name}?`,
      isDevice
        ? `Remove ${member.name}? People stay in the household; this device just won't list them.`
        : 'They lose access to this household on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void removeMember(member.id),
        },
      ]
    );
  };

  const toggleSharedLink = (deviceId: string, personId: string, linkedIds: string[]) => {
    const next = linkedIds.includes(personId)
      ? linkedIds.filter((id) => id !== personId)
      : [...linkedIds, personId];
    void updateSharedDeviceLinks(deviceId, next);
  };

  return (
    <View style={styles.root}>
      {variant === 'screen' ? (
        <View style={styles.screenHeader}>
          <Text style={[typography.footnote, { color: c.textMuted }]}>{household.householdName}</Text>
          <Text style={[typography.title1, { color: c.text }]}>People</Text>
          <Text style={[typography.body, { color: c.textMuted }]}>
            Tap anyone to change what they can do
          </Text>
        </View>
      ) : null}

      {variant === 'embedded' && canSwitchHousehold ? (
        <View style={styles.switcherWrap}>
          <HouseholdSwitcher />
        </View>
      ) : null}

      {signedIn ? (
        <Pressable
          onPress={() => onPersonalize(signedIn.id)}
          style={[
            styles.parentCard,
            {
              backgroundColor: `${accent}18`,
              borderColor: `${accent}44`,
            },
          ]}>
          <Avatar
            name={signedIn.name}
            emoji={memberDisplayEmoji(signedIn)}
            imageUri={isAvatarImageUri(signedIn.avatar) ? signedIn.avatar : undefined}
            size="l"
          />
          <View style={styles.parentBody}>
            <Text style={[styles.parentName, { color: c.text }]}>{signedIn.name}</Text>
            <Text style={[styles.parentMeta, { color: c.textMuted }]}>
              {formatHouseholdRole(signedIn.role)} · signed in here
            </Text>
          </View>
          <View style={styles.xpBlock}>
            <Text style={[styles.xpValue, { color: accent }]}>{signedIn.xp ?? 0}</Text>
            <Text style={[styles.xpLabel, { color: c.textSubtle }]}>XP</Text>
          </View>
        </Pressable>
      ) : null}

      {sidekicks.length > 0 || otherAdults.length > 0 ? (
        <Text style={[styles.sectionTitle, { color: c.textSubtle }]}>SIDEKICKS</Text>
      ) : null}

      {[...sidekicks, ...otherAdults.filter((m) => m.role === 'child')].map((member) => {
        const progress = todayProgress(member, household);
        const age = ageLabel(member);
        const device = findSharedDeviceForMember(member.id, household.members);
        const sub = device
          ? `${age ? `${age} · ` : ''}shares the ${device.name?.trim() || 'shared device'}`
          : age
            ? `${age} · ${progress.done} of ${progress.total} done today`
            : `${progress.done} of ${progress.total} done today`;
        return (
          <Pressable
            key={member.id}
            onPress={() => onPersonalize(member.id)}
            onLongPress={() =>
              permissions.canManageHousehold ? handleRemoveMember(member) : undefined
            }
            style={[
              styles.kidCard,
              { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
            ]}>
            <View style={[styles.mono, { backgroundColor: `${accent}22` }]}>
              {isAvatarImageUri(member.avatar) ? (
                <Avatar
                  name={member.name}
                  imageUri={member.avatar}
                  size="m"
                />
              ) : (
                <Text style={[styles.monoText, { color: accent }]}>{monogram(member.name)}</Text>
              )}
            </View>
            <View style={styles.kidBody}>
              <Text style={[styles.kidName, { color: c.text }]}>{member.name}</Text>
              <Text style={[styles.kidMeta, { color: c.textMuted }]} numberOfLines={1}>
                {sub}
              </Text>
              <View style={[styles.barTrack, { backgroundColor: glassBorder(0.12) }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.round(progress.ratio * 100)}%`, backgroundColor: accent },
                  ]}
                />
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
          </Pressable>
        );
      })}

      {otherAdults
        .filter((m) => m.role !== 'child')
        .map((member) => (
          <Pressable
            key={member.id}
            onPress={() => requestSwitch(member.id)}
            style={[
              styles.kidCard,
              { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
            ]}>
            <View style={[styles.mono, { backgroundColor: `${accent}22` }]}>
              <Text style={[styles.monoText, { color: accent }]}>{monogram(member.name)}</Text>
            </View>
            <View style={styles.kidBody}>
              <Text style={[styles.kidName, { color: c.text }]}>{member.name}</Text>
              <Text style={[styles.kidMeta, { color: c.textMuted }]}>
                {formatHouseholdRole(member.role)}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
          </Pressable>
        ))}

      {pending.map((member) => (
        <View
          key={member.id}
          style={[
            styles.inviteCard,
            { borderColor: '#F59E0B88', backgroundColor: 'rgba(245,158,11,0.08)' },
          ]}>
          <View style={[styles.mono, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
            <Text style={[styles.monoText, { color: '#F59E0B' }]}>{monogram(member.name)}</Text>
          </View>
          <View style={styles.kidBody}>
            <Text style={[styles.kidName, { color: c.text }]}>{member.name}</Text>
            <Text style={[styles.kidMeta, { color: '#F59E0B' }]}>Invited · share to finish</Text>
          </View>
          <Pressable
            onPress={() => onShareInvite(member)}
            style={[styles.shareBtn, { backgroundColor: '#F59E0B' }]}
            accessibilityRole="button">
            <Text style={styles.shareLabel}>Share</Text>
          </Pressable>
          {member.status === 'pending' && permissions.canManageHousehold ? (
            <Pressable onPress={() => void approveMember(member.id)} hitSlop={8}>
              <MaterialIcons name="check" size={20} color={accent} />
            </Pressable>
          ) : null}
        </View>
      ))}

      {permissions.canInviteMembers ? (
        <Pressable
          onPress={onAddMember}
          style={[
            styles.actionRow,
            { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
          ]}>
          <View style={[styles.actionIcon, { backgroundColor: `${accent}22` }]}>
            <MaterialIcons name="person-add" size={18} color={accent} />
          </View>
          <Text style={[styles.actionLabel, { color: c.text }]}>Add someone</Text>
          <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
        </Pressable>
      ) : null}

      {permissions.canManageHousehold ? (
        <Pressable
          onPress={() => router.push('/setup-kid-device' as never)}
          style={[
            styles.actionRow,
            { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
          ]}>
          <View style={[styles.actionIcon, { backgroundColor: `${accent}22` }]}>
            <MaterialIcons name="tablet-mac" size={18} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionLabel, { color: c.text }]}>Shared devices</Text>
            <Text style={[styles.kidMeta, { color: c.textMuted }]} numberOfLines={1}>
              {sharedSubtitle}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
        </Pressable>
      ) : (
        <SharedIpadCard accent={accent} />
      )}

      {permissions.canManageHousehold && sharedDevices.length > 0
        ? sharedDevices.map((device) => {
            const accounts = resolveSharedDevicePeople(device, household.members);
            const linkedIds = device.sharedWithMemberIds ?? [];
            return (
              <View
                key={device.id}
                style={[
                  styles.deviceCard,
                  {
                    backgroundColor: glassFill(isDark),
                    borderColor: glassBorder(0.1),
                  },
                ]}>
                <View style={styles.deviceHead}>
                  <Text style={[styles.actionLabel, { color: c.text, flex: 1 }]}>
                    {device.name?.trim() || 'Shared device'}
                  </Text>
                  {accounts.length > 0 ? (
                    <Pressable
                      onPress={() => {
                        void markNeedsProfilePick().then(() =>
                          router.push('/select-profile' as never)
                        );
                      }}
                      style={[
                        styles.switchChip,
                        { backgroundColor: `${accent}18`, borderColor: `${accent}44` },
                      ]}>
                      <Text style={[styles.switchChipText, { color: accent }]}>Switch</Text>
                    </Pressable>
                  ) : null}
                </View>
                {permissions.canManageHousehold ? (
                  <View style={styles.linkWrap}>
                    {linkCandidates.map((person) => {
                      const linked = linkedIds.includes(person.id);
                      return (
                        <Pressable
                          key={person.id}
                          onPress={() => toggleSharedLink(device.id, person.id, linkedIds)}
                          style={[
                            styles.linkChip,
                            {
                              borderColor: glassBorder(0.1),
                              backgroundColor: linked ? `${accent}22` : glassFill(isDark),
                            },
                          ]}>
                          <Text
                            style={[
                              styles.linkChipText,
                              { color: linked ? accent : c.textMuted },
                            ]}>
                            {person.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                {accounts.map((person) => (
                  <SharedAccountRow
                    key={person.id}
                    person={person}
                    active={currentMember?.id === person.id}
                    accent={accent}
                    canManage={permissions.canManageHousehold}
                    onSwitch={() => requestSwitch(person.id)}
                    onPersonalize={() => onPersonalize(person.id)}
                    onShareInvite={() => onShareInvite(person)}
                    onUnlink={() => toggleSharedLink(device.id, person.id, linkedIds)}
                    onRemove={() => handleRemoveMember(person)}
                  />
                ))}
                <Pressable
                  onPress={() => handleRemoveMember(device)}
                  style={[styles.dangerChip, { borderColor: 'rgba(248,113,113,0.35)' }]}>
                  <Text style={styles.dangerChipText}>Remove device</Text>
                </Pressable>
              </View>
            );
          })
        : null}

      {variant === 'screen' && statusLine ? (
        <Text style={[styles.footerStatus, { color: c.textSubtle }]}>{statusLine}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  screenHeader: { gap: 4, marginBottom: 4 },
  switcherWrap: { marginBottom: 4 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginLeft: 4,
    marginTop: 8,
  },
  parentCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    padding: 14,
  },
  parentBody: { flex: 1, gap: 2 },
  parentName: { fontSize: 18, fontWeight: '700' },
  parentMeta: { fontSize: 13 },
  xpBlock: { alignItems: 'flex-end' },
  xpValue: { fontSize: 18, fontWeight: '700' },
  xpLabel: { fontSize: 11, fontWeight: '600' },
  kidCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inviteCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  mono: {
    alignItems: 'center',
    borderRadius: 18,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 44,
  },
  monoText: { fontSize: 15, fontWeight: '700' },
  kidBody: { flex: 1, gap: 4, minWidth: 0 },
  kidName: { fontSize: 16, fontWeight: '600' },
  kidMeta: { fontSize: 13 },
  barTrack: { borderRadius: 2, height: 4, overflow: 'hidden', width: '100%' },
  barFill: { borderRadius: 2, height: 4 },
  shareBtn: {
    borderRadius: 999,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  shareLabel: { color: '#1A1208', fontSize: 13, fontWeight: '700' },
  actionRow: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  actionLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  footerStatus: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  deviceCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  deviceHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  switchChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  switchChipText: { fontSize: 12, fontWeight: '700' },
  linkWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  linkChipText: { fontSize: 12, fontWeight: '600' },
  dangerChip: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    paddingVertical: 10,
  },
  dangerChipText: { color: '#F87171', fontSize: 13, fontWeight: '600' },
});
