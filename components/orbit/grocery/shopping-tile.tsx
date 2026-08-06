import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { iconForGroceryName } from '@/lib/grocery/catalog';
import type { ShoppingListItem, ShoppingPalette } from '@/lib/grocery/shopping-palette';

type Props = {
  item: ShoppingListItem;
  palette: ShoppingPalette;
  onToggle: () => void;
};

export function ShoppingTile({ item, palette, onToggle }: Props) {
  const done = item.done;
  const qty =
    item.quantity && item.quantity.trim() && item.quantity.trim() !== '1'
      ? item.quantity.trim()
      : null;

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ checked: done }}
      style={({ pressed }) => [
        styles.tile,
        {
          borderColor: palette.glassEdge,
          opacity: done ? 0.42 : 1,
          transform: [{ scale: pressed ? 0.975 : 1 }],
        },
      ]}>
      <View style={[StyleSheet.absoluteFill, styles.clip]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 22 : 40}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.glass }]} />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: palette.glassHi,
              opacity: 0.35,
            },
          ]}
        />
      </View>

      <View
        style={[
          styles.box,
          {
            borderColor: done ? palette.olive : palette.inkFaint,
            backgroundColor: done ? palette.olive : 'transparent',
          },
        ]}>
        {done ? <MaterialIcons name="check" size={16} color="#1B140F" /> : null}
      </View>

      <Text style={styles.emoji}>{iconForGroceryName(item.name, item.categoryId)}</Text>

      <View style={styles.body}>
        <Text
          style={[
            styles.name,
            {
              color: palette.ink,
              textDecorationLine: done ? 'line-through' : 'none',
            },
          ]}
          numberOfLines={2}>
          {item.name}
        </Text>
      </View>

      {qty ? (
        <View style={[styles.qty, { backgroundColor: palette.qtyBg, borderColor: palette.glassEdge }]}>
          <Text style={[styles.qtyText, { color: palette.inkMuted }]}>{qty}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 17,
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 64,
  },
  clip: { borderRadius: 26, overflow: 'hidden' },
  box: {
    width: 27,
    height: 27,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  emoji: { fontSize: 22, width: 28, textAlign: 'center', zIndex: 1 },
  body: { flex: 1, minWidth: 0, zIndex: 1 },
  name: { fontSize: 17.5, fontWeight: '700', letterSpacing: -0.2, lineHeight: 22 },
  qty: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 11,
    borderWidth: 1,
    zIndex: 1,
  },
  qtyText: { fontSize: 12.5, fontWeight: '700' },
});
