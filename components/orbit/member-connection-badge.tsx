import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { memberConnectionPhase } from '@/lib/household/member-connection';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

type MemberConnectionBadgeProps = {
  member: HouseholdMember;
  size?: 'sm' | 'md';
};

const PENDING_ORANGE = '#FB923C';
const PENDING_BLUE = '#38BDF8';
const AWAITING_YELLOW = '#FBBF24';

/** Connection state: yellow timer (awaiting), orange↔blue pulse (pending approval), green check (connected). */
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

  if (phase === 'pending_approval') {
    return <PendingApprovalBadge size={box} iconSize={iconSize} />;
  }

  return (
    <View
      style={[styles.badge, { width: box, height: box, backgroundColor: `${AWAITING_YELLOW}22` }]}
      accessibilityLabel="Not connected yet">
      <MaterialIcons name="timer" size={iconSize} color={AWAITING_YELLOW} />
    </View>
  );
}

function PendingApprovalBadge({ size, iconSize }: { size: number; iconSize: number }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(pulse.value, [0, 1], [PENDING_ORANGE, PENDING_BLUE]),
    shadowColor: interpolateColor(pulse.value, [0, 1], [PENDING_ORANGE, PENDING_BLUE]),
    shadowOpacity: 0.35 + pulse.value * 0.25,
    shadowRadius: 4 + pulse.value * 3,
    shadowOffset: { width: 0, height: 0 },
  }));

  return (
    <Animated.View
      style={[styles.badge, styles.pendingRing, { width: size, height: size }, ringStyle]}
      accessibilityLabel="Waiting for approval">
      <LinearGradient
        colors={[PENDING_ORANGE, PENDING_BLUE]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
      <MaterialIcons name="hourglass-top" size={iconSize} color="#fff" />
    </Animated.View>
  );
}

export function MemberConnectionCaption({ member }: { member: HouseholdMember }) {
  const { c } = useOrbitColors();
  const phase = memberConnectionPhase(member);
  const color =
    phase === 'connected' ? c.success : phase === 'pending_approval' ? PENDING_ORANGE : c.textMuted;
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
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pendingRing: {
    borderWidth: 1.5,
    elevation: 2,
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
