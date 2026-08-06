import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import type { ShoppingPalette } from '@/lib/grocery/shopping-palette';

type Props = {
  palette: ShoppingPalette;
  runLabel: string;
  left: number;
  done: number;
  total: number;
  ratio: number;
  onBack: () => void;
};

export function ShoppingRunHeader({
  palette,
  runLabel,
  left,
  done,
  total,
  ratio,
  onBack,
}: Props) {
  return (
    <View style={styles.head}>
      <View style={styles.eyebrow}>
        <Pressable onPress={onBack} hitSlop={8} accessibilityLabel="Back" style={styles.back}>
          <MaterialIcons name="chevron-left" size={28} color={palette.ink} />
        </Pressable>
        <Text style={[styles.eyebrowText, { color: palette.inkFaint }]}>{runLabel}</Text>
      </View>

      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.ink }]}>Shopping</Text>
          <Text style={[styles.sub, { color: palette.inkMuted }]}>
            Sorted by aisle, in walking order
          </Text>
        </View>
        <View style={styles.count}>
          <Text style={[styles.countNum, { color: palette.ink }]}>{left}</Text>
          <Text style={[styles.countLabel, { color: palette.inkFaint }]}>left</Text>
        </View>
      </View>

      <View style={[styles.rule, { backgroundColor: 'rgba(244,234,218,0.12)' }]}>
        <View
          style={[
            styles.ruleFill,
            {
              width: `${Math.round(ratio * 100)}%`,
              backgroundColor: palette.olive,
            },
          ]}
        />
      </View>
      <View style={styles.ruleLab}>
        <Text style={[styles.ruleLabText, { color: palette.inkFaint }]}>In the cart</Text>
        <Text style={[styles.ruleLabText, { color: palette.inkMuted }]}>
          {done} of {total}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 22, paddingTop: 6 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  back: { marginLeft: -8, paddingVertical: 4, paddingRight: 4 },
  eyebrowText: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 },
  title: { fontSize: 40, fontWeight: '800', letterSpacing: -1.1, lineHeight: 40 },
  sub: { marginTop: 7, fontSize: 14.5, fontWeight: '500' },
  count: { alignItems: 'flex-end', paddingBottom: 3 },
  countNum: { fontSize: 27, fontWeight: '800', letterSpacing: -0.8, lineHeight: 28 },
  countLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  rule: { marginTop: 18, height: 2, borderRadius: 2, overflow: 'hidden' },
  ruleFill: { height: 2, borderRadius: 2 },
  ruleLab: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 9,
  },
  ruleLabText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
