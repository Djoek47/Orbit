import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { memberConnectionPhase } from '@/lib/household/member-connection';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

type MemberConnectionBadgeProps = {
  member: HouseholdMember;
  size?: 'sm' | 'md';
};

/** Hourglass until connected; green check when the app is linked and approved. */
export function MemberConnectionBadge({ member, size = 'md' }: MemberConnectionBadgeProps) {
  const { c } = useOrbitColors();
  const phase = memberConnectionPhase(member);
  const iconSize = size === 'sm' ? 14 : 16;

  if (phase === 'connected') {
    return (
      <View style={[styles.badge, { backgroundColor: `${c.success}22` }]}>
        <MaterialIcons name="check-circle" size={iconSize} color={c.success} />
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: `${c.warning}1A` }]}>
      <MaterialIcons name="hourglass-top" size={iconSize} color={c.warning} />
    </View>
  );
}

export function MemberConnectionCaption({ member }: { member: HouseholdMember }) {
  const { c } = useOrbitColors();
  const phase = memberConnectionPhase(member);
  const color = phase === 'connected' ? c.success : phase === 'pending_approval' ? c.warning : c.textMuted;
  const label =
    phase === 'connected'
      ? member.userId?.trim()
        ? 'Connected · Has own account'
        : 'Connected'
      : phase === 'pending_approval'
        ? 'Waiting for approval'
        : 'Not connected yet';

  return <Text style={[styles.caption, { color }]}>{label}</Text>;
}

export function HasOwnAccountBadge() {
  const { c } = useOrbitColors();
  return (
    <View style={[styles.ownAccount, { backgroundColor: `${c.accent}18`, borderColor: `${c.accent}44` }]}>
      <MaterialIcons name="account-circle" size={12} color={c.accent} />
      <Text style={[styles.ownAccountText, { color: c.accent }]}>Own account</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  caption: {
    fontSize: 11,
    fontWeight: '600',
  },
  ownAccount: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ownAccountText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
