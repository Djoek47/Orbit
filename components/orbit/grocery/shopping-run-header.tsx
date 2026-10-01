import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { typography } from '@/constants/orbit-theme';
import type { ShoppingPalette } from '@/lib/grocery/shopping-palette';

type Props = {
  palette: ShoppingPalette;
  runLabel: string;
  left: number;
  done: number;
  total: number;
  ratio: number;
  onBack: () => void;
  /** Ends the run and takes the banner off the Lock Screen. */
  onEndRun?: () => void;
  /** True while the banner is showing, so End run is worth offering. */
  bannerOn?: boolean;
  /** The Lock Screen switch. Omitted where this iPhone or build can't show one. */
  lockScreen?: { on: boolean; onToggle: () => void };
};

export function ShoppingRunHeader({
  palette,
  runLabel,
  left,
  done,
  total,
  ratio,
  onBack,
  onEndRun,
  bannerOn,
  lockScreen,
}: Props) {
  return (
    <View style={styles.head}>
      <View style={styles.eyebrow}>
        <Pressable onPress={onBack} hitSlop={8} accessibilityLabel="Back" style={styles.back}>
          <MaterialIcons name="chevron-left" size={28} color={palette.ink} />
        </Pressable>
        <Text style={[typography.eyebrow, { color: palette.inkFaint }]}>{runLabel}</Text>
        <View style={styles.spacer} />
        {lockScreen ? (
          <Pressable
            onPress={lockScreen.onToggle}
            hitSlop={8}
            accessibilityRole="switch"
            accessibilityState={{ checked: lockScreen.on }}
            accessibilityLabel="Show this run on the Lock Screen"
            style={[
              styles.lockPill,
              {
                borderColor: lockScreen.on ? palette.accent : palette.glassEdge,
                backgroundColor: lockScreen.on ? `${palette.accent}22` : 'transparent',
              },
            ]}>
            <MaterialIcons
              name={lockScreen.on ? 'lock' : 'lock-open'}
              size={13}
              color={lockScreen.on ? palette.accent : palette.inkFaint}
            />
            <Text
              style={[
                typography.caption1,
                { color: lockScreen.on ? palette.accent : palette.inkMuted, fontWeight: '700' },
              ]}>
              {lockScreen.on ? 'Lock Screen' : 'Lock Screen off'}
            </Text>
          </Pressable>
        ) : null}
        {bannerOn && onEndRun ? (
          <Pressable
            onPress={onEndRun}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="End the run and clear the Lock Screen"
            style={[styles.endRun, { borderColor: palette.glassEdge }]}>
            <Text style={[typography.footnote, { color: palette.inkMuted, fontWeight: '700' }]}>
              End run
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.largeTitle, { color: palette.ink }]}>Shopping</Text>
          <Text style={[typography.subheadline, { color: palette.inkMuted, marginTop: 6 }]}>
            Sorted by aisle, in walking order
          </Text>
        </View>
        <View style={styles.count}>
          <Text style={[typography.title1, { color: palette.ink, fontVariant: ['tabular-nums'] }]}>
            {left}
          </Text>
          <Text style={[typography.caption2, { color: palette.inkFaint, letterSpacing: 1.2 }]}>
            LEFT
          </Text>
        </View>
      </View>

      <View style={[styles.rule, { backgroundColor: palette.ruleTrack }]}>
        <View
          style={[
            styles.ruleFill,
            {
              width: `${Math.round(ratio * 100)}%`,
              backgroundColor: palette.accent,
            },
          ]}
        />
      </View>
      <View style={styles.ruleLab}>
        <Text style={[typography.caption2, { color: palette.inkFaint, letterSpacing: 1 }]}>
          IN THE CART
        </Text>
        <Text style={[typography.caption2, { color: palette.inkMuted, fontVariant: ['tabular-nums'] }]}>
          {done} of {total}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 22, paddingTop: 6 },
  spacer: { flex: 1 },
  lockPill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  endRun: {
    marginLeft: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  back: { marginLeft: -8, paddingVertical: 4, paddingRight: 4 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 14,
  },
  count: { alignItems: 'flex-end', paddingBottom: 3 },
  rule: { marginTop: 18, height: 2, borderRadius: 2, overflow: 'hidden' },
  ruleFill: { height: 2, borderRadius: 2 },
  ruleLab: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 9,
  },
});
