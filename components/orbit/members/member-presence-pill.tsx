/**
 * Live / disconnected / awaiting pill beside a Sidekick name.
 */
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { typography } from '@/constants/orbit-theme';
import {
  memberPresenceLabel,
  memberPresenceParts,
  type MemberPresenceChannel,
} from '@/lib/household/member-presence';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';

type Props = {
  member: HouseholdMember;
  /** Compact = dot + short word; full = Connected · Last seen … */
  variant?: 'compact' | 'full';
  /** personal = SIDEKICKS list; shared = tablet Who can use it. */
  channel?: MemberPresenceChannel;
  sharedDeviceId?: string | null;
};

export function MemberPresencePill({
  member,
  variant = 'compact',
  channel = 'any',
  sharedDeviceId,
}: Props) {
  const { c } = useOrbitColors();
  const opts = { channel, sharedDeviceId };
  const parts = memberPresenceParts(member, opts);
  const label =
    variant === 'full' ? memberPresenceLabel(member, opts) : parts.connectionLabel;

  let dot = c.textSubtle;
  if (parts.isLive) dot = '#38BDF8';
  else if (parts.connectionLabel === 'Needs invite' || parts.connectionLabel === 'Not connected yet') {
    dot = c.warning ?? '#FBBF24';
  } else if (parts.connectionLabel === 'Disconnected') {
    dot = c.textMuted;
  } else if (parts.connectionLabel === 'Connected') {
    dot = '#38BDF8';
  }

  return (
    <View style={styles.row} accessibilityLabel={label}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text
        style={[typography.caption1, { color: parts.isLive ? '#38BDF8' : c.textMuted }]}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
});
