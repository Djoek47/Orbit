import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/orbit/avatar';
import { GlassCard } from '@/components/orbit/glass-card';
import { getAccentTheme } from '@/constants/accent-themes';
import { orbitColors, radius, space } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import {
  findSharedDeviceForMember,
  isSharedDeviceRole,
  resolveSharedDevicePeople,
} from '@/lib/household/shared-device';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';

type PersonaSwitchPopupProps = {
  visible: boolean;
  onClose: () => void;
  members: HouseholdMember[];
  currentMemberId: string;
  onSwitch: (memberId: string) => void;
};

function switchableAccounts(
  members: HouseholdMember[],
  currentMemberId: string
): { accounts: HouseholdMember[]; subtitle: string } {
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

export function PersonaSwitchPopup({
  visible,
  onClose,
  members,
  currentMemberId,
  onSwitch,
}: PersonaSwitchPopupProps) {
  const { c } = useOrbitColors();
  const { accounts, subtitle } = switchableAccounts(members, currentMemberId);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <GlassCard style={styles.card}>
            <Text style={[styles.title, { color: c.text }]}>Switch account</Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>{subtitle}</Text>

            {accounts.length === 0 ? (
              <Text style={[styles.empty, { color: c.textSoft }]}>No other accounts on this device.</Text>
            ) : (
              <View style={styles.list}>
                {accounts.map((member) => {
                  const active = member.id === currentMemberId;
                  const theme = getAccentTheme(member.accentThemeId);
                  return (
                    <Pressable
                      key={member.id}
                      style={[styles.row, { borderColor: orbitColors.border }, active && styles.rowActive]}
                      onPress={() => {
                        if (!active) {
                          void Haptics.selectionAsync();
                          onSwitch(member.id);
                        }
                        onClose();
                      }}>
                      <View style={[styles.avatar, { borderColor: theme.primary }]}>
                        <Avatar
                          name={member.name}
                          emoji={memberDisplayEmoji(member)}
                          imageUri={
                            isAvatarImageUri(member.avatar) ? member.avatar : undefined
                          }
                          size="s"
                        />
                      </View>
                      <View style={styles.meta}>
                        <Text style={[styles.name, { color: c.text }]}>{member.name}</Text>
                        <Text style={[styles.xp, { color: c.textMuted }]}>
                          {member.xp} XP · {theme.label}
                        </Text>
                      </View>
                      <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                      {active ? (
                        <MaterialIcons name="check" size={18} color={theme.primary} />
                      ) : (
                        <View style={styles.checkSpacer} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
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
    backgroundColor: 'rgba(8, 14, 28, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  card: {
    gap: space.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginBottom: space.md,
  },
  empty: {
    fontSize: 14,
    paddingVertical: space.md,
  },
  list: {
    gap: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  rowActive: {
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  xp: {
    fontSize: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  checkSpacer: {
    width: 18,
    height: 18,
  },
});
