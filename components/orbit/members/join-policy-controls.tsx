import { SettingsGroup, SettingsToggleRow } from '@/components/orbit/settings/grouped';
import { typography } from '@/constants/orbit-theme';
import {
  getJoinPolicyMode,
  isReviewJoinPolicy,
  JOIN_POLICY_COPY,
} from '@/lib/household/join-policy';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

/** Household join policy — one switch, contextual footer. */
export function MembersJoinPolicyGroup({ showHeader = true }: { showHeader?: boolean }) {
  const { household, permissions, setJoinApprovalRequired } = useOrbit();

  if (!permissions.canManageHousehold) return null;

  const reviewRequired = isReviewJoinPolicy(household);

  return (
    <SettingsGroup
      header={showHeader ? JOIN_POLICY_COPY.sectionPolicyHeader : undefined}
      footer={reviewRequired ? JOIN_POLICY_COPY.reviewToggleOn : JOIN_POLICY_COPY.reviewToggleOff}>
      <SettingsToggleRow
        label={JOIN_POLICY_COPY.reviewToggleLabel}
        value={reviewRequired}
        last
        onValueChange={(next) => setJoinApprovalRequired(next)}
      />
    </SettingsGroup>
  );
}

/** Per-member trust — only when household reviews joins and member is invited/pending. */
export function MemberTrustSwitch({ member }: { member: HouseholdMember }) {
  const { household, permissions, setMemberJoinPreApproved } = useOrbit();

  if (!permissions.canManageHousehold || !isReviewJoinPolicy(household)) return null;
  if (member.role === 'owner' || member.role === 'shared-device') return null;
  if (member.status !== 'invited' && member.status !== 'pending') return null;

  const trusted = member.joinPreApproved === true;

  return (
    <SettingsToggleRow
      label={JOIN_POLICY_COPY.trustRowLabel}
      subtitle={
        trusted
          ? JOIN_POLICY_COPY.trustRowHint(member.name)
          : JOIN_POLICY_COPY.trustRowOffHint(member.name)
      }
      value={trusted}
      last
      onValueChange={(next) => void setMemberJoinPreApproved(member.id, next)}
    />
  );
}

/** One-line policy summary for compact surfaces. */
export function JoinPolicySummary() {
  const { c } = useOrbitColors();
  const { household, permissions } = useOrbit();
  if (!permissions.canManageHousehold) return null;

  const mode = getJoinPolicyMode(household);
  return (
    <Text style={[typography.footnote, { color: c.textMuted }]}>
      {mode === 'review' ? 'New members need your approval.' : 'New members join automatically.'}
    </Text>
  );
}
