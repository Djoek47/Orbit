/**
 * Browse a single grocery browse-category product grid.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { space, typography } from '@/constants/orbit-theme';
import {
  listBrowseCategories,
  productsByBrowseCategory,
} from '@/lib/grocery/catalog';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function GroceryBrowseScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const { browseId } = useLocalSearchParams<{ browseId?: string }>();
  const { addGroceryFromProduct, household, toggleGroceryFavorite, canAddGroceryWishlist } =
    useOrbit();

  const browse = useMemo(
    () => listBrowseCategories().find((b) => b.id === browseId),
    [browseId]
  );
  const products = useMemo(
    () => (browseId ? productsByBrowseCategory(String(browseId)) : []),
    [browseId]
  );
  const favorites = new Set(household.groceryFavorites ?? []);

  return (
    <View style={[styles.shell, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.subheadline, { color: c.accent }]}>‹ Groceries</Text>
        </Pressable>
        <Text style={[typography.title3, { color: c.text }]}>
          {browse ? `${browse.icon} ${browse.name}` : 'Browse'}
        </Text>
        <View style={{ width: 72 }} />
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + 40, gap: 8 }}
        renderItem={({ item }) => {
          const fav = favorites.has(item.id);
          return (
            <View
              style={[
                styles.row,
                { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) },
              ]}>
              <Text style={styles.icon}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[typography.subheadline, { color: c.text, fontWeight: '600' }]}>
                  {item.name}
                </Text>
                {item.brand ? (
                  <Text style={[typography.caption2, { color: c.textMuted }]}>{item.brand}</Text>
                ) : null}
              </View>
              <Pressable onPress={() => toggleGroceryFavorite(item.id)} hitSlop={8}>
                <Text style={{ fontSize: 18 }}>{fav ? '★' : '☆'}</Text>
              </Pressable>
              {canAddGroceryWishlist ? (
                <Pressable
                  onPress={() => void addGroceryFromProduct(item.id).then(() => router.back())}
                  style={[styles.add, { backgroundColor: `${c.accent}28` }]}>
                  <Text style={[typography.caption1, { color: c.accent, fontWeight: '700' }]}>
                    Add
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={[typography.body, { color: c.textMuted, textAlign: 'center' }]}>
            No products in this category.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  icon: { fontSize: 22, width: 28, textAlign: 'center' },
  add: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
});
