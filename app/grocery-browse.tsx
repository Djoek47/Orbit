/**
 * Browse a single grocery browse-category product grid.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Moji } from '@/components/orbit/moji/moji';
import { AppText as Text } from '@/components/orbit/app-text';
import { EmptyState } from '@/components/orbit/empty-state';
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
        <View style={styles.headTitle}>
          {browse ? <Moji emoji={browse.icon} size={20} /> : null}
          <Text style={[typography.title3, { color: c.text }]}>{browse?.name ?? 'Browse'}</Text>
        </View>
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
              <Moji emoji={item.icon} size={26} style={styles.icon} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.subheadline, { color: c.text, fontWeight: '600' }]}>
                  {item.name}
                </Text>
                {item.brand ? (
                  <Text style={[typography.caption2, { color: c.textMuted }]}>{item.brand}</Text>
                ) : null}
              </View>
              <Pressable onPress={() => toggleGroceryFavorite(item.id)} hitSlop={8}>
                <MaterialIcons name={fav ? 'star' : 'star-outline'} size={20} color={fav ? c.warning : c.textSubtle} />
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
          <EmptyState
            tone="noneYet"
            title="Nothing in this aisle"
            caption="Try another category or search from Groceries."
          />
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
  icon: { width: 28 },
  headTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  add: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
});
