import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { motionDuration } from '@/constants/motion-tokens';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  monthLabel: string;
  dayNumber: number;
  accent: string;
};

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function IuiLattice({ monthLabel, dayNumber, accent }: Props) {
  const { c, glassBorder } = useOrbitColors();
  const cells = Array.from({ length: 28 }, (_, i) => i + 1);
  return (
    <View style={styles.wrap}>
      <Text style={[styles.month, { color: c.textMuted }]}>{monthLabel}</Text>
      <View style={styles.week}>
        {DAYS.map((d) => (
          <Text key={d} style={[styles.dow, { color: c.textSubtle }]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((n) => {
          const selected = n === dayNumber;
          return (
            <Animated.View
              key={n}
              entering={selected ? ZoomIn.duration(motionDuration.snappy) : FadeIn.duration(80)}
              style={[
                styles.cell,
                selected && {
                  backgroundColor: `${accent}33`,
                  borderColor: `${accent}88`,
                },
                !selected && { borderColor: glassBorder(0.04) },
              ]}>
              <Text style={[styles.num, { color: selected ? c.text : c.textSubtle }]}>{n}</Text>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, alignItems: 'center' },
  month: { fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600' },
  week: { flexDirection: 'row', width: 252, justifyContent: 'space-between', paddingHorizontal: 6 },
  dow: { width: 32, textAlign: 'center', fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 252, gap: 4 },
  cell: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: { fontSize: 13, fontWeight: '500' },
});
