/**
 * Tiny glass detail bubble for Household Health chips.
 * Absolute overlay inside the sheet — never RN Modal over Expo presentation:modal.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { glassBorder as glassBorderFn, glassCardStrong, useOrbitColors } from '@/lib/theme/use-orbit-colors';

export type GlassDetailLine = {
  label: string;
  meta?: string;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  accent: string;
  lines: GlassDetailLine[];
  emptyLabel?: string;
  onClose: () => void;
};

export function GlassDetailPopover({
  visible,
  title,
  subtitle,
  accent,
  lines,
  emptyLabel = 'Nothing here yet.',
  onClose,
}: Props) {
  const { c, isDark } = useOrbitColors();
  if (!visible) return null;

  const hairline = glassBorderFn(isDark, 0.12);

  return (
    <View style={styles.frame} pointerEvents="box-none">
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss detail">
        <Animated.View entering={FadeIn.duration(160)} style={StyleSheet.absoluteFill} />
      </Pressable>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          entering={FadeInDown.duration(220).springify().damping(18)}
          style={[
            styles.card,
            {
              backgroundColor: isDark ? 'rgba(28, 22, 18, 0.92)' : glassCardStrong(isDark),
              borderColor: `${accent}66`,
            },
          ]}>
          <View style={styles.head}>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={[styles.sub, { color: accent }]} numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.close, { backgroundColor: `${accent}22` }]}>
              <MaterialIcons name="close" size={16} color={accent} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {lines.length === 0 ? (
              <Text style={[styles.empty, { color: c.textMuted }]}>{emptyLabel}</Text>
            ) : (
              lines.map((line, index) => (
                <View
                  key={`${line.label}-${index}`}
                  style={[
                    styles.row,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: hairline,
                    },
                  ]}>
                  <View style={[styles.dot, { backgroundColor: accent }]} />
                  <Text style={[styles.rowLabel, { color: c.text }]} numberOfLines={2}>
                    {line.label}
                  </Text>
                  {line.meta ? (
                    <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
                      {line.meta}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  center: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    maxHeight: 340,
    overflow: 'hidden',
    paddingBottom: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  head: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  sub: { fontSize: 12.5, fontWeight: '700' },
  close: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  list: { maxHeight: 260 },
  listContent: { paddingBottom: 6 },
  empty: { fontSize: 13, fontWeight: '600', paddingVertical: 12 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  dot: { borderRadius: 3, height: 6, width: 6 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '700' },
  rowMeta: { fontSize: 12, fontWeight: '600', maxWidth: 88 },
});
