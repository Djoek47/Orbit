import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { IuiPeekRow } from '@/lib/poppins/ui-scenes';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  rows: IuiPeekRow[];
  accent: string;
  highlightIndex?: number;
};

export function IuiPeek({ rows, accent, highlightIndex = 0 }: Props) {
  const { c, glassBorder } = useOrbitColors();
  return (
    <View style={styles.list}>
      {rows.slice(0, 3).map((row, i) => {
        const on = i <= highlightIndex;
        return (
          <View
            key={row.id}
            style={[
              styles.row,
              {
                borderColor: on ? `${accent}66` : glassBorder(0.08),
                backgroundColor: on ? `${accent}12` : 'transparent',
              },
            ]}>
            <Text style={[styles.title, { color: c.text }]}>{row.title}</Text>
            {row.detail ? (
              <Text style={[styles.detail, { color: c.textMuted }]}>{row.detail}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { width: '100%', gap: 8 },
  row: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  title: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 13, marginTop: 2 },
});
