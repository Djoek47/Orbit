import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text } from '@/components/orbit/app-text';

type StreakMarkerVariant = 'asterisk' | 'badge';

/**
 * Single hygiene affordance — use everywhere hygiene tasks appear.
 * Spec: docs/logic/choremaxx-reward-mode-cursor-spec.md §6
 */
export function StreakMarker({
  variant = 'asterisk',
  xpWhenRewarded,
}: {
  variant?: StreakMarkerVariant;
  /** When hygiene rewards are on, show XP beside the marker. */
  xpWhenRewarded?: number;
}) {
  const { c } = useOrbitColors();
  const a11y = 'Tracked as a streak, not points';

  if (variant === 'badge') {
    return (
      <View
        accessible
        accessibilityLabel={
          xpWhenRewarded != null && xpWhenRewarded > 0
            ? `Streak · ${xpWhenRewarded} XP`
            : a11y
        }
        style={[styles.badge, { backgroundColor: c.cardMuted, borderColor: c.border }]}>
        <MaterialIcons name="local-fire-department" size={12} color={c.textMuted} />
        <Text style={[styles.badgeText, { color: c.textMuted }]}>Streak</Text>
        {xpWhenRewarded != null && xpWhenRewarded > 0 ? (
          <Text style={[styles.badgeXp, { color: c.textSoft }]}>{xpWhenRewarded} XP</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={
        xpWhenRewarded != null && xpWhenRewarded > 0
          ? `Streak · ${xpWhenRewarded} XP · ${a11y}`
          : a11y
      }
      style={styles.asteriskRow}>
      {xpWhenRewarded != null && xpWhenRewarded > 0 ? (
        <Text style={[styles.asteriskXp, { color: c.textSoft }]}>{xpWhenRewarded} XP</Text>
      ) : null}
      <MaterialIcons name="local-fire-department" size={14} color={c.textMuted} />
    </View>
  );
}

export function StreakFootnote({ rewardedXp }: { rewardedXp?: number }) {
  const { c } = useOrbitColors();
  const text =
    rewardedXp != null && rewardedXp > 0
      ? `Hygiene tasks build streaks and earn a flat ${rewardedXp} XP.`
      : 'Hygiene builds streaks rather than points.';
  return <Text style={[styles.footnote, { color: c.textSubtle }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  asteriskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  asterisk: {
    fontSize: 14,
    fontWeight: '700',
  },
  asteriskXp: {
    fontSize: 12,
    fontWeight: '700',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeXp: {
    fontSize: 11,
    fontWeight: '600',
  },
  footnote: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
  },
});
