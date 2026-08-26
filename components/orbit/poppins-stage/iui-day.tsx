import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  dayNumber: number;
  weekday?: string;
  monthLabel?: string;
  accent: string;
};

/** Selected lattice cell expanding into the day. */
export function IuiDay({ dayNumber, weekday, monthLabel, accent }: Props) {
  const { c } = useOrbitColors();
  return (
    <View style={[styles.day, { backgroundColor: `${accent}28`, borderColor: `${accent}88` }]}>
      {weekday ? (
        <Text style={[styles.weekday, { color: c.textMuted }]}>{weekday}</Text>
      ) : null}
      <Text style={[styles.num, { color: c.text }]}>{dayNumber}</Text>
      {monthLabel ? (
        <Text style={[styles.month, { color: c.textSubtle }]}>{monthLabel}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  day: {
    width: 88,
    height: 88,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  num: { fontSize: 36, fontWeight: '300', letterSpacing: -1 },
  month: { fontSize: 11, marginTop: 2 },
});
