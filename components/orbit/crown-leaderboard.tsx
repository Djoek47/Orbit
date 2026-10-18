/**
 * Crown leaderboard list — competition ranking colours + Recess rows.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { VOCAB } from '@/constants/vocabulary';
import { space, typography } from '@/constants/orbit-theme';
import type { CrownRankRow } from '@/lib/scoring/crowns';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  rows: CrownRankRow[];
  emptyCopy?: string | null;
  onSelect?: (memberId: string) => void;
};

export function CrownLeaderboard({ rows, emptyCopy, onSelect }: Props) {
  const { c } = useOrbitColors();

  if (emptyCopy) {
    return (
      <View style={styles.empty}>
        <Text style={[typography.body, { color: c.textMuted, textAlign: 'center' }]}>{emptyCopy}</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {rows.map((row) => {
        const nameColor = row.excluded ? c.textSubtle : row.color;
        return (
          <Pressable
            key={row.memberId}
            disabled={!onSelect || row.excluded}
            onPress={() => onSelect?.(row.memberId)}
            style={styles.row}
          >
            <Text style={[typography.footnote, styles.rank, { color: c.textMuted }]}>
              {row.rank != null ? row.rank : '—'}
            </Text>
            <Avatar name={row.name} size="s" />
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { color: nameColor, fontWeight: '600' }]} numberOfLines={1}>
                {row.name}
              </Text>
              {row.tiedLabel ? (
                <Text style={[typography.caption2, { color: c.textMuted }]}>{row.tiedLabel}</Text>
              ) : null}
              {row.onRecess ? (
                <Text style={[typography.caption2, { color: c.textSubtle }]}>{VOCAB.onRecess}</Text>
              ) : null}
            </View>
            <Text style={[typography.subheadline, { color: row.excluded ? c.textSubtle : c.textMuted }]}>
              {row.excluded ? '—' : `${row.netXp} XP`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  rank: { width: 24 },
  empty: { paddingVertical: space.lg },
});
