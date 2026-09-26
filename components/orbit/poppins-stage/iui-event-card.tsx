/**
 * The calendar event card (design: "IUI — a calendar event").
 *
 *   ┌ THU ┐  Dentist
 *   │  2  │  Noah · 4:30 – 5:15 PM
 *   └ OCT ┘
 *   ⌖ Clinique Papineau
 *   ◷ Leave at 4:00 · 30 min before
 *   (Remind 1h before) (Add travel) (Tell Ama)
 *   THAT AFTERNOON  ▁▁ ▂▂ ███ ▁ ▃▃ ▁   Clashes with nothing. Mia's piano is next, at 6 PM.
 *   ─────────────── Quiet saves it to the family calendar
 *
 * A missing day or time is asked right on the card with chips — never guessed — and the
 * hold doesn't start until both are there. Everything here is computed on device.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { DayStrip } from '@/components/orbit/event/day-strip';
import { IuiCard } from '@/components/orbit/poppins-stage/iui-card';
import { IuiEditableTitle } from '@/components/orbit/poppins-stage/iui-editable-title';
import { STAGE, stageBorder, stageFaint, stageMuted } from '@/constants/iui-stage';
import { dayStripItems, hhmmToMinutes, layoutDayStrip, timeRangeLabel } from '@/lib/calendar/day-strip';
import { eventLeaveByLine } from '@/lib/poppins/event-leave-by';
import type { IuiPayload } from '@/lib/poppins/ui-scenes';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import {
  addMinutesToTime,
  dateKey as toDateKey,
  dateTileParts,
  formatTime12,
  friendlyDay,
} from '@/lib/poppins/when-parse';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdEvent } from '@/types/orbit';

export { eventLeaveByLine };

type Props = {
  payload: IuiPayload;
  accent: string;
  fillAccent?: string;
  hold: boolean;
  holdProgress: number;
  holding: boolean;
  frozen: boolean;
  dayEvents?: HouseholdEvent[];
  /** Another adult the "Tell …" chip can add. */
  tellCandidate?: string;
};

/** Kept for callers and tests: the one-line clash sentence for the card's day. */
export function eventClashLine(payload: IuiPayload, dayEvents: HouseholdEvent[] = []): string {
  if (!payload.date) return '';
  const start = hhmmToMinutes(payload.time);
  const end = hhmmToMinutes(payload.endTime);
  const others = dayStripItems(dayEvents, payload.date).filter(
    (item) => item.title.trim().toLowerCase() !== (payload.title ?? '').trim().toLowerCase()
  );
  return layoutDayStrip(
    { title: payload.title ?? 'Event', start: start ?? undefined, end: end ?? undefined, allDay: payload.allDay },
    others
  ).sentence;
}

function dayChoices(now = new Date()): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = [];
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const key = toDateKey(d);
    const label = i < 2 ? friendlyDay(key, now) : d.toLocaleString('en', { weekday: 'short' });
    out.push({ id: key, label });
  }
  return out;
}

const TIME_CHOICES = [
  { id: '09:00', label: '9 AM' },
  { id: '12:00', label: 'Noon' },
  { id: '16:00', label: '4 PM' },
  { id: '18:00', label: '6 PM' },
  { id: 'allday', label: 'All day' },
];

