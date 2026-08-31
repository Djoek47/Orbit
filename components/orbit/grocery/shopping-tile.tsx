import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { typography } from '@/constants/orbit-theme';
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
          opacity: done ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.975 : 1 }],
        },
      ]}>
      <View style={[StyleSheet.absoluteFill, styles.clip]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 22 : 40}
          tint={palette.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.glass }]} />
      </View>

      <View
        style={[
          styles.box,
          {
            borderColor: done ? palette.accent : palette.inkFaint,
            backgroundColor: done ? palette.accent : 'transparent',
          },
        ]}>
        {done ? (
          <MaterialIcons name="check" size={16} color={palette.checkGlyph} />
        ) : null}
      </View>

      <Text style={styles.emoji}>{iconForGroceryName(item.name, item.categoryId)}</Text>

      <View style={styles.body}>
        <Text
          style={[
            typography.headline,
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
        <View
          style={[
            styles.qty,
            { backgroundColor: palette.qtyBg, borderColor: palette.glassEdge },
          ]}>
          <Text style={[typography.caption1, { color: palette.inkMuted, fontWeight: '700' }]}>
            {qty}
          </Text>
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
    borderWidth: StyleSheet.hairlineWidth,
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
  qty: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 1,
  },
});
