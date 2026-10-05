/**
 * Live streak strip for Inbox → Activity (and similar surfaces).
 * Admin: every real person. Sidekick / shared: self first, then peer faces.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { StreakDots } from '@/components/orbit/house-rules/visuals/streak-dots';
import { radius, space, typography } from '@/constants/orbit-theme';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { resolveHouseRulesPalette } from '@/lib/rules/house-rules-palette';
import type { MemberStreakRow } from '@/lib/streaks/member-streak-rows';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  rows: MemberStreakRow[];
  /** Admin overview vs personal. */
  mode: 'household' | 'personal';
  accentColor: string;
};

export function StreakStrip({ rows, mode, accentColor }: Props) {
  const { c, glass, glassBorder } = useOrbitColors();
  const doc = getHouseRulesDoc();
  const palette = resolveHouseRulesPalette(mode === 'household' ? 'admin' : 'sidekick');
  const self = rows.find((row) => row.isSelf) ?? rows[0];

  if (!rows.length || !self) return null;

  return (
    <View
      style={[styles.card, { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) }]}
      accessibilityRole="summary"
      accessibilityLabel={
        mode === 'household'
          ? `Household streaks. ${rows.map((r) => `${r.name} ${r.streak} days`).join('. ')}`
          : `${self.name} streak ${self.streak} days`
      }>
      <View style={styles.head}>
        <View style={[styles.fireBadge, { backgroundColor: 'rgba(251,146,60,0.18)' }]}>
          <MaterialIcons name="local-fire-department" size={18} color="#FB923C" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.subheadline, { color: c.text, fontWeight: '800' }]}>
            {mode === 'household' ? 'Household streaks' : 'Your streak'}
          </Text>
          <Text style={[typography.caption1, { color: c.textMuted, marginTop: 2 }]}>
            {mode === 'household'
              ? 'Live from House Rules — daily & weekday jobs only'
              : `${self.streak} day${self.streak === 1 ? '' : 's'} · finish by keeps Late Credit safe`}
          </Text>
        </View>
        {mode === 'personal' ? (
          <Text style={[styles.bigStreak, { color: accentColor }]}>{self.streak}</Text>
        ) : null}
      </View>

      {mode === 'personal' ? (
        <View style={styles.personalDots}>
          <StreakDots
            constants={doc.constants}
            palette={palette}
            voice="sidekick"
            liveStreakDays={self.streak}
          />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {rows.map((row) => (
            <View
              key={row.id}
              style={[
                styles.chip,
                {
                  backgroundColor: row.isSelf ? `${accentColor}18` : glass(0.06),
                  borderColor: row.isSelf ? `${accentColor}55` : glassBorder(0.1),
                },
              ]}>
              <View style={[styles.avatar, { backgroundColor: `${accentColor}22` }]}>
                <Text style={[styles.avatarText, { color: accentColor }]}>{row.avatar}</Text>
              </View>
              <View style={{ minWidth: 0 }}>
                <Text style={[styles.chipName, { color: c.text }]} numberOfLines={1}>
                  {row.isSelf ? 'You' : row.name}
                </Text>
                <Text style={[styles.chipStreak, { color: row.streak > 0 ? '#FB923C' : c.textSubtle }]}>
                  {row.streak}d
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
    padding: space.md,
  },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  fireBadge: {
    alignItems: 'center',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  bigStreak: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  personalDots: {
    alignItems: 'flex-start',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minWidth: 108,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
  },
  chipName: {
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 72,
  },
  chipStreak: {
    fontSize: 12,
    fontWeight: '800',
  },
});
