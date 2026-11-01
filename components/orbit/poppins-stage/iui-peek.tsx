import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { IuiPeekRow } from '@/lib/poppins/ui-scenes';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  rows: IuiPeekRow[];
  accent: string;
  highlightIndex?: number;
  /** Rows shown (default 3). */
  max?: number;
  /** Rows become buttons ("which one?"). */
  onPress?: (row: IuiPeekRow) => void;
};

export function IuiPeek({ rows, accent, highlightIndex = 0, max = 3, onPress }: Props) {
  const { c, glassBorder } = useOrbitColors();
  return (
    <View style={styles.list}>
      {rows.slice(0, max).map((row, i) => {
        const on = !onPress && i <= highlightIndex;
        const Row = onPress ? Pressable : View;
        return (
          <Row
            key={row.id}
            onPress={onPress ? () => onPress(row) : undefined}
            accessible
            accessibilityRole={onPress ? 'button' : 'text'}
            accessibilityLabel={`${row.title}${row.detail ? `, ${row.detail}` : ''}${on ? ', highlighted' : ''}`}
            accessibilityState={{ selected: on }}
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
          </Row>
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
