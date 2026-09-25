import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack } from 'expo-router';

import { MemberInviteSheet } from '@/components/orbit/member-invite-sheet';
import { ProfileInviteSheet } from '@/components/orbit/profile-invite-sheet';
import { AddMemberSheet } from '@/components/orbit/members/add-member-sheet';
import { HouseholdMembersRoster } from '@/components/orbit/members/household-members-roster';
import { PersonalizeLookSheet } from '@/components/orbit/personalize-look-sheet';
import { SettingsModalChrome } from '@/components/orbit/settings/modal-chrome';
import type { MemberInvite } from '@/lib/household/member-invites';
import {
  memberCanReceiveInvite,
  memberUsesProfileInvite,
} from '@/lib/household/member-invite-routing';
import { useMembersLiveRefresh } from '@/lib/refresh/use-members-live-refresh';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';

type InviteTarget =
  | { kind: 'profile'; memberId: string }
  | { kind: 'token'; memberId: string }
  | null;

export default function HouseholdMembersScreen() {
  const {
    accentTheme,
    currentMember,
    household,
    permissions,
    refreshHousehold,
    updateMemberAvatar,
  } = useOrbit();
  const { c } = useOrbitColors();

  useMembersLiveRefresh(permissions.canManageHousehold);

  const [memberInvites, setMemberInvites] = useState<MemberInvite[]>([]);
  const [inviteTarget, setInviteTarget] = useState<InviteTarget>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [personalizeMemberId, setPersonalizeMemberId] = useState<string | null>(null);

  const inviteMember =
    inviteTarget?.memberId != null
      ? (household.members.find((m) => m.id === inviteTarget.memberId) ?? null)
      : null;

  const personalizeMember = useMemo(
    () => household.members.find((member) => member.id === personalizeMemberId) ?? null,
    [household.members, personalizeMemberId]
  );

  const openInvite = (member: HouseholdMember) => {
    if (memberUsesProfileInvite(member)) {
      setInviteTarget({ kind: 'profile', memberId: member.id });
      return;
    }
    setInviteTarget({ kind: 'token', memberId: member.id });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsModalChrome
        backLabel="Settings"
        title="People"
        purpose="Tap anyone to change what they can do">
        <ScrollView
          style={{ flex: 1, backgroundColor: c.background }}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 40 }}
          contentInsetAdjustmentBehavior="automatic">
          <HouseholdMembersRoster
            accent={accentTheme.primary}
            variant="embedded"
            onAddMember={() => setWizardOpen(true)}
            onShareInvite={openInvite}
            onPersonalize={setPersonalizeMemberId}
          />
        </ScrollView>
      </SettingsModalChrome>

      <AddMemberSheet
        visible={wizardOpen}
        onDismiss={() => setWizardOpen(false)}
        onAdded={(member) => {
          setWizardOpen(false);
          void refreshHousehold().finally(() => {
            if (memberUsesProfileInvite(member)) {
              setInviteTarget({ kind: 'profile', memberId: member.id });
            } else if (memberCanReceiveInvite(member)) {
              setInviteTarget({ kind: 'token', memberId: member.id });
            }
          });
        }}
      />

      <PersonalizeLookSheet
        visible={Boolean(personalizeMember)}
        memberName={personalizeMember?.name ?? 'Member'}
        currentAvatar={personalizeMember?.avatar}
        onDismiss={() => setPersonalizeMemberId(null)}
        onSelect={async (avatar: string) => {
          if (!personalizeMember) return;
          await updateMemberAvatar(personalizeMember.id, avatar);
        }}
      />

      <ProfileInviteSheet
        visible={inviteTarget?.kind === 'profile'}
        member={inviteTarget?.kind === 'profile' ? inviteMember : null}
        householdName={household.householdName}
        onClose={() => setInviteTarget(null)}
      />
      <MemberInviteSheet
        visible={inviteTarget?.kind === 'token'}
        member={inviteTarget?.kind === 'token' ? inviteMember : null}
        householdId={household.id ?? ''}
        adminId={currentMember?.id ?? ''}
        actorIsOwner={currentMember?.role === 'owner'}
        invites={memberInvites}
        onChangeInvites={setMemberInvites}
        onClose={() => setInviteTarget(null)}
      />
    </>
  );
}
