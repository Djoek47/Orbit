/**
 * Household roster hub (§3.4) — list members, add, create / finish later.
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { OrbitButton } from '@/components/orbit/orbit-button';
import { Avatar } from '@/components/orbit/avatar';
import { MemberConnectionBadge } from '@/components/orbit/member-connection-badge';
import { MembersJoinPolicyGroup } from '@/components/orbit/members/join-policy-controls';
import { radius, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { JOIN_POLICY_COPY } from '@/lib/household/join-policy';
import { hasChosenAvatar } from '@/lib/profile/chosen-avatar';
import {
  draftHasCompleteMember,
  memberIsComplete,
  memberStatusLine,
  type DraftJoinPolicy,
  type DraftMember,
  type HouseholdSetupDraft,
} from '@/lib/onboarding/setup-draft';
import { incompleteMemberCount } from '@/lib/onboarding/materialize-setup';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text } from '@/components/orbit/app-text';

export type RosterSidekickInvite = {
  code: string;
  deepLink: string;
  webLink: string;
};

type SetupRosterHubProps = {
  draft: HouseholdSetupDraft;
  /** Confirmed admin display name (You) — not a draft child invite. */
  ownerName?: string;
  ownerAvatar?: string;
  /** Household created — show Sidekick share + QR per roster member. */
  rosterPostCreate?: boolean;
  sidekickInvitesByDraftId?: Record<string, RosterSidekickInvite>;
  expandedInviteDraftId?: string | null;
  onToggleSidekickInvite?: (draftId: string) => void;
  onShareSidekick?: (member: DraftMember, invite: RosterSidekickInvite) => void;
  onEditName: () => void;
  onEditOwnerName?: () => void;
  onAddMember: () => void;
  onEditMember: (member: DraftMember) => void;
  onCreateHousehold: () => void;
  onContinue?: () => void;
  onFinishLater: () => void;
  /** Pre-create: household join policy stored on draft. */
  onJoinPolicyChange?: (policy: DraftJoinPolicy) => void;
  /** Post-create: trust toggle per roster person (maps draft id → live member). */
  createdMemberByDraftId?: Record<string, { joinPreApproved?: boolean }>;
  onMemberTrustChange?: (draftId: string, trusted: boolean) => void;
  busy?: boolean;
};

