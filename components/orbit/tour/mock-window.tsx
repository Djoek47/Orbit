/**
 * A fake window.
 *
 * The tour's demonstrations are drawn, not driven: a bezel with a title bar and a line under it
 * saying so. That line matters — someone watching has to know this isn't their house, or they'll
 * look for the bins task afterwards and not find it.
 */
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';

export function MockWindow({
  title,
  tone,
  /** Overrides the default "An example — nothing here is saved". */
  caption,
  children,
}: {
  title: string;
  tone: string;
  caption?: string;
  children: React.ReactNode;
}) {
  const { c, glassBorder, isDark } = useOrbitColors();
  return (
    <View style={styles.outer}>
      <View
        style={[
          styles.bezel,
          { backgroundColor: glassFill(isDark), borderColor: `${tone}44` },
        ]}>
        {/* Title bar: three dots and the window's name, so it reads as a window. */}
        <View style={[styles.bar, { borderBottomColor: glassBorder(0.1) }]}>
          <View style={styles.dots}>
            {[0.5, 0.32, 0.2].map((opacity) => (
              <View
                key={opacity}
                style={[styles.dot, { backgroundColor: tone, opacity }]}
              />
            ))}
          </View>
          <Text style={[styles.title, { color: c.textMuted }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.dots} />
        </View>
        <View style={styles.content}>{children}</View>
      </View>
      <Text style={[styles.caption, { color: c.textSubtle }]}>
        {caption ?? 'An example — nothing here is saved'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { gap: 6 },
  bezel: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  bar: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dots: { flexDirection: 'row', gap: 4, width: 34 },
  dot: { borderRadius: 3.5, height: 7, width: 7 },
  title: { flex: 1, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  content: { gap: 10, paddingHorizontal: 14, paddingVertical: 14 },
  caption: { fontSize: 10.5, letterSpacing: 0.2, textAlign: 'center' },
});