function Pill({
  label,
  selected,
  fill,
  onPress,
}: {
  label: string;
  selected?: boolean;
  fill: string;
  onPress: () => void;
}) {
  const { c, isDark } = useOrbitColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      accessibilityLabel={label}
      hitSlop={4}
      style={[
        styles.pill,
        selected
          ? { backgroundColor: fill, borderColor: fill }
          : {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,28,42,0.04)',
              borderColor: stageBorder(isDark),
            },
      ]}>
      <Text style={[styles.pillLabel, { color: selected ? STAGE.ink.onAccent : c.text }]}>{label}</Text>
    </Pressable>
  );
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
  tellCandidate,
}: Props) {
  const { c, isDark } = useOrbitColors();
  const muted = stageMuted(isDark);
  const faint = stageFaint(isDark);
  const fill = fillAccent ?? accent;
  const tile = dateTileParts(payload.date);
  const needsDay = !payload.date;
  const needsTime = !needsDay && !payload.time && !payload.allDay;
  const ready = !needsDay && !needsTime;

  const range = payload.allDay ? 'All day' : timeRangeLabel(payload.time, payload.endTime);
  const detail = [payload.assignee, range, payload.withWho?.length ? `with ${payload.withWho.join(' & ')}` : '']
    .filter(Boolean)
    .join(' · ');
  const leaveBy = payload.location && !payload.allDay ? eventLeaveByLine(payload) : null;

  const start = hhmmToMinutes(payload.time);
  const end = hhmmToMinutes(payload.endTime);
  const strip = payload.date
    ? layoutDayStrip(
        { title: payload.title ?? 'Event', start: start ?? undefined, end: end ?? undefined, allDay: payload.allDay },
        dayStripItems(dayEvents, payload.date).filter(
          (item) => item.title.trim().toLowerCase() !== (payload.title ?? '').trim().toLowerCase()
        )
      )
    : null;

  const patch = (next: Partial<IuiPayload>, text: string) => {
    const date = next.date ?? payload.date;
    const timed = Boolean(next.time ?? payload.time) || Boolean(next.allDay ?? payload.allDay);
    poppinsUiOrchestrator.chooseFromTap(
      {
        ...next,
        composeReady: Boolean(date) && timed,
        focusSlot: !date ? 'date' : !timed ? 'time' : null,
      },
      text,
      'event-slot'
    );
  };

  const flipped =
    payload.timeGuessed && payload.time && !payload.allDay
      ? addMinutesToTime(payload.time, Number(payload.time.slice(0, 2)) >= 12 ? -12 * 60 : 12 * 60)
      : null;

  return (
    <IuiCard
      accent={accent}
      fillAccent={fill}
      kicker="Plan"
      hold={hold && ready}
      holding={holding}
      holdProgress={holdProgress}
      frozen={frozen}
      leftFooter={
        !ready
          ? needsDay
            ? 'Pick a day — or just say it'
            : 'Pick a time — or just say it'
          : holding
            ? 'Saving to the family calendar…'
            : 'Quiet saves it to the family calendar'
      }
      accessibilityLabel={`Event: ${payload.title ?? 'Event'}${detail ? `, ${detail}` : ''}`}>
      <View style={styles.header}>
        <View
          style={[
            styles.dateBlock,
            { backgroundColor: `${fill}24`, borderColor: `${fill}55` },
            needsDay && { borderStyle: 'dashed' },
          ]}>
          <Text style={[styles.weekday, { color: accent }]}>{tile?.weekday ?? 'DAY'}</Text>
          <Text style={[styles.day, { color: tile ? c.text : faint }]}>{tile?.day ?? '?'}</Text>
          <Text style={[styles.month, { color: muted }]}>{tile?.month ?? ''}</Text>
        </View>
        <View style={styles.headerBody}>
          <IuiEditableTitle title={payload.title ?? 'Event'} style={[styles.title, { color: c.text }]} />
          {detail ? (
            <Text style={[styles.detail, { color: muted }]} numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>

      {needsDay ? (
        <View style={styles.slot}>
          <Text style={[styles.slotAsk, { color: c.text }]}>What day?</Text>
          <View style={styles.pills}>
            {dayChoices().map((choice) => (
              <Pill key={choice.id} label={choice.label} fill={fill} onPress={() => patch({ date: choice.id }, choice.label)} />
            ))}
          </View>
        </View>
      ) : needsTime ? (
        <View style={styles.slot}>
          <Text style={[styles.slotAsk, { color: c.text }]}>What time?</Text>
          <View style={styles.pills}>
            {TIME_CHOICES.map((choice) => (
              <Pill
                key={choice.id}
                label={choice.label}
                fill={fill}
                onPress={() =>
                  choice.id === 'allday'
                    ? patch({ allDay: true, time: '', endTime: undefined }, choice.label)
                    : patch({ time: choice.id, endTime: addMinutesToTime(choice.id, 60), allDay: false }, choice.label)
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {flipped ? (
        <Pressable
          onPress={() =>
            patch(
              {
                time: flipped,
                endTime: payload.endTime
                  ? addMinutesToTime(payload.endTime, Number(payload.time!.slice(0, 2)) >= 12 ? -12 * 60 : 12 * 60)
                  : undefined,
                timeGuessed: false,
              },
              formatTime12(flipped)
            )
          }
          accessibilityRole="button"
          style={styles.flip}>
          <Text style={[styles.flipText, { color: muted }]}>
            Meant {formatTime12(flipped)}? <Text style={{ color: accent }}>Tap to switch</Text>
          </Text>
        </Pressable>
      ) : null}

      {payload.location || leaveBy ? (
        <View style={[styles.rows, { borderTopColor: stageBorder(isDark) }]}>
          {payload.location ? (
            <View style={styles.row}>
              <MaterialIcons name="place" size={16} color={muted} />
              <Text style={[styles.rowText, { color: c.text }]} numberOfLines={2}>
                {payload.location}
              </Text>
            </View>
          ) : null}
          {leaveBy ? (
            <View style={styles.row}>
              <MaterialIcons name="schedule" size={16} color={muted} />
              <Text style={[styles.rowText, { color: c.text }]}>{leaveBy}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {ready ? (
        <View style={[styles.pills, styles.chipRow]}>
          {!payload.allDay ? (
            <Pill
              label="Remind 1h before"
              selected={payload.remind !== false}
              fill={fill}
              onPress={() => patch({ remind: payload.remind === false }, 'remind')}
            />
          ) : null}
          {!payload.allDay ? (
            <Pill
              label="Add travel"
              selected={payload.addTravel === true}
              fill={fill}
              onPress={() => patch({ addTravel: !payload.addTravel }, 'travel')}
            />
          ) : null}
          {tellCandidate ? (
            <Pill
              label={`Tell ${tellCandidate}`}
              selected={payload.tellWho === tellCandidate}
              fill={fill}
              onPress={() =>
                patch({ tellWho: payload.tellWho === tellCandidate ? undefined : tellCandidate }, 'tell')
              }
            />
          ) : null}
        </View>
      ) : null}

      {strip ? (
        <View style={styles.stripWrap}>
          <DayStrip layout={strip} fill={fill} />
        </View>
      ) : null}
    </IuiCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 14, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center' },
  dateBlock: {
    width: 60,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  day: { fontSize: 24, fontWeight: '700', lineHeight: 28 },
  month: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6 },
  headerBody: { flex: 1, gap: 4 },
  title: { fontSize: 22, lineHeight: 27, fontWeight: '600', letterSpacing: -0.3 },
  detail: { fontSize: 13, lineHeight: 18 },
  slot: { paddingHorizontal: 8, paddingTop: 6, gap: 8 },
  slotAsk: { fontSize: 15, fontWeight: '600' },
  flip: { paddingHorizontal: 8, paddingTop: 2 },
  flipText: { fontSize: 12 },
  rows: {
    marginTop: 8,
    marginHorizontal: 8,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { fontSize: 14, flex: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRow: { paddingHorizontal: 8, paddingTop: 12 },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  pillLabel: { fontSize: 13, fontWeight: '600' },
  stripWrap: { marginTop: 10, marginHorizontal: 4 },
});
