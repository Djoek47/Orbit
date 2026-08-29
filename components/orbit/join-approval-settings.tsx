import { Switch, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

type Props = {
  variant?: 'card' | 'inline';
};

/** Household-wide auto-approve + per-member pre-approve controls. */
export function JoinApprovalSettings({ variant = 'card' }: Props) {
  const { c } = useOrbitColors();
  const { household, permissions, setJoinApprovalRequired } = useOrbit();

  if (!permissions.canManageHousehold) return null;

  const approvalRequired = household.joinApprovalRequired !== false;
  const autoApproveAll = !approvalRequired;

  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={[typography.headline, { color: c.text }]}>Auto-approve invitations</Text>
          <Text style={[typography.footnote, { color: c.textMuted }]}>
            {autoApproveAll
              ? 'Anyone who accepts an invite enters immediately — no waiting for approval.'
              : 'New joiners wait for admin approval. Pre-approve individuals below when you trust them.'}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Auto-approve invitations"
          value={autoApproveAll}
          onValueChange={(next) => setJoinApprovalRequired(!next)}
        />
      </View>
    </>
  );

  if (variant === 'inline') return body;

  return <GlassCard style={{ gap: space.md }}>{body}</GlassCard>;
}

export function MemberPreApproveAction({
  member,
}: {
  member: HouseholdMember;
}) {
  const { household, permissions, setMemberJoinPreApproved } = useOrbit();
  const approvalRequired = household.joinApprovalRequired !== false;

  if (!permissions.canManageHousehold || !approvalRequired) return null;
  if (member.role === 'owner' || member.role === 'shared-device') return null;
  if (member.status !== 'invited' && member.status !== 'pending') return null;

  const preApproved = member.joinPreApproved === true;

  if (preApproved) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
        <StatusPill label="Pre-approved" tone="green" />
        <OrbitButton tone="secondary" onPress={() => void setMemberJoinPreApproved(member.id, false)}>
          Remove pre-approval
        </OrbitButton>
      </View>
    );
  }

  return (
    <OrbitButton tone="secondary" onPress={() => void setMemberJoinPreApproved(member.id, true)}>
      Pre-approve
    </OrbitButton>
  );
}
