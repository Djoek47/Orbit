import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { IuiFaces } from '@/components/orbit/poppins-stage/iui-faces';
import { orbitColors, radius, space } from '@/constants/orbit-theme';
import { loadDeviceSession } from '@/lib/device/device-session';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import {
  findSharedDeviceForMember,
  isSharedDeviceRole,
  resolveSharedDevicePeople,
} from '@/lib/household/shared-device';
import type { IuiFace } from '@/lib/poppins/ui-scenes';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

type PersonaSwitchPopupProps = {
  visible: boolean;
  onClose: () => void;
  members: HouseholdMember[];
  currentMemberId: string;
  onSwitch: (memberId: string) => void;
  /** Prefer device-hosted profiles when set (from DeviceSession.profileMemberIds). */
  hostedMemberIds?: string[];
};

function switchableAccounts(
  members: HouseholdMember[],
  currentMemberId: string,
  hostedMemberIds?: string[]
): { accounts: HouseholdMember[]; subtitle: string } {
  if (hostedMemberIds && hostedMemberIds.length > 0) {
    const accounts = hostedMemberIds
      .map((id) => members.find((member) => member.id === id))
      .filter((member): member is HouseholdMember =>
        Boolean(
          member &&
            member.status === 'active' &&
            !isSharedDeviceRole(member.role) &&
            member.role !== 'guest'
        )
      );
    if (accounts.length > 0) {
      return { accounts, subtitle: 'On this device' };
    }
  }

  const current = members.find((member) => member.id === currentMemberId);
  const shell =
    findSharedDeviceForMember(currentMemberId, members) ??
    (current && isSharedDeviceRole(current.role) ? current : undefined);

  if (shell) {
    return {
      accounts: resolveSharedDevicePeople(shell, members),
      subtitle: `${shell.name} accounts`,
    };
  }

  return {
    accounts: members.filter(
      (member) =>
        member.status === 'active' &&
        !isSharedDeviceRole(member.role) &&
        member.role !== 'guest'
    ),
    subtitle: 'Household accounts',
  };
}

function toFaces(accounts: HouseholdMember[]): IuiFace[] {
  return accounts.map((member) => ({
    id: member.id,
    name: member.name,
    emoji: memberDisplayEmoji(member),
    imageUri: isAvatarImageUri(member.avatar) ? member.avatar : undefined,
  }));
}

export function PersonaSwitchPopup({
  visible,
  onClose,
  members,
  currentMemberId,
  onSwitch,
  hostedMemberIds: hostedProp,
}: PersonaSwitchPopupProps) {
  const { c } = useOrbitColors();
  const [hostedMemberIds, setHostedMemberIds] = useState<string[] | undefined>(hostedProp);

  useEffect(() => {
    if (hostedProp) {
      setHostedMemberIds(hostedProp);
      return;
    }
    if (!visible) return;
    void loadDeviceSession().then((session) => {
      if (session.mode === 'shared' && session.profileMemberIds.length > 0) {
        setHostedMemberIds(session.profileMemberIds);
      }
    });
  }, [visible, hostedProp]);

  const { accounts, subtitle } = switchableAccounts(members, currentMemberId, hostedMemberIds);
  const current = members.find((member) => member.id === currentMemberId);
  const faces = toFaces(accounts);
  const accent = orbitColors.accent;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <GlassCard style={styles.card}>
            <Text style={[styles.title, { color: c.text }]}>Switch account</Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>{subtitle}</Text>

            {faces.length === 0 ? (
              <Text style={[styles.empty, { color: c.textSoft }]}>No other accounts on this device.</Text>
            ) : (
              <IuiFaces
                faces={faces}
                selectedName={current?.name}
                accent={accent}
                onSelect={(name) => {
                  const member = accounts.find((item) => item.name === name);
                  if (!member) return;
                  if (member.id !== currentMemberId) {
                    void Haptics.selectionAsync();
                    onSwitch(member.id);
                  }
                  onClose();
                }}
              />
            )}
          </GlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    padding: space.lg,
  },
  sheet: {
    width: '100%',
  },
  card: {
    padding: space.lg,
    borderRadius: radius.xl,
    gap: space.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
  empty: {
    fontSize: 14,
    paddingVertical: space.md,
  },
});
