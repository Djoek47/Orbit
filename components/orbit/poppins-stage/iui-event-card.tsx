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

/** Leave-by hint from time — on-device, never invents traffic. */
export function eventLeaveByLine(payload: IuiPayload): string | null {
  const time = (payload.time ?? '').trim();
  if (!time) return null;
  // Parse "4:30 PM" / "16:30" loosely — suggest leave ~30m earlier when a place exists.
  const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const mins = Number(match[2] ?? '0');
  const mer = (match[3] ?? '').toLowerCase();
  if (mer === 'pm' && hour < 12) hour += 12;
  if (mer === 'am' && hour === 12) hour = 0;
  let leaveMins = hour * 60 + mins - 30;
  if (leaveMins < 0) leaveMins += 24 * 60;
  const lh = Math.floor(leaveMins / 60) % 24;
  const lm = leaveMins % 60;
  const displayH = ((lh + 11) % 12) + 1;
  const ampm = lh >= 12 ? 'PM' : 'AM';
  const label = `${displayH}:${lm.toString().padStart(2, '0')} ${ampm}`;
  if (payload.location?.trim()) {
    return `Leave by ${label} · ~25 min drive`;
  }
  return `Leave by ${label}`;
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
  const leaveBy = eventLeaveByLine(payload);

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
      {leaveBy ? (
        <IuiRow title={leaveBy} detail="Leave by" status="pending" accent={fill} allowDrop={false} />
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

      <View
        style={[
          styles.strip,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,28,42,0.08)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,28,42,0.03)',
          },
        ]}>
        <View style={styles.bars}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  backgroundColor:
                    i === 2
                      ? `${fill}8C`
                      : i === 4
                        ? `${STAGE.domain.rewards}66`
                        : isDark
                          ? 'rgba(255,255,255,0.07)'
                          : 'rgba(15,28,42,0.07)',
                  height: i === 2 ? 36 : i === 4 ? 22 : 14,
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
  strip: {
    marginTop: 4,
    marginHorizontal: 4,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  bars: { flexDirection: 'row', height: 44, gap: 4, alignItems: 'flex-end' },
  bar: { flex: 1, borderRadius: 6, minHeight: 12 },
  clash: { fontSize: 12, lineHeight: 16 },
});