export function SetupRosterHub({
  draft,
  ownerName,
  ownerAvatar,
  rosterPostCreate,
  sidekickInvitesByDraftId,
  expandedInviteDraftId,
  onToggleSidekickInvite,
  onShareSidekick,
  onEditName,
  onEditOwnerName,
  onAddMember,
  onEditMember,
  onCreateHousehold,
  onContinue,
  onFinishLater,
  onJoinPolicyChange,
  createdMemberByDraftId,
  onMemberTrustChange,
  busy,
}: SetupRosterHubProps) {
  const { c, glass, glassBorder } = useOrbitColors();
  const joinPolicy = draft.joinPolicy ?? 'review';
  const reviewRequired = joinPolicy !== 'automatic';
  // Solo admin can create; otherwise need at least one finished family member.
  const canCreate = draftHasCompleteMember(draft) || Boolean(ownerName?.trim());
  const incomplete = incompleteMemberCount(draft);
  const youName = (ownerName ?? '').trim() || 'You';

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={[typography.title1, { color: c.text, flex: 1 }]} numberOfLines={2}>
          {draft.householdName || 'Your household'}
        </Text>
        <Pressable
          onPress={onEditName}
          accessibilityLabel="Edit household name"
          hitSlop={8}
          style={[styles.pencil, { backgroundColor: glass(0.06), borderColor: glassBorder(0.12) }]}>
          <MaterialIcons name="edit" size={16} color={c.textMuted} />
        </Pressable>
      </View>
      <Text style={[typography.footnote, { color: c.textMuted, marginBottom: space.md }]}>
        {rosterPostCreate
          ? 'Share each invite, then continue when you are ready.'
          : 'Add everyone who&apos;ll be pitching in.'}
      </Text>

      {!rosterPostCreate && onJoinPolicyChange ? (
        <View
          style={[
            styles.policyCard,
            { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) },
          ]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[typography.headline, { color: c.text }]}>
              {JOIN_POLICY_COPY.reviewToggleLabel}
            </Text>
            <Text style={[typography.footnote, { color: c.textMuted }]}>
              {reviewRequired ? JOIN_POLICY_COPY.reviewToggleOn : JOIN_POLICY_COPY.reviewToggleOff}
            </Text>
          </View>
          <Switch
            accessibilityLabel={JOIN_POLICY_COPY.reviewToggleLabel}
            value={reviewRequired}
            onValueChange={(next) => onJoinPolicyChange(next ? 'review' : 'automatic')}
          />
        </View>
      ) : null}

      {rosterPostCreate ? <MembersJoinPolicyGroup /> : null}

      <View style={styles.list}>
        <Pressable
          onPress={onEditOwnerName}
          disabled={!onEditOwnerName}
          style={[
            styles.card,
            {
              backgroundColor: glass(0.05),
              borderColor: glassBorder(0.1),
            },
          ]}>
          <Avatar
            name={youName}
            emoji={memberDisplayEmoji({ name: youName, avatar: ownerAvatar })}
            imageUri={isAvatarImageUri(ownerAvatar) ? ownerAvatar : undefined}
            size="s"
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.headline, { color: c.text }]} numberOfLines={1}>
              {youName}
            </Text>
            <Text style={[typography.caption1, { color: c.textMuted }]}>You · Admin</Text>
          </View>
          {onEditOwnerName ? (
            <MaterialIcons name="edit" size={18} color={c.textSubtle} />
          ) : (
            <MaterialIcons name="check-circle" size={22} color="#34D399" />
          )}
        </Pressable>

        {draft.members.map((member) => {
          const complete = memberIsComplete(member);
          const invite = sidekickInvitesByDraftId?.[member.id];
          const inviteOpen = expandedInviteDraftId === member.id;
          return (
            <View key={member.id} style={styles.memberBlock}>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: glass(0.05),
                    borderColor: glassBorder(0.1),
                  },
                ]}>
                <Pressable
                  onPress={() => onEditMember(member)}
                  style={styles.cardMain}>
                  {hasChosenAvatar(member.avatar) ? (
                    <Avatar
                      name={member.name.trim() || 'Unnamed'}
                      emoji={
                        member.avatar && !isAvatarImageUri(member.avatar)
                          ? member.avatar
                          : memberDisplayEmoji({
                              name: member.name.trim() || 'Unnamed',
                              avatar: member.avatar,
                            })
                      }
                      imageUri={isAvatarImageUri(member.avatar) ? member.avatar : undefined}
                      size="s"
                    />
                  ) : (
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: member.avatarColor ?? c.primary },
                      ]}>
                      <Text style={styles.avatarText}>
                        {(member.name.trim() || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.headline, { color: c.text }]} numberOfLines={1}>
                      {member.name.trim() || 'Unnamed'}
                    </Text>
                    <Text style={[typography.caption1, { color: c.textMuted }]}>
                      {memberStatusLine(member)}
                    </Text>
                  </View>
                  {!complete ? (
                    <View style={styles.finishRow}>
                      <Text style={[typography.caption1, { color: c.textSubtle }]}>Finish setup</Text>
                      <MaterialIcons name="chevron-right" size={20} color={c.textSubtle} />
                    </View>
                  ) : null}
                </Pressable>
                {complete ? (
                  <View style={styles.memberActions}>
                    {rosterPostCreate && invite ? (
                      <Pressable
                        onPress={() => onToggleSidekickInvite?.(member.id)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Sidekick invite for ${member.name}`}
                        style={[
                          styles.inviteBtn,
                          { borderColor: glassBorder(0.14), backgroundColor: glass(0.06) },
                        ]}>
                        <MaterialIcons name="qr-code-2" size={16} color={c.primary} />
                      </Pressable>
                    ) : null}
                    <MemberConnectionBadge
                      member={{
                        id: member.id,
                        name: member.name.trim() || 'Unnamed',
                        role: 'child',
                        status: 'invited',
                        avatar: member.avatar ?? '?',
                        xp: 0,
                        loadShare: 0,
                      }}
                      size="sm"
                    />
                  </View>
                ) : null}
              </View>

            {rosterPostCreate && invite && inviteOpen ? (
              <View
                style={[
                  styles.invitePanel,
                  { backgroundColor: glass(0.04), borderColor: glassBorder(0.12) },
                ]}>
                <Text style={[typography.caption1, { color: c.textMuted }]}>
                  Sidekick invite · no email needed
                </Text>
                <View style={styles.qrWrap}>
                  <QRCode value={invite.webLink} size={120} backgroundColor="#FFFFFF" color="#0B1220" />
                </View>
                <Text selectable style={[typography.headline, { color: c.text, textAlign: 'center' }]}>
                  {invite.code}
                </Text>
                <OrbitButton
                  tone="secondary"
                  onPress={() => onShareSidekick?.(member, invite)}>
                  AirDrop / Share invite
                </OrbitButton>
                {reviewRequired && onMemberTrustChange && createdMemberByDraftId?.[member.id] ? (
                  <View style={styles.trustRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[typography.subheadline, { color: c.text, fontWeight: '600' }]}>
                        {JOIN_POLICY_COPY.trustRowLabel}
                      </Text>
                      <Text style={[typography.footnote, { color: c.textMuted }]}>
                        {(createdMemberByDraftId[member.id].joinPreApproved
                          ? JOIN_POLICY_COPY.trustRowHint
                          : JOIN_POLICY_COPY.trustRowOffHint)(member.name.trim() || 'They')}
                      </Text>
                    </View>
                    <Switch
                      value={createdMemberByDraftId[member.id].joinPreApproved === true}
                      onValueChange={(next) => onMemberTrustChange(member.id, next)}
                      accessibilityLabel={`${JOIN_POLICY_COPY.trustRowLabel} for ${member.name}`}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
            </View>
          );
        })}

        {!rosterPostCreate ? (
        <Pressable
          onPress={onAddMember}
          style={[
            styles.addRow,
            { borderColor: glassBorder(0.14), backgroundColor: glass(0.04) },
          ]}>
          <MaterialIcons name="person-add" size={20} color={c.primary} />
          <Text style={[typography.headline, { color: c.primary }]}>+ Add someone without an account</Text>
        </Pressable>
        ) : null}
      </View>

      <View style={styles.footer}>
        {rosterPostCreate ? (
          <>
            <Text style={[typography.footnote, { color: c.textMuted, textAlign: 'center' }]}>
              Share each Sidekick invite now — they can scan or open the link on their phone. No email
              needed.
            </Text>
            <OrbitButton disabled={busy} onPress={onContinue ?? onCreateHousehold}>
              Continue
            </OrbitButton>
          </>
        ) : (
          <>
            <OrbitButton disabled={!canCreate || busy} onPress={onCreateHousehold}>
              {busy ? 'Creating…' : 'Create household'}
            </OrbitButton>
            {!canCreate ? (
              <Text style={[typography.caption1, { color: c.textSubtle, textAlign: 'center' }]}>
                Add at least one person, or continue with just you as admin.
              </Text>
            ) : incomplete > 0 ? (
              <Text style={[typography.caption1, { color: c.textSubtle, textAlign: 'center' }]}>
                {incomplete} profile{incomplete === 1 ? '' : 's'} still need a name — you can create anyway.
              </Text>
            ) : null}
            <Pressable onPress={onFinishLater} disabled={busy} style={styles.secondary}>
              <Text style={[typography.headline, { color: c.textMuted, textAlign: 'center' }]}>
                Save and finish later
              </Text>
              <Text style={[typography.caption1, { color: c.textSubtle, textAlign: 'center' }]}>
                We&apos;ll keep everything you&apos;ve set up. You can add the rest of your family any time
                from Settings → Household.
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pencil: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: 10 },
  memberBlock: { gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inviteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitePanel: {
    gap: 10,
    padding: 14,
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  qrWrap: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  finishRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: radius.cardLarge,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  footer: { gap: 12, marginTop: space.lg },
  secondary: { gap: 6, paddingVertical: 8 },
  policyCard: {
    alignItems: 'center',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.sm,
    padding: 14,
  },
  trustRow: {
    alignItems: 'center',
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.md,
    paddingTop: space.sm,
    width: '100%',
  },
});
