import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

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
      ? 'Connected'
      : phase === 'pending_approval'
        ? 'Waiting for approval'
        : 'Not connected yet';

  return <Text style={[styles.caption, { color }]}>{label}</Text>;
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
});
