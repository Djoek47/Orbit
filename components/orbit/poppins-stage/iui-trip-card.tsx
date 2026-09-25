/**
 * WO12 §B2 — trip card with rail + rows. Unresolved address never blocks hold.
 */
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { IuiCard } from '@/components/orbit/poppins-stage/iui-card';
import { IuiChips } from '@/components/orbit/poppins-stage/iui-chips';
import { IuiRow } from '@/components/orbit/poppins-stage/iui-row';
import { STAGE, stageMuted } from '@/constants/iui-stage';
import type { IuiPayload, IuiStop } from '@/lib/poppins/ui-scenes';
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
  groceryCount?: number;
};

function placeLine(stop: IuiStop, groceryCount: number): { detail: string; warning?: boolean; shop?: boolean } {
  const isShop =
    String(stop.kind ?? stop.category ?? '').toLowerCase().includes('shop') ||
    String(stop.kind ?? '').toLowerCase() === 'grocery' ||
    stop.emoji === '🛒';
  if (isShop && groceryCount > 0) {
    return {
      detail: `Your list comes along · ${groceryCount} item${groceryCount === 1 ? '' : 's'}`,
      shop: true,
    };
  }
  if (stop.needsAddress || (!stop.address?.trim() && !stop.placeQuery?.trim())) {
    return { detail: 'Which address? tap to set', warning: true };
  }
  const place = stop.address?.trim() || stop.placeQuery?.trim() || '';
  if (place && place.toLowerCase() === stop.label.trim().toLowerCase()) {
    return { detail: stop.time ?? '' };
  }
  return { detail: [stop.time, place].filter(Boolean).join(' · ') };
}

export function IuiTripCard({
  payload,
  accent,
  fillAccent,
  hold,
  holdProgress,
  holding,
  frozen,
  groceryCount = 0,
}: Props) {
  const { c, isDark } = useOrbitColors();
  const muted = stageMuted(isDark);
  const fill = fillAccent ?? accent;
  const stops = payload.stops ?? [];

  return (
    <IuiCard
      accent={accent}
      fillAccent={fill}
      kicker="Trip"
      countLabel={stops.length ? `${stops.length} stops` : undefined}
      hold={hold}
      holding={holding}
      holdProgress={holdProgress}
      frozen={frozen}
      leftFooter="Holding…"
      rightFooter="unresolved address ok"
      accessibilityLabel="Trip card">
      <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
        {payload.itineraryTitle ?? 'Trip'}
      </Text>

      <View style={styles.railWrap}>
        <View style={styles.rail}>
          <View style={[styles.railDot, { backgroundColor: fill }]} />
          <View
            style={[
              styles.railLine,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,28,42,0.12)',
              },
            ]}
          />
          <View
            style={[
              styles.railDotEnd,
              { borderColor: fill },
            ]}
          />
        </View>
        <View style={styles.stopList}>
          {stops.map((stop) => {
            const place = placeLine(stop, groceryCount);
            return (
              <IuiRow
                key={stop.id}
                title={stop.label}
                detail={place.detail || undefined}
                trailing={stop.time}
                status={place.warning ? 'failed' : 'pending'}
                accent={place.shop ? STAGE.domain.chores : fill}
                allowDrop={false}
                onPress={() => {
                  poppinsUiOrchestrator.chooseFromTap(
                    { stops: payload.stops, selectedChipId: stop.id },
                    stop.label,
                    'stop'
                  );
                }}
              />
            );
          })}
        </View>
      </View>

      <IuiChips
        chips={[
          { id: 'reorder', label: 'Reorder' },
          { id: 'add-stop', label: 'Add a stop' },
          { id: 'tomorrow', label: 'Tomorrow' },
        ]}
        selectedId={payload.selectedChipId}
        accent={fill}
        onSelect={(id) => {
          if (id === 'tomorrow') {
            poppinsUiOrchestrator.chooseFromTap({ due: 'Tomorrow', date: undefined }, id, 'trip-chip');
            return;
          }
          poppinsUiOrchestrator.chooseFromTap({ selectedChipId: id }, id, 'trip-chip');
        }}
      />
      {!stops.length ? (
        <Text style={[styles.empty, { color: muted }]}>Say the stops in order.</Text>
      ) : null}
    </IuiCard>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  railWrap: { flexDirection: 'row', gap: 8 },
  rail: {
    width: 14,
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 18,
  },
  railDot: { width: 9, height: 9, borderRadius: 5 },
  railDotEnd: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  railLine: { flex: 1, width: 2, marginVertical: 4, borderRadius: 1 },
  stopList: { flex: 1, gap: 3 },
  empty: { fontSize: 13, paddingHorizontal: 8, paddingTop: 4 },
});
