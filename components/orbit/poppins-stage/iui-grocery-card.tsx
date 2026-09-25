/**
 * WO12 §B — grocery and batch rows via IuiCard + IuiRow.
 * Main board: single item is a horizontal object tile.
 * Batch board: N rows + one hold + dashed queue row with ×.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { Moji } from '@/components/orbit/moji/moji';
import { AppText as Text } from '@/components/orbit/app-text';
import { IuiCard } from '@/components/orbit/poppins-stage/iui-card';
import { IuiRow } from '@/components/orbit/poppins-stage/iui-row';
import { IuiTroubleRowFailed } from '@/components/orbit/poppins-stage/iui-trouble';
import { STAGE, stageBorder, stageFaint, stageMuted } from '@/constants/iui-stage';
import type { IuiGroupItem, IuiPayload } from '@/lib/poppins/ui-scenes';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  payload: IuiPayload;
  accent: string;
  fillAccent?: string;
  hold: boolean;
  holdProgress: number;
  holding: boolean;
  frozen: boolean;
  queued?: IuiGroupItem[];
  countLabel?: string;
  onAddNow?: () => void;
  onNotThat?: () => void;
  onDropQueued?: (id: string) => void;
};

export function IuiGroceryCard({
  payload,
  accent,
  fillAccent,
  hold,
  holdProgress,
  holding,
  frozen,
  queued = [],
  countLabel,
  onAddNow,
  onNotThat,
  onDropQueued,
}: Props) {
  const { isDark, c } = useOrbitColors();
  const muted = stageMuted(isDark);
  const faint = stageFaint(isDark);
  const fill = fillAccent ?? accent;
  const items =
    payload.items && payload.items.length > 0
      ? payload.items.filter((item) => !item.dropped)
      : payload.groceryName || payload.title
        ? [
            {
              id: 'single',
              label: payload.groceryName ?? payload.title ?? '',
              aisle: payload.aisle,
              status: 'pending' as const,
            },
          ]
        : [];
  const multi = items.length > 1;
  const single = items.length === 1 && !(payload.items && payload.items.length > 1);
  const failed = items.filter((item) => item.status === 'failed');
  const done = items.filter((item) => item.status === 'done');
  const failedPrimary = failed[0];
  const aisleLine = items[0]?.aisle ?? payload.aisle;
  const storeLine = payload.location?.trim() || undefined;
  const detail = [aisleLine, storeLine].filter(Boolean).join(' · ') || undefined;

  return (
    <View style={styles.wrap}>
      <IuiCard
        accent={accent}
        fillAccent={fill}
        kicker={payload.shoppingLane === 'clothing' ? 'Shopping' : 'Groceries'}
        countLabel={countLabel ?? (multi ? `${items.length} items` : undefined)}
        hold={hold}
        holding={holding}
        holdProgress={holdProgress}
        frozen={frozen}
        leftFooter={
          multi
            ? `One hold for all ${items.length === 3 ? 'three' : items.length}`
            : 'Quiet adds it'
        }
        rightFooter={multi ? 'tap × to drop one' : 'speak or tap to change'}
        accessibilityLabel="Grocery card">
        {single ? (
          <View style={styles.singleRow}>
            <View
              style={[
                styles.tile,
                { backgroundColor: `${fill}24`, borderColor: `${fill}38` },
              ]}>
              <Moji name={payload.shoppingLane === 'clothing' ? 'sneaker' : 'cart'} size={26} />
            </View>
            <View style={styles.singleBody}>
              <Text style={[styles.singleTitle, { color: c.text }]} numberOfLines={2}>
                {items[0]?.label}
              </Text>
              {detail ? (
                <Text style={[styles.singleDetail, { color: muted }]} numberOfLines={2}>
                  {detail}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          items.map((item, index) => (
            <IuiRow
              key={item.id}
              title={item.label}
              trailing={item.aisle}
              detail={storeLine && index === 0 ? storeLine : undefined}
              status={item.status}
              active={index === items.length - 1 && item.status === 'pending'}
              accent={fill}
              allowDrop={holding || hold}
              onDrop={() => poppinsUiOrchestrator.dropGroupItem(item.id)}
            />
          ))
        )}
      </IuiCard>

      {failedPrimary ? (
        <IuiTroubleRowFailed
          accent={fill}
          failedLabel={failedPrimary.label}
          savedLine={
            done.length
              ? `${done.map((item) => item.label).join(' and ')} ${done.length === 1 ? 'is' : 'are'} on the list. Only ${failedPrimary.label.toLowerCase()} came back.`
              : `Only ${failedPrimary.label.toLowerCase()} came back.`
          }
          onRetry={() => {
            poppinsUiOrchestrator.patchGroupItemStatus(failedPrimary.id, 'pending');
            void poppinsUiOrchestrator.confirm({ fromTap: true });
          }}
          onLeave={() => {
            poppinsUiOrchestrator.dropGroupItem(failedPrimary.id);
            poppinsUiOrchestrator.dismissFailed();
          }}
        />
      ) : null}

      {queued.length ? (
        <View
          style={[
            styles.queue,
            {
              borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,28,42,0.14)',
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,28,42,0.02)',
            },
          ]}>
          <View style={[styles.queueTile, { backgroundColor: `${fill}1F` }]}>
            <Text style={{ color: fill, fontSize: 14, fontWeight: '700' }}>✓</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.queueKicker, { color: faint }]}>NEXT, ON ITS OWN CARD</Text>
            <Text style={[styles.queueTitle, { color: isDark ? STAGE.ink.softDark : c.text }]} numberOfLines={1}>
              {queued[0]?.label}
              {queued[0]?.assignee ? ` → ${queued[0].assignee}` : ''}
              {queued[0]?.due ? ` · ${queued[0].due}` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              const id = queued[0]?.id;
              if (!id) return;
              if (onDropQueued) onDropQueued(id);
              else poppinsUiOrchestrator.dropQueuedBeat(id);
            }}
            accessibilityRole="button"
            accessibilityLabel="Drop the next card"
            style={styles.queueDrop}>
            <Text style={[styles.queueDropMark, { color: faint }]}>×</Text>
          </Pressable>
        </View>
      ) : null}

      {single && (onAddNow || onNotThat) ? (
        <View style={styles.actions}>
          {onAddNow ? (
            <Pressable
              onPress={onAddNow}
              accessibilityRole="button"
              accessibilityLabel="Add now"
              style={[styles.primaryBtn, { backgroundColor: fill }]}>
              <Text style={styles.primaryLabel}>Add now</Text>
            </Pressable>
          ) : null}
          {onNotThat ? (
            <Pressable
              onPress={onNotThat}
              accessibilityRole="button"
              accessibilityLabel="Not that"
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,28,42,0.05)',
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,28,42,0.10)',
                },
              ]}>
              <Text style={[styles.secondaryLabel, { color: isDark ? STAGE.ink.softDark : c.text }]}>
                Not that
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 12, alignItems: 'center' },
  singleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  tile: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleBody: { flex: 1, gap: 3, minWidth: 0 },
  singleTitle: { fontSize: 30, lineHeight: 34, fontWeight: '600', letterSpacing: -0.4 },
  singleDetail: { fontSize: 13, lineHeight: 18 },
  queue: {
    width: '100%',
    maxWidth: 360,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  queueTile: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueKicker: { fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  queueTitle: { fontSize: 14, marginTop: 2 },
  queueDrop: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
  queueDropMark: { fontSize: 22, fontWeight: '400', lineHeight: 24 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  primaryBtn: {
    minHeight: 44,
    borderRadius: STAGE.radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  primaryLabel: { color: STAGE.ink.onAccent, fontWeight: '700', fontSize: 13 },
  secondaryBtn: {
    minHeight: 44,
    borderRadius: STAGE.radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryLabel: { fontWeight: '600', fontSize: 13 },
});
