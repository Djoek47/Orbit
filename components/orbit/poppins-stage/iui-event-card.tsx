/**
 * WO12 §B1 — calendar event card. Clash line is computed on device.
 */
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { IuiCard } from '@/components/orbit/poppins-stage/iui-card';
import { IuiChips } from '@/components/orbit/poppins-stage/iui-chips';
import { IuiRow } from '@/components/orbit/poppins-stage/iui-row';
import { STAGE, stageMuted } from '@/constants/iui-stage';
import type { IuiPayload } from '@/lib/poppins/ui-scenes';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdEvent } from '@/types/orbit';

type Props = {
  payload: IuiPayload;
  accent: string;
  fillAccent?: string;
  hold: boolean;
  holdProgress: number;
  holding: boolean;
  frozen: boolean;
  dayEvents?: HouseholdEvent[];
};

function weekdayShort(date?: string, due?: string) {
  if (due && /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(due)) {
    return due.slice(0, 3).toUpperCase();
  }
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en', { weekday: 'short' }).toUpperCase();
}

function dayNum(date?: string) {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().getDate();
  return d.getDate();
}

function monthShort(date?: string) {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en', { month: 'short' }).toUpperCase();
}

/** On-device clash line — never asked of the model. */
export function eventClashLine(
  payload: IuiPayload,
  dayEvents: HouseholdEvent[] = []
): string {
  const title = (payload.title ?? '').trim().toLowerCase();
  const others = dayEvents.filter(
    (event) => event.title.trim().toLowerCase() !== title && event.date === payload.date
  );
  if (!others.length) return 'Nothing else that afternoon.';
  const names = others.slice(0, 2).map((event) => event.title);
  return `Clashes with ${names.join(' and ')}.`;
}

export function IuiEventCard({
  payload,
  accent,
  fillAccent,
  hold,
  holdProgress,
  holding,
  frozen,
  dayEvents = [],
}: Props) {
  const { c, isDark } = useOrbitColors();
  const muted = stageMuted(isDark);
  const fill = fillAccent ?? accent;
  const detail = [payload.assignee, payload.time].filter(Boolean).join(' · ');
  const clash = eventClashLine(payload, dayEvents);

  return (
    <IuiCard
      accent={accent}
      fillAccent={fill}
      kicker="Plan"
      hold={hold}
      holding={holding}
      holdProgress={holdProgress}
      frozen={frozen}
      leftFooter="Holding…"
      accessibilityLabel="Event card">
      <View style={styles.header}>
        <View style={[styles.dateBlock, { backgroundColor: `${fill}24` }]}>
          <Text style={[styles.weekday, { color: accent }]}>
            {weekdayShort(payload.date, payload.due)}
          </Text>
          <Text style={[styles.day, { color: c.text }]}>{dayNum(payload.date)}</Text>
          <Text style={[styles.month, { color: muted }]}>{monthShort(payload.date)}</Text>
        </View>
        <View style={styles.headerBody}>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
            {payload.title ?? 'Event'}
          </Text>
          {detail ? (
            <Text style={[styles.detail, { color: muted }]} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>

      {payload.location ? (
        <IuiRow title={payload.location} detail="Place" status="pending" accent={fill} allowDrop={false} />
      ) : null}

      <IuiChips
        chips={[
          { id: 'remind', label: 'Remind 1h before' },
          { id: 'travel', label: 'Add travel' },
          { id: 'tell', label: 'Tell someone' },
        ]}
        selectedId={payload.selectedChipId}
        accent={fill}
        onSelect={(id) => {
          poppinsUiOrchestrator.chooseFromTap({ selectedChipId: id }, id, 'event-chip');
        }}
      />

      <View style={styles.strip}>
        <View style={styles.bars}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  backgroundColor:
                    i === 2 ? `${fill}8C` : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,28,42,0.07)',
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.clash, { color: muted }]}>{clash}</Text>
      </View>
    </IuiCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 12, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center' },
  dateBlock: {
    width: 58,
    height: 62,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  day: { fontSize: 24, fontWeight: '700', lineHeight: 28 },
  month: { fontSize: 10, fontWeight: '600' },
  headerBody: { flex: 1, gap: 4 },
  title: { fontSize: 22, lineHeight: 27, fontWeight: '600', letterSpacing: -0.3 },
  detail: { fontSize: 13 },
  strip: { paddingHorizontal: 8, paddingTop: 8, gap: 6 },
  bars: { flexDirection: 'row', height: 44, gap: 4, alignItems: 'flex-end' },
  bar: { flex: 1, borderRadius: 6, minHeight: 12 },
  clash: { fontSize: 12 },
});
