/**
 * Champion's Record — Revision D §2.3.
 * Restricted metrics (late / expired / rescues) are omitted entirely for siblings.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { CROWN_COLORS } from '@/constants/crown-colors';
import { VOCAB } from '@/constants/vocabulary';
import { space, typography } from '@/constants/orbit-theme';
import {
  filterChampionsRecord,
  type ChampionsRecord,
} from '@/lib/scoring/crowns';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  visible: boolean;
  record: ChampionsRecord | null;
  viewer: { memberId: string; isAdmin: boolean };
  periodLabel?: string;
  onClose: () => void;
  onOpenLedger?: () => void;
};

function Row({ label, value }: { label: string; value: string }) {
  const { c } = useOrbitColors();
  return (
    <View style={styles.row}>
      <Text style={[typography.body, { color: c.textSoft }]}>{label}</Text>
      <Text style={[typography.body, { color: c.text, fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

export function ChampionsRecordSheet({
  visible,
  record,
  viewer,
  periodLabel,
  onClose,
  onOpenLedger,
}: Props) {
  const { c } = useOrbitColors();
  if (!record) return null;
  const view = filterChampionsRecord(record, viewer);
  const medalColor =
    view.medal === 'gold'
      ? CROWN_COLORS.gold
      : view.medal === 'silver'
        ? CROWN_COLORS.silver
        : view.medal === 'bronze'
          ? CROWN_COLORS.bronze
          : c.text;

  return (
    <BottomSheet visible={visible} onDismiss={onClose} heightRatio={0.62}>
      <PersistentScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <Text style={[typography.caption1, { color: c.textMuted }]}>
          {VOCAB.championsRecord}
          {periodLabel ? ` · ${periodLabel}` : ''}
        </Text>
        <Text style={[typography.title2, { color: c.text }]}>{view.name}</Text>
        <Text style={[typography.title3, { color: medalColor }]}>
          {view.rank != null ? `${view.rank}${ordinal(view.rank)} · ${view.netXp} XP` : `${view.netXp} XP`}
        </Text>

        <Row label="Tasks completed" value={String(view.tasksCompleted)} />
        <Row label="On time" value={String(view.onTimeCount)} />
        {'lateCount' in view && view.lateCount != null ? (
          <Row label="Late" value={String(view.lateCount)} />
        ) : null}
        {'expiredCount' in view && view.expiredCount != null ? (
          <Row label={VOCAB.expired} value={String(view.expiredCount)} />
        ) : null}
        <Row label="Current streak" value={`${view.currentStreak} days`} />
        {'streakRescuesUsed' in view && view.streakRescuesUsed != null ? (
          <Row label={`${VOCAB.streakRescue}s used`} value={String(view.streakRescuesUsed)} />
        ) : null}
        {view.bestDayLabel ? <Row label="Best day" value={view.bestDayLabel} /> : null}
        {view.busiestDomain ? <Row label="Busiest domain" value={view.busiestDomain} /> : null}

        {onOpenLedger ? (
          <Pressable onPress={onOpenLedger} style={styles.ledgerBtn}>
            <Text style={[typography.subheadline, { color: c.accent, fontWeight: '700' }]}>
              View XP ledger
            </Text>
          </Pressable>
        ) : null}
      </PersistentScrollView>
    </BottomSheet>
  );
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 420 },
  body: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  ledgerBtn: {
    alignItems: 'center',
    marginTop: space.md,
    paddingVertical: space.sm,
  },
});
