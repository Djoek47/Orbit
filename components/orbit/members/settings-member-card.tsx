import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image, Pressable, StyleSheet, Switch, View } from 'react-native';

import {
  MemberConnectionBadge,
} from '@/components/orbit/member-connection-badge';
import { SettingsToggleRow } from '@/components/orbit/settings/grouped';
import { radius, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { memberCanReceiveInvite } from '@/lib/household/member-invite-routing';
import { memberConnectionPhase } from '@/lib/household/member-connection';
import {
  canTrustMemberForAutoJoin,
  JOIN_POLICY_COPY,
} from '@/lib/household/join-policy';
import { formatHouseholdRole } from '@/lib/permissions';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember, HouseholdSnapshot } from '@/types/orbit';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';

type SettingsMemberCardProps = {
  member: HouseholdMember;
  household: HouseholdSnapshot;
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
  onApprove: () => void;
  onAutoJoinChange: (trusted: boolean) => void;
  onHomeworkProofChange: (required: boolean) => void;
};

/** Settings → Members row — vertical layout so toggles never collide with action icons. */
export function SettingsMemberCard({
  member,
  household,
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
  onApprove,
  onAutoJoinChange,
  onHomeworkProofChange,
}: SettingsMemberCardProps) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const photo = isAvatarImageUri(member.avatar);
  const phase = memberConnectionPhase(member);
  const showTrust = canManage && canTrustMemberForAutoJoin(member, household);
  const trusted = member.joinPreApproved === true;
  const showInvite = canManage && memberCanReceiveInvite(member);
  const showHomework = canManage && member.role === 'child';
  const statusLabel =
    phase === 'connected'
      ? 'Connected'
      : phase === 'pending_approval'
        ? 'Waiting for approval'
        : 'Not connected yet';

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
          {phase === 'pending_approval' && canManage ? (
            <Pressable
              onPress={onApprove}
              style={[styles.approveBtn, { backgroundColor: `${c.success}22`, borderColor: `${c.success}66` }]}>
              <Text style={[styles.approveBtnText, { color: c.success }]}>Approve</Text>
            </Pressable>
          ) : showTrust ? (
            <Pressable
              onPress={() => onAutoJoinChange(!trusted)}
              accessibilityLabel={`${JOIN_POLICY_COPY.trustRowLabel} for ${member.name}`}
              style={[
                styles.approveBtn,
                trusted
                  ? { backgroundColor: `${c.success}22`, borderColor: `${c.success}66` }
                  : { backgroundColor: glass(0.06), borderColor: glassBorder(0.12) },
              ]}>
              <MaterialIcons
                name={trusted ? 'verified' : 'gpp-maybe'}
                size={14}
                color={trusted ? c.success : c.textMuted}
              />
              <Text
                style={[
                  styles.approveBtnText,
                  { color: trusted ? c.success : c.textMuted },
                ]}>
                {JOIN_POLICY_COPY.trustRowLabel}
              </Text>
            </Pressable>
          ) : null}
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
  approveBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  approveBtnText: {
    fontSize: 11,
    fontWeight: '700',
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
