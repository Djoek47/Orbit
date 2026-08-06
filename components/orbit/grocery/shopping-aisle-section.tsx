import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { ShoppingTile } from '@/components/orbit/grocery/shopping-tile';
import type { ShoppingAisleGroup, ShoppingPalette } from '@/lib/grocery/shopping-palette';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  aisle: ShoppingAisleGroup;
  palette: ShoppingPalette;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggleItem: (id: string) => void;
  reduceMotion?: boolean;
};

export function ShoppingAisleSection({
  aisle,
  palette,
  collapsed,
  onToggleCollapse,
  onToggleItem,
  reduceMotion,
}: Props) {
  const remainingLabel = aisle.remaining > 0 ? String(aisle.remaining) : '—';

  return (
    <View style={styles.aisle}>
      <Pressable
        onPress={() => {
          if (!reduceMotion) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          }
          onToggleCollapse();
        }}
        style={styles.head}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}>
        <MaterialIcons name="storefront" size={20} color={palette.olive} />
        <Text style={[styles.title, { color: palette.ink }]}>{aisle.categoryName}</Text>
        <Text style={[styles.count, { color: palette.inkFaint }]}>{remainingLabel}</Text>
        <MaterialIcons
          name="expand-more"
          size={20}
          color={palette.inkFaint}
          style={{ transform: [{ rotate: collapsed ? '90deg' : '0deg' }] }}
        />
      </Pressable>
      {!collapsed ? (
        <View style={styles.items}>
          {aisle.items.map((item) => (
            <ShoppingTile
              key={item.id}
              item={item}
              palette={palette}
              onToggle={() => onToggleItem(item.id)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  aisle: { marginBottom: 26 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 6,
    paddingBottom: 11,
  },
  title: { flex: 1, fontSize: 14.5, fontWeight: '700' },
  count: { fontSize: 12.5, fontWeight: '700' },
  items: { gap: 9 },
});
