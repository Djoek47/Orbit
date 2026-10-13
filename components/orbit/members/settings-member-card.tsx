import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { ActionSheetIOS, Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { MemberGlyph } from '@/components/orbit/member-glyph';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { SettingsToggleRow } from '@/components/orbit/settings/grouped';
import { radius, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { memberCardStatus } from '@/lib/household/member-card-status';
import { memberCanReceiveInvite } from '@/lib/household/member-invite-routing';
import { formatHouseholdRole } from '@/lib/permissions';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';

type SettingsMemberCardProps = {
  member: HouseholdMember;
  /** Full household roster — used to resolve shared-device nesting. */
  members: HouseholdMember[];
  active: boolean;
  accent: string;
  canManage: boolean;
  renaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onPersonalize: () => void;
  onSwitchPersona: () => void;
  onShareInvite: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onRemove: () => void;
  onHomeworkProofChange: (required: boolean) => void;
  /** Leftover pending adults only — join approval was removed for new invites. */
  onApprove?: () => void;
};

function showMemberManageMenu(
  member: HouseholdMember,
  onRename: () => void,
  onRemove: () => void
) {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: member.name,
      options: ['Rename', 'Remove from household', 'Cancel'],
      cancelButtonIndex: 2,
      destructiveButtonIndex: 1,
    },
    (index) => {
      if (index === 0) onRename();
      if (index === 1) onRemove();
    }
  );
}

/** Calm member row — state + next action visible without a tap. */
export function SettingsMemberCard({
  member,
  members,
  active,
  accent,
  canManage,
  renaming,
  renameValue,
  onRenameValueChange,
  onPersonalize,
  onSwitchPersona,
  onShareInvite,
  onStartRename,
  onCommitRename,
  onRemove,
  onHomeworkProofChange,
  onApprove,
}: SettingsMemberCardProps) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const photo = isAvatarImageUri(member.avatar);
  const showInvite = canManage && memberCanReceiveInvite(member);
  const showHomework = canManage && member.role === 'child';
  const showMenu = canManage && member.role !== 'owner';
  const status = memberCardStatus(member, members);

  const runPrimaryAction = () => {
    switch (status.action) {
      case 'setup_device':
        router.push('/setup-kid-device' as never);
        return;
      case 'show_code':
      case 'share_invite':
        onShareInvite();
        return;
      case 'approve':
        onApprove?.();
        return;
      default:
        return;
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: glassFill(isDark),
          borderColor: active ? `${accent}55` : glassBorder(0.08),
        },
      ]}>
      <View style={styles.header}>
        <Pressable
          onPress={onPersonalize}
          accessibilityLabel={`Personalize look for ${member.name}`}
          style={[styles.avatar, { backgroundColor: `${active ? accent : c.textSubtle}33` }]}>
          {photo ? (
            <Image source={{ uri: member.avatar }} style={styles.avatarImage} />
          ) : (
            <MemberGlyph member={member} size={18} />
          )}
        </Pressable>

        <Pressable style={styles.identity} onPress={onSwitchPersona}>
          {renaming ? (
            <TextInput
              value={renameValue}
              onChangeText={onRenameValueChange}
              style={[styles.nameInput, { color: c.text }]}
              autoFocus
              onSubmitEditing={onCommitRename}
            />
          ) : (
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {member.name}
            </Text>
          )}
          <Text style={[styles.meta, { color: c.textSubtle }]} numberOfLines={1}>
            {formatHouseholdRole(member.role)} · {status.line}
          </Text>
          {!isSharedDeviceMember(member) ? (
            <Text style={[styles.xp, { color: accent }]}>{member.xp} XP</Text>
          ) : null}
        </Pressable>

        {showMenu ? (
          <Pressable
            onPress={() => showMemberManageMenu(member, onStartRename, onRemove)}
            hitSlop={8}
            accessibilityLabel={`Manage ${member.name}`}
            style={[styles.menuBtn, { backgroundColor: glass(0.06), borderColor: glassBorder(0.08) }]}>
            <MaterialIcons name="more-horiz" size={18} color={c.textMuted} />
          </Pressable>
        ) : active ? (
          <View style={[styles.activeDot, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }]}>
            <MaterialIcons name="check" size={14} color={accent} />
          </View>
        ) : null}
      </View>

      {canManage && status.actionLabel ? (
        <View style={styles.inviteRow}>
          <Pressable
            onPress={runPrimaryAction}
            style={[
              styles.shareBtn,
              { backgroundColor: `${accent}14`, borderColor: `${accent}44` },
            ]}>
            <MaterialIcons
              name={
                status.action === 'setup_device'
                  ? 'tablet-mac'
                  : status.action === 'approve'
                    ? 'check-circle'
                    : 'qr-code-2'
              }
              size={16}
              color={accent}
            />
            <Text style={[styles.shareBtnText, { color: accent }]}>{status.actionLabel}</Text>
          </Pressable>
        </View>
      ) : showInvite && !status.actionLabel ? (
        <View style={styles.inviteRow}>
          <Pressable
            onPress={onShareInvite}
            style={[
              styles.shareBtn,
              { backgroundColor: `${accent}14`, borderColor: `${accent}44` },
            ]}>
            <MaterialIcons name="qr-code-2" size={16} color={accent} />
            <Text style={[styles.shareBtnText, { color: accent }]}>Share invite</Text>
          </Pressable>
        </View>
      ) : null}

      {showHomework ? (
        <View
          style={[
            styles.settingsGroup,
            { backgroundColor: glass(0.04), borderColor: glassBorder(0.08) },
          ]}>
          <SettingsToggleRow
            label="Homework proof"
            subtitle="Photo when marking homework done"
            value={member.homeworkProofRequired !== false}
            last
            onValueChange={onHomeworkProofChange}
          />
        </View>
      ) : null}

      {showMenu && Platform.OS !== 'ios' && !renaming ? (
        <View style={styles.androidActions}>
          <Pressable
            onPress={onStartRename}
            style={[styles.footerChip, { borderColor: glassBorder(0.12) }]}>
            <Text style={[styles.footerChipText, { color: c.textMuted }]}>Rename</Text>
          </Pressable>
          <Pressable
            onPress={onRemove}
            style={[styles.footerChip, { borderColor: 'rgba(248,113,113,0.35)' }]}>
            <Text style={[styles.footerChipText, { color: '#F87171' }]}>Remove</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function isSharedDeviceMember(member: HouseholdMember): boolean {
  return member.role === 'shared-device';
}

const styles = StyleSheet.create({
  card: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
    marginBottom: space.sm,
    padding: space.md,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: space.sm,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56,
  },
  avatarEmoji: { fontSize: 28 },
  avatarImage: { height: 56, width: 56 },
  identity: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  name: {
    ...typography.headline,
    fontWeight: '700',
  },
  nameInput: {
    ...typography.headline,
    fontWeight: '700',
    padding: 0,
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
  },
  xp: {
    fontSize: 12,
    fontWeight: '700',
  },
  menuBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  activeDot: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  shareBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inviteRow: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  settingsGroup: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  androidActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footerChip: {
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  footerChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
