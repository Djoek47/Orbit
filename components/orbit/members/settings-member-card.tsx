import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { MemberConnectionBadge } from '@/components/orbit/member-connection-badge';
import { SettingsToggleRow } from '@/components/orbit/settings/grouped';
import { radius, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { memberCanReceiveInvite } from '@/lib/household/member-invite-routing';
import { memberConnectionPhase } from '@/lib/household/member-connection';
import { formatHouseholdRole } from '@/lib/permissions';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';

type SettingsMemberCardProps = {
  member: HouseholdMember;
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
};

/** Settings → Members row — vertical layout so toggles never collide with action icons. */
export function SettingsMemberCard({
  member,
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
}: SettingsMemberCardProps) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const photo = isAvatarImageUri(member.avatar);
  const phase = memberConnectionPhase(member);
  const showInvite = canManage && memberCanReceiveInvite(member);
  const showHomework = canManage && member.role === 'child';
  const statusLabel = phase === 'connected' ? 'Connected' : 'Not connected yet';

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
            <Text style={styles.avatarEmoji}>{memberDisplayEmoji(member)}</Text>
          )}
          <View
            style={[
              styles.avatarEdit,
              { backgroundColor: c.backgroundSoft, borderColor: glassBorder(0.1) },
            ]}>
            <MaterialIcons name="edit" size={10} color="#38BDF8" />
          </View>
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
            {formatHouseholdRole(member.role)} · {statusLabel}
          </Text>
          <Text style={[styles.xp, { color: accent }]}>{member.xp} XP</Text>
        </Pressable>

        <View style={styles.headerActions}>
          <MemberConnectionBadge member={member} size="sm" />
          {canManage ? (
            <Pressable onPress={renaming ? onCommitRename : onStartRename} hitSlop={8}>
              <MaterialIcons
                name={renaming ? 'check' : 'badge'}
                size={18}
                color={renaming ? '#34D399' : '#38BDF8'}
              />
            </Pressable>
          ) : null}
          {canManage && member.role !== 'owner' ? (
            <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove ${member.name}`}>
              <MaterialIcons name="person-remove" size={20} color="#F87171" />
            </Pressable>
          ) : null}
          {active ? <MaterialIcons name="check-circle" size={18} color="#34D399" /> : null}
        </View>
      </View>

      {showInvite ? (
        <Pressable
          onPress={onShareInvite}
          style={[
            styles.shareBtn,
            { backgroundColor: `${accent}18`, borderColor: `${accent}44` },
          ]}>
          <MaterialIcons name="qr-code-2" size={16} color={accent} />
          <Text style={[styles.shareBtnText, { color: accent }]}>Share invite</Text>
        </Pressable>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
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
    position: 'relative',
    width: 56,
  },
  avatarImage: { height: 56, width: 56 },
  avatarEmoji: { fontSize: 28 },
  avatarEdit: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    bottom: -2,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 20,
  },
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
    fontSize: 12,
    fontWeight: '600',
  },
  xp: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
    maxWidth: 132,
  },
  shareBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
});
