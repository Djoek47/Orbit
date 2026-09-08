import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { HouseholdSwitcher } from '@/components/orbit/household-switcher';
import { AddMemberRow } from '@/components/orbit/members/add-member-row';
import { SettingsMemberCard } from '@/components/orbit/members/settings-member-card';
import { SharedAccountRow } from '@/components/orbit/members/shared-account-row';
import { SharedIpadCard } from '@/components/orbit/members/shared-ipad-card';
import { radius, space, typography } from '@/constants/orbit-theme';
import { memberDisplayEmoji } from '@/lib/game-levels';
import {
  countMembersForMembersScreen,
  membersScreenStatusLine,
} from '@/lib/household/join-policy';
import { familyAdminSeatsLabel, usesFamilyAdminCap } from '@/lib/household/admins';
import { markNeedsProfilePick } from '@/lib/device/device-session';
import {
  findSharedDeviceForMember,
  listSharedDevices,
  nestedSharedAccountIds,
  resolveSharedDevicePeople,
  sharedDeviceLinkCandidates,
} from '@/lib/household/shared-device';
import { isHouseholdSwitchDisabled } from '@/lib/feature-flags';
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
};

/** Single source of truth for household member roster UI (Settings + Members modal). */
export function HouseholdMembersRoster({
  accent,
  variant = 'embedded',
  onAddMember,
  onShareInvite,
  onPersonalize,
}: Props) {
  const {
    currentMember,
    household,
    householdMemberships,
    permissions,
    removeMember,
    switchPersona,
    updateMemberDisplayName,
    updateMemberHomeworkProof,
    updateSharedDeviceLinks,
  } = useOrbit();
  const { c, isDark, glassBorder } = useOrbitColors();

  const [renamingMemberId, setRenamingMemberId] = useState<string | null>(null);
  const [renamingMemberInput, setRenamingMemberInput] = useState('');

  const nestedAccountIds = useMemo(
    () => nestedSharedAccountIds(household.members),
    [household.members]
  );
  const sharedDevices = useMemo(() => listSharedDevices(household.members), [household.members]);
  const topLevelMembers = useMemo(
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
  const activeOnDevice = findSharedDeviceForMember(currentMember?.id, household.members);
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

  const handleRemoveMember = (member: HouseholdMember) => {
    if (member.role === 'owner') {
      Alert.alert('Cannot remove', 'The household owner cannot be removed.');
      return;
    }
    const isDevice = member.role === 'shared-device';
    const streak = member.streak ?? 0;
    const streakNote =
      !isDevice && streak > 0
        ? ` Removing ${member.name} also clears their ${streak}-day streak and XP on this device.`
        : !isDevice
          ? ` Removing ${member.name} clears their progress on this household.`
          : '';
    Alert.alert(
      isDevice ? 'Remove this iPad' : 'Remove member',
      isDevice
        ? `Remove ${member.name}? People stay in the household; this iPad just won't list them.`
        : `Remove ${member.name} from this household?${streakNote}`,
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
          <Text style={[typography.title1, { color: c.text }]}>Members</Text>
          <Text style={[typography.body, { color: c.textMuted }]}>{statusLine}</Text>
        </View>
      ) : null}

      {variant === 'embedded' && canSwitchHousehold ? (
        <View style={styles.switcherWrap}>
          <HouseholdSwitcher />
        </View>
      ) : null}

      {variant === 'embedded' ? (
        <Text style={[styles.hint, { color: c.textMuted }]}>
          Tap a name to switch. A shared iPad asks who is using it before opening Choremaxx.
        </Text>
      ) : null}

      {permissions.canInviteMembers ? (
        <AddMemberRow accent={accent} onPress={onAddMember} />
      ) : null}

      {permissions.canManageHousehold ? <SharedIpadCard accent={accent} /> : null}

      {permissions.canManageHousehold && sharedDevices.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: c.textSubtle }]}>SHARED DEVICES</Text>
          <Text style={[styles.hint, { color: c.textMuted, marginTop: -4 }]}>
            Select multiple users who share a single device.
          </Text>
        </>
      ) : null}

      {sharedDevices.map((device) => {
        const accounts = resolveSharedDevicePeople(device, household.members);
        const deviceActive = activeOnDevice?.id === device.id;
        const linkedIds = device.sharedWithMemberIds ?? [];

        return (
          <View
            key={device.id}
            style={[
              styles.deviceCard,
              {
                backgroundColor: glassFill(isDark),
                borderColor: deviceActive ? `${accent}55` : glassBorder(0.1),
              },
            ]}>
            <View style={styles.deviceHead}>
              <Text style={styles.deviceEmoji}>{device.avatar || '📱'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[typography.headline, { color: c.text, fontWeight: '700' }]}>
                  {device.name}
                </Text>
                <Text style={[styles.hint, { color: c.textSubtle }]}>
                  Shared device ·{' '}
                  {accounts.map((person) => person.name).join(' · ') || 'no accounts linked'}
                </Text>
              </View>
              {accounts.length > 0 ? (
                <Pressable
                  onPress={() => {
                    void markNeedsProfilePick().then(() => router.push('/select-profile' as never));
                  }}
                  style={[
                    styles.switchChip,
                    { backgroundColor: `${accent}18`, borderColor: `${accent}44` },
                  ]}>
                  <Text style={[styles.switchChipText, { color: accent }]}>Switch</Text>
                  <MaterialIcons name="expand-more" size={16} color={accent} />
                </Pressable>
              ) : null}
            </View>

            <Text style={[styles.hint, { color: c.textMuted }]}>
              People on this iPad pick their face when they open Choremaxx.
            </Text>

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
                        { borderColor: glassBorder(0.1), backgroundColor: glassFill(isDark) },
                        linked && styles.linkChipActive,
                      ]}>
                      <Text
                        style={[
                          styles.linkChipText,
                          { color: c.textMuted },
                          linked && styles.linkChipTextActive,
                        ]}>
                        {memberDisplayEmoji(person)} {person.name}
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
                onSwitch={() => switchPersona(person.id)}
                onPersonalize={() => onPersonalize(person.id)}
                onShareInvite={() => onShareInvite(person)}
                onUnlink={() => toggleSharedLink(device.id, person.id, linkedIds)}
                onRemove={() => handleRemoveMember(person)}
              />
            ))}

            {permissions.canManageHousehold ? (
              <Pressable
                onPress={() => handleRemoveMember(device)}
                style={[styles.dangerChip, { borderColor: 'rgba(248,113,113,0.35)' }]}>
                <Text style={styles.dangerChipText}>Remove device</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {topLevelMembers.map((member) => {
        const active = currentMember?.id === member.id;
        return (
          <SettingsMemberCard
            key={member.id}
            member={member}
            active={active}
            accent={accent}
            canManage={permissions.canManageHousehold}
            renaming={renamingMemberId === member.id}
            renameValue={renamingMemberInput}
            onRenameValueChange={setRenamingMemberInput}
            onPersonalize={() => onPersonalize(member.id)}
            onSwitchPersona={() => switchPersona(member.id)}
            onShareInvite={() => onShareInvite(member)}
            onStartRename={() => {
              setRenamingMemberId(member.id);
              setRenamingMemberInput(member.name);
            }}
            onCommitRename={() => {
              const next = renamingMemberInput.trim();
              if (next.length >= 2) {
                void updateMemberDisplayName(member.id, next);
              }
              setRenamingMemberId(null);
            }}
            onRemove={() => handleRemoveMember(member)}
            onHomeworkProofChange={(required) =>
              void updateMemberHomeworkProof(member.id, required)
            }
          />
        );
      })}

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: space.sm,
  },
  screenHeader: {
    gap: space.xs,
    marginBottom: space.sm,
  },
  switcherWrap: {
    marginBottom: space.sm,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: space.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginLeft: 4,
  },
  deviceCard: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
    marginBottom: space.md,
    padding: space.md,
  },
  deviceHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  deviceEmoji: {
    fontSize: 28,
  },
  switchChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  switchChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  linkWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkChip: {
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkChipActive: {
    backgroundColor: 'rgba(52,211,153,0.18)',
    borderColor: 'rgba(52,211,153,0.45)',
  },
  linkChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  linkChipTextActive: {
    color: '#34D399',
  },
  dangerChip: {
    alignSelf: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dangerChipText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
  },
});
