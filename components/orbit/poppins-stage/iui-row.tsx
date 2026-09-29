/**
 * WO12 §A3 — one row. Tints, never bordered cards.
 * Grocery items, trip stops, batch tasks, and settle summary all use this.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { STAGE, stageDangerText, stageFaint, stageMuted, stageSurfaces } from '@/constants/iui-stage';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export type IuiRowStatus = 'pending' | 'saving' | 'done' | 'failed';

type Props = {
  title: string;
  detail?: string;
  trailing?: string;
  status?: IuiRowStatus;
  /** Focused / last row uses the stronger tint. */
  active?: boolean;
  /** Dim queued rows waiting behind the current beat. */
  dimmed?: boolean;
  accent?: string;
  onDrop?: () => void;
  onPress?: () => void;
  dropLabel?: string;
  /** Hide × while saving / done. */
  allowDrop?: boolean;
};

export function IuiRow({
  title,
  detail,
  trailing,
  status = 'pending',
  active = false,
  dimmed = false,
  accent = STAGE.domain.chores,
  onDrop,
  onPress,
  dropLabel,
  allowDrop = true,
}: Props) {
  const { isDark, c } = useOrbitColors();
  const surfaces = stageSurfaces(isDark);
  const muted = stageMuted(isDark);
  const faint = stageFaint(isDark);
  const failed = status === 'failed';
  const done = status === 'done';
  const bg = failed
    ? `${STAGE.semantic.danger}14`
    : active
      ? surfaces.rowActive
      : surfaces.row;
  const border = failed
    ? `${STAGE.semantic.danger}55`
    : 'transparent';

  const body = (
    <>
      <View
        style={[
          styles.dot,
          done && {
            backgroundColor: `${STAGE.semantic.success}29`,
            borderColor: STAGE.semantic.success,
            borderWidth: 3,
          },
          failed && {
            borderColor: STAGE.semantic.danger,
            borderWidth: 1.5,
          },
          !done &&
            !failed && {
              borderColor: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(15,28,42,0.20)',
              borderWidth: 1.5,
            },
        ]}>
        {done ? <Text style={[styles.check, { color: STAGE.semantic.success }]}>✓</Text> : null}
      </View>
      <View style={styles.body}>
        <Text
          style={[styles.title, { color: dimmed ? muted : c.text }]}
          numberOfLines={2}>
          {title}
        </Text>
        {detail ? (
          <Text style={[styles.detail, { color: failed ? stageDangerText(isDark) : muted }]} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text style={[styles.trailing, { color: faint }]} numberOfLines={1}>
          {trailing}
        </Text>
      ) : null}
      {allowDrop && onDrop && status !== 'done' && status !== 'saving' ? (
        <Pressable
          onPress={onDrop}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={dropLabel ?? `Drop ${title}`}
          style={styles.dropHit}>
          <View
            style={[
              styles.dropCircle,
              { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,28,42,0.12)' },
            ]}>
            <Text style={[styles.dropMark, { color: faint }]}>×</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.dropSpacer} />
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={[
          styles.row,
          { backgroundColor: bg, borderColor: border, opacity: dimmed ? 0.55 : 1 },
        ]}>
        {body}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: bg, borderColor: border, opacity: dimmed ? 0.55 : 1 },
      ]}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: STAGE.radius.row,
    paddingVertical: 13,
    paddingHorizontal: 12,
    gap: 10,
    borderWidth: 1,
    minHeight: 48,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { fontSize: 13, fontWeight: '700', lineHeight: 16 },
  body: { flex: 1, gap: 2 },
  title: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  detail: { fontSize: 12, lineHeight: 16 },
  trailing: { fontSize: 12, maxWidth: 72, textAlign: 'right' },
  dropHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropMark: { fontSize: 16, fontWeight: '500', lineHeight: 18 },
  dropSpacer: { width: 8 },
});
