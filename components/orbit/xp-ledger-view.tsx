/**
 * XP Ledger view — Revision D §1.6.
 * Grouped by day; negatives muted (not red); late shows "was N".
 */

import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { VOCAB } from '@/constants/vocabulary';
import { space, typography } from '@/constants/orbit-theme';
import type { XpLedgerEntry } from '@/lib/streaks/xp-ledger';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  entries: XpLedgerEntry[];
  /** Map occurrenceId → full XP before Late Credit (for "was N"). */
  fullXpByOccurrence?: Record<string, number>;
};

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
  } catch {
    return dayKey(iso);
  }
}

export function XpLedgerView({ entries, fullXpByOccurrence }: Props) {
  const { c } = useOrbitColors();

  if (entries.length === 0) {
    return (
      <Text style={[typography.body, { color: c.textMuted }]}>Nothing yet this week.</Text>
    );
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );
  const byDay = new Map<string, XpLedgerEntry[]>();
  for (const e of sorted) {
    const k = dayKey(e.occurredAt);
    const list = byDay.get(k) ?? [];
    list.push(e);
    byDay.set(k, list);
  }

  const weekTotal = sorted.reduce((s, e) => s + e.delta, 0);

  return (
    <View style={styles.stack}>
      <Text style={[typography.caption1, { color: c.textMuted }]}>THIS WEEK</Text>
      {[...byDay.entries()].map(([day, list]) => (
        <View key={day} style={styles.dayBlock}>
          {list.map((e) => {
            const was =
              e.type === 'late_credit' && e.occurrenceId && fullXpByOccurrence?.[e.occurrenceId]
                ? fullXpByOccurrence[e.occurrenceId]
                : e.type === 'task_completed' &&
                    e.occurrenceId &&
                    fullXpByOccurrence?.[e.occurrenceId] &&
                    fullXpByOccurrence[e.occurrenceId]! > e.delta
                  ? fullXpByOccurrence[e.occurrenceId]
                  : undefined;
            const negative = e.delta < 0;
            return (
              <View key={e.id} style={styles.row}>
                <Text style={[typography.caption1, styles.day, { color: c.textSubtle }]}>
                  {dayLabel(e.occurredAt)}
                </Text>
                <Text style={[typography.body, styles.label, { color: c.text }]} numberOfLines={1}>
                  {e.label}
                  {was != null ? (
                    <Text style={{ color: c.textMuted }}> · {VOCAB.lateCredit.toLowerCase()}</Text>
                  ) : null}
                </Text>
                <Text
                  style={[
                    typography.subheadline,
                    { color: negative ? c.textMuted : c.text, fontWeight: '700' },
                  ]}
                >
                  {e.delta > 0 ? `+${e.delta}` : String(e.delta)}
                </Text>
                {was != null ? (
                  <Text style={[typography.caption2, { color: c.textSubtle }]}>was {was}</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={[typography.subheadline, { color: c.textSoft }]}>Week total</Text>
        <Text style={[typography.subheadline, { color: c.text, fontWeight: '800' }]}>{weekTotal}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  dayBlock: { gap: 4 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  day: { width: 36 },
  label: { flex: 1 },
  totalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.sm,
    paddingTop: space.sm,
  },
});
