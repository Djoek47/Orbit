/**
 * WO12 §B — grocery and batch rows via IuiCard + IuiRow.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { IuiCard } from '@/components/orbit/poppins-stage/iui-card';
import { IuiRow } from '@/components/orbit/poppins-stage/iui-row';
import { IuiTroubleRowFailed } from '@/components/orbit/poppins-stage/iui-trouble';
import { STAGE, stageMuted } from '@/constants/iui-stage';
import type { IuiGroupItem, IuiPayload } from '@/lib/poppins/ui-scenes';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  payload: IuiPayload;
  accent: string;
  hold: boolean;
  holdProgress: number;
  holding: boolean;
  frozen: boolean;
  queued?: IuiGroupItem[];
  countLabel?: string;
  onAddNow?: () => void;
  onNotThat?: () => void;
};

export function IuiGroceryCard({
  payload,
  accent,
  hold,
  holdProgress,
  holding,
  frozen,
  queued = [],
  countLabel,
  onAddNow,
  onNotThat,
}: Props) {
  const { isDark, c } = useOrbitColors();
  const muted = stageMuted(isDark);
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
  const single = items.length === 1 && !payload.items?.length;
  const failed = items.filter((item) => item.status === 'failed');
  const done = items.filter((item) => item.status === 'done');
  const failedPrimary = failed[0];

  return (
    <View style={styles.wrap}>
      <IuiCard
        accent={accent}
        kicker={payload.shoppingLane === 'clothing' ? 'Shopping' : 'Groceries'}
        countLabel={countLabel ?? (multi ? `${items.length} items` : undefined)}
        hold={hold}
        holding={holding}
        holdProgress={holdProgress}
        frozen={frozen}
        leftFooter={multi ? 'One hold for all' : 'Holding…'}
        rightFooter={multi ? 'tap × to drop one' : undefined}
        accessibilityLabel="Grocery card">
        {single ? (
          <View style={styles.single}>
            <View
              style={[
                styles.tile,
                { backgroundColor: `${accent}24`, borderColor: `${accent}38` },
              ]}>
              <Text style={styles.tileGlyph}>{payload.shoppingLane === 'clothing' ? '👟' : '🛒'}</Text>
            </View>
            <Text style={[styles.singleTitle, { color: c.text }]} numberOfLines={2}>
              {items[0]?.label}
            </Text>
            {items[0]?.aisle || payload.aisle ? (
              <Text style={[styles.singleDetail, { color: muted }]}>
                {items[0]?.aisle ?? payload.aisle}
              </Text>
            ) : null}
          </View>
        ) : (
          items.map((item, index) => (
            <IuiRow
              key={item.id}
              title={item.label}
              detail={item.aisle}
              status={item.status}
              active={index === items.length - 1 && item.status === 'pending'}
              accent={accent}
              allowDrop={holding || hold}
              onDrop={() => poppinsUiOrchestrator.dropGroupItem(item.id)}
            />
          ))
        )}
      </IuiCard>

      {failedPrimary ? (
        <IuiTroubleRowFailed
          accent={accent}
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
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,28,42,0.03)',
            },
          ]}>
          <View style={[styles.queueTile, { backgroundColor: `${accent}33` }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.queueKicker, { color: STAGE.text.faintDark }]}>
              NEXT, ON ITS OWN CARD
            </Text>
            <Text style={[styles.queueTitle, { color: c.text }]} numberOfLines={1}>
              {queued[0]?.label}
              {queued[0]?.assignee ? ` → ${queued[0].assignee}` : ''}
              {queued[0]?.due ? ` · ${queued[0].due}` : ''}
            </Text>
          </View>
        </View>
      ) : null}

      {single && (onAddNow || onNotThat) ? (
        <View style={styles.actions}>
          {onAddNow ? (
            <Pressable
              onPress={onAddNow}
              accessibilityRole="button"
              accessibilityLabel="Add now"
              style={[styles.primaryBtn, { backgroundColor: accent }]}>
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
                { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,28,42,0.05)' },
              ]}>
              <Text style={[styles.secondaryLabel, { color: c.text }]}>Not that</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 12, alignItems: 'center' },
  single: { alignItems: 'center', paddingVertical: 8, gap: 8 },
  tile: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileGlyph: { fontSize: 24 },
  singleTitle: { fontSize: 30, lineHeight: 34, fontWeight: '600', letterSpacing: -0.4, textAlign: 'center' },
  singleDetail: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
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
  queueTile: { width: 26, height: 26, borderRadius: 8 },
  queueKicker: { fontSize: 11, letterSpacing: 1.1, fontWeight: '600' },
  queueTitle: { fontSize: 14, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryBtn: {
    minHeight: 44,
    borderRadius: STAGE.radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  primaryLabel: { color: '#061424', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    minHeight: 44,
    borderRadius: STAGE.radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  secondaryLabel: { fontWeight: '600', fontSize: 15 },
});
