import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { getAccentTheme } from '@/constants/accent-themes';
import { orbitColors, orbitRadius, orbitSpacing } from '@/constants/orbit-theme';
import { memberDisplayEmoji } from '@/lib/game-levels';
import {
  findSharedDeviceForMember,
  isSharedDeviceRole,
  resolveSharedDevicePeople,
} from '@/lib/household/shared-device';
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
  const { accounts, subtitle } = switchableAccounts(members, currentMemberId);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <GlassCard style={styles.card}>
            <Text style={styles.title}>Switch account</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            {accounts.length === 0 ? (
              <Text style={styles.empty}>No other accounts on this device.</Text>
            ) : (
              <View style={styles.list}>
                {accounts.map((member) => {
                  const active = member.id === currentMemberId;
                  const theme = getAccentTheme(member.accentThemeId);
                  return (
                    <Pressable
                      key={member.id}
                      style={[styles.row, active && styles.rowActive]}
                      onPress={() => {
                        if (!active) {
                          void Haptics.selectionAsync();
                          onSwitch(member.id);
                        }
                        onClose();
                      }}>
                      <View style={[styles.avatar, { borderColor: theme.primary }]}>
                        <Text style={styles.avatarText}>{memberDisplayEmoji(member)}</Text>
                      </View>
                      <View style={styles.meta}>
                        <Text style={styles.name}>{member.name}</Text>
                        <Text style={styles.xp}>
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
    paddingHorizontal: orbitSpacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  card: {
    gap: orbitSpacing.sm,
  },
  title: {
    color: orbitColors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: orbitColors.textMuted,
    fontSize: 13,
    marginBottom: orbitSpacing.xs,
  },
  empty: {
    color: orbitColors.textSoft,
    fontSize: 14,
    paddingVertical: orbitSpacing.md,
  },
  list: {
    gap: orbitSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: orbitSpacing.sm,
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    borderColor: orbitColors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: orbitSpacing.sm,
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
  },
  avatarText: {
    fontSize: 20,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: orbitColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  xp: {
    color: orbitColors.textMuted,
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
