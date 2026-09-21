import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { memberConnectionPhase } from '@/lib/household/member-connection';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

type MemberConnectionBadgeProps = {
  member: HouseholdMember;
  size?: 'sm' | 'md';
};

const AWAITING_YELLOW = '#FBBF24';

/** Connection state: yellow timer (awaiting invite), green check (connected). */
export function MemberConnectionBadge({ member, size = 'md' }: MemberConnectionBadgeProps) {
  const { c } = useOrbitColors();
  const phase = memberConnectionPhase(member);
  const iconSize = size === 'sm' ? 14 : 16;
  const box = size === 'sm' ? 22 : 24;

  if (phase === 'connected') {
    return (
      <View
        style={[styles.badge, { width: box, height: box, backgroundColor: `${c.success}22` }]}
        accessibilityLabel="Connected">
        <MaterialIcons name="check-circle" size={iconSize} color={c.success} />
      </View>
    );
  }

  return (
    <View
      style={[styles.badge, { width: box, height: box, backgroundColor: `${AWAITING_YELLOW}22` }]}
      accessibilityLabel="Not connected yet">
      <MaterialIcons name="timer" size={iconSize} color={AWAITING_YELLOW} />
    </View>
  );
}

export function MemberConnectionCaption({ member }: { member: HouseholdMember }) {
  const { c } = useOrbitColors();
  const phase = memberConnectionPhase(member);
  const color = phase === 'connected' ? c.success : c.textMuted;
  const label =
    phase === 'connected'
      ? member.userId?.trim()
        ? 'Connected · Has own account'
        : 'Connected'
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
    justifyContent: 'center',
    overflow: 'hidden',
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
