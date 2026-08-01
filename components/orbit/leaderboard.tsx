import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/orbit/avatar';
import { orbitColors, space, typography } from '@/constants/orbit-theme';

export type LeaderboardEntry = {
  id: string;
  name: string;
  avatarEmoji?: string;
  xp: number;
};

type LeaderboardProps = {
  entries: LeaderboardEntry[];
  /** 'podium' for the top-3 hero treatment, 'list' for flat rows. */
  variant?: 'podium' | 'list';
};

/**
 * Motivational ranking — see docs/design-system/05-component-library.md
 * "Leaderboard / Rankings" and docs/design-system/11 (Fitness reference):
 * "your ring first, friends' activity second" — never leaderboard-shaming.
 */
export function Leaderboard({ entries, variant = 'list' }: LeaderboardProps) {
  const sorted = [...entries].sort((a, b) => b.xp - a.xp);

  if (variant === 'podium') {
    const [first, second, third] = sorted;
    const podium = [second, first, third].filter(Boolean) as LeaderboardEntry[];
    return (
      <View style={styles.podiumRow}>
        {podium.map((entry) => {
          const isFirst = entry.id === first?.id;
          return (
            <View key={entry.id} style={styles.podiumItem}>
              <Avatar name={entry.name} emoji={entry.avatarEmoji} size={isFirst ? 'l' : 'm'} />
              <Text style={typography.footnote} numberOfLines={1}>
                {entry.name}
              </Text>
              <Text style={[typography.caption1, styles.podiumXp]}>{entry.xp} XP</Text>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {sorted.map((entry, index) => (
        <View key={entry.id} style={styles.row}>
          <Text style={[typography.footnote, styles.rank]}>{index + 1}</Text>
          <Avatar name={entry.name} emoji={entry.avatarEmoji} size="s" />
          <Text style={[typography.body, styles.name]} numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={typography.subheadline}>{entry.xp} XP</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  podiumRow: {
    flexDirection: 'row',
    gap: space.lg,
    justifyContent: 'center',
  },
  podiumItem: {
    alignItems: 'center',
    gap: 4,
  },
  podiumXp: {
    color: orbitColors.rankGold,
    fontWeight: '700',
  },
  list: {
    gap: space.xs,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  rank: {
    color: orbitColors.textMuted,
    width: 20,
  },
  name: {
    flex: 1,
  },
});
