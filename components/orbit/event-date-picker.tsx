import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  formatStoredDateLabel,
  startOfDayFromKey,
  todayKey,
  toDateKey,
  tomorrowKey,
} from '@/lib/calendar/event-date';
import {
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  monthGridDays,
  subMonths,
} from '@/lib/calendar/make-calendar';
import { radius, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text } from '@/components/orbit/app-text';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type EventDatePickerProps = {
  value: string;
  onChange: (dateKey: string) => void;
};

/** Month grid + Today/Tomorrow shortcuts. Stores YYYY-MM-DD, not relative labels. */
export function EventDatePicker({ value, onChange }: EventDatePickerProps) {
  const { c, glass, glassBorder } = useOrbitColors();
  const selected = useMemo(() => startOfDayFromKey(value), [value]);
  const [month, setMonth] = useState(selected);

  const days = useMemo(() => monthGridDays(month), [month]);
  const today = todayKey();
  const tomorrow = tomorrowKey();

  return (
    <View style={styles.wrap}>
      <View style={styles.shortcuts}>
        {[
          { key: today, label: 'Today' },
          { key: tomorrow, label: 'Tomorrow' },
        ].map((item) => {
          const active = value === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                onChange(item.key);
                setMonth(startOfDayFromKey(item.key));
              }}
              style={[
                styles.shortcut,
                {
                  backgroundColor: active ? `${c.primary}22` : glass(0.06),
                  borderColor: active ? `${c.primary}55` : glassBorder(0.12),
                },
              ]}>
              <Text style={[typography.caption1, { color: active ? c.primary : c.textMuted }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[typography.subheadline, { color: c.text, fontWeight: '700' }]}>
        {formatStoredDateLabel(value)}
      </Text>

      <View style={styles.monthHead}>
        <Pressable onPress={() => setMonth(subMonths(month, 1))} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={22} color={c.textMuted} />
        </Pressable>
        <Text style={[typography.headline, { color: c.text }]}>{format(month, 'MMMM yyyy')}</Text>
        <Pressable onPress={() => setMonth(addMonths(month, 1))} hitSlop={8}>
          <MaterialIcons name="chevron-right" size={22} color={c.textMuted} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((label) => (
          <Text key={label} style={[styles.weekday, { color: c.textSubtle }]}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day) => {
          const key = toDateKey(day);
          const inMonth = isSameMonth(day, month);
          const selectedDay = isSameDay(day, selected);
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              style={[
                styles.dayCell,
                selectedDay && { backgroundColor: `${c.primary}33`, borderColor: `${c.primary}66` },
                !inMonth && { opacity: 0.35 },
              ]}>
              <Text
                style={[
                  typography.caption1,
                  {
                    color: selectedDay ? c.primary : isToday(day) ? c.primary : c.text,
                    fontWeight: selectedDay || isToday(day) ? '700' : '500',
                  },
                ]}>
                {format(day, 'd')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  shortcuts: { flexDirection: 'row', gap: space.sm },
  shortcut: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  monthHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekday: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    width: `${100 / 7}%`,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: `${100 / 7}%`,
  },
});
