import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { GroceryCategoryGrid } from '@/components/orbit/grocery-category-grid';
import { GrocerySearchField } from '@/components/orbit/grocery-search-field';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { listGroceryCategories } from '@/lib/grocery/classify';
import type { CatalogProduct } from '@/lib/grocery/catalog';
import { iconForGroceryName } from '@/lib/grocery/catalog';
import {
  listBuyAgainProducts,
  listComplementSuggestions,
  listFavoriteProducts,
} from '@/lib/grocery/suggest';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { GroceryItem } from '@/types/orbit';

/**
 * Canada-first grocery planner — search / browse / favorites / buy-again.
 * Rev C list, aisle tags, clear, and shopping mode remain.
 */
export default function GroceriesScreen() {
  const chromePad = useTabChromePaddingTop();
  const insets = useSafeAreaInsets();
  const {
    accentTheme,
    addGroceryFromProduct,
    addMissingGrocery,
    canAddGroceryWishlist,
    clearCheckedGroceries,
    clearGroceryList,
    household,
    markGroceriesOpened,
    markGroceryMissing,
    markGroceryPurchased,
    patchGroceryCategory,
    permissions,
    toggleGroceryFavorite,
  } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  const [chip, setChip] = useState<'favorites' | 'buyAgain' | 'suggest' | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    markGroceriesOpened();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listItems = useMemo(
    () =>
      household.groceries.filter(
        (item) => item.status === 'Missing' || item.status === 'Low' || item.status === 'Purchased'
      ),
    [household.groceries]
  );

  const active = listItems.filter((i) => i.status !== 'Purchased');
  const checked = listItems.filter((i) => i.status === 'Purchased');
  const sorted = [...active, ...checked];
  const onListNames = active.map((i) => i.name);

  const favoriteProducts = useMemo(
    () => listFavoriteProducts(household.groceryFavorites ?? []),
    [household.groceryFavorites]
  );
  const buyAgainProducts = useMemo(
    () => listBuyAgainProducts(household.groceryPurchaseHistory ?? [], 12),
    [household.groceryPurchaseHistory]
  );
  const suggestProducts = useMemo(
    () => listComplementSuggestions(onListNames, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onListNames.join('|')]
  );

  const chipProducts =
    chip === 'favorites'
      ? favoriteProducts
      : chip === 'buyAgain'
        ? buyAgainProducts
        : chip === 'suggest'
          ? suggestProducts
          : [];

  const isAdmin = permissions.canManageHousehold || permissions.canManageGroceries;

  const quickAdd = async () => {
    if (!draft.trim() || !canAddGroceryWishlist) return;
    setBusy(true);
    try {
      await addMissingGrocery({ name: draft.trim() });
      setDraft('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const pickProduct = async (product: CatalogProduct) => {
    if (!canAddGroceryWishlist) return;
    setBusy(true);
    try {
      await addGroceryFromProduct(product.id);
      setDraft('');
    } finally {
      setBusy(false);
    }
  };

  const toggleItem = async (item: GroceryItem) => {
    if (item.status === 'Purchased') {
      await markGroceryMissing(item.id);
      return;
    }
    await markGroceryPurchased(item.id);
  };

  const reassignCategory = (item: GroceryItem) => {
    const cats = listGroceryCategories();
    Alert.alert(
      'Category',
      'Pick the aisle for this item',
      [
        ...cats.map((cat) => ({
          text: cat.name,
          onPress: () => {
            void (async () => {
              const { withCategoryOverride } = await import('@/lib/grocery/classify');
              const overrides = withCategoryOverride(
                household.groceryCategoryOverrides,
                item.name,
                cat.id
              );
              await patchGroceryCategory(item.id, cat.id, overrides);
            })();
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const openMenu = () => {
    if (!isAdmin) {
      Alert.alert('Admins only', 'Only a grown-up can clear the list.');
      return;
    }
    Alert.alert('Groceries', undefined, [
      {
        text: 'Clear checked',
        onPress: () => {
          const purchased = household.groceries.filter((g) => g.status === 'Purchased');
          if (!purchased.length) {
            Alert.alert('Nothing checked', 'Check items off first.');
            return;
          }
          Alert.alert('Clear checked?', `Remove ${purchased.length} checked item(s).`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear',
              style: 'destructive',
              onPress: () => void clearCheckedGroceries(),
            },
          ]);
        },
      },
      {
        text: 'Clear list',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Clear entire list?', 'This removes every item on the list.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear list',
              style: 'destructive',
              onPress: () => void clearGroceryList(),
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <PersistentScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        gap: 12,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 16,
        paddingTop: chromePad,
      }}
      keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: c.text }]}>Groceries</Text>
        {isAdmin ? (
          <Pressable onPress={openMenu} hitSlop={8} accessibilityLabel="Grocery options">
            <MaterialIcons name="more-horiz" size={22} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {canAddGroceryWishlist ? (
        <GrocerySearchField
          value={draft}
          onChangeText={setDraft}
          onSubmitFreeText={() => void quickAdd()}
          onPickProduct={(p) => void pickProduct(p)}
          inputRef={inputRef}
          disabled={busy}
          placeholder="Search milk, shampoo…"
        />
      ) : null}

      <View style={styles.chipRow}>
        {(
          [
            { id: 'favorites' as const, label: 'Favorites', count: favoriteProducts.length },
            { id: 'buyAgain' as const, label: 'Buy again', count: buyAgainProducts.length },
            { id: 'suggest' as const, label: 'Suggest', count: suggestProducts.length },
          ] as const
        ).map((item) => {
          const on = chip === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setChip(on ? null : item.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: on ? `${accentTheme.primary}28` : glass(0.05),
                  borderColor: on ? `${accentTheme.primary}55` : glassBorder(0.1),
                },
              ]}>
              <Text
                style={{
                  color: on ? accentTheme.primary : c.textMuted,
                  fontWeight: '700',
                  fontSize: 12,
                }}>
                {item.label}
                {item.count ? ` · ${item.count}` : ''}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setShowBrowse((v) => !v)}
          style={[
            styles.chip,
            {
              backgroundColor: showBrowse ? `${accentTheme.primary}28` : glass(0.05),
              borderColor: showBrowse ? `${accentTheme.primary}55` : glassBorder(0.1),
            },
          ]}>
          <Text
            style={{
              color: showBrowse ? accentTheme.primary : c.textMuted,
              fontWeight: '700',
              fontSize: 12,
            }}>
            Browse
          </Text>
        </Pressable>
      </View>

      {chip && chipProducts.length ? (
        <View style={styles.suggestList}>
          {chipProducts.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => void pickProduct(p)}
              onLongPress={() => toggleGroceryFavorite(p.id)}
              style={[
                styles.suggestRow,
                { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) },
              ]}>
              <Text style={{ fontSize: 18 }}>{p.icon}</Text>
              <Text style={{ flex: 1, color: c.text, fontWeight: '600' }}>{p.name}</Text>
              <Text style={{ color: accentTheme.primary, fontWeight: '700', fontSize: 12 }}>
                Add
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {showBrowse ? (
        <GroceryCategoryGrid
          onSelect={(browse) => {
            setShowBrowse(false);
            router.push({ pathname: '/grocery-browse', params: { browseId: browse.id } } as never);
          }}
        />
      ) : null}

      {sorted.map((item) => {
        const done = item.status === 'Purchased';
        const needsCategorise = !item.category || item.category === 'Other';
        return (
          <Pressable
            key={item.id}
            onPress={() => void toggleItem(item)}
            style={[
              styles.row,
              { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) },
            ]}>
            <MaterialIcons
              name={done ? 'check-circle' : 'radio-button-unchecked'}
              size={22}
              color={done ? '#34D399' : accentTheme.primary}
            />
            <Text style={{ fontSize: 20, width: 28, textAlign: 'center' }}>
              {iconForGroceryName(item.name, item.categoryId)}
            </Text>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.itemName,
                  { color: c.text, textDecorationLine: done ? 'line-through' : 'none' },
                ]}>
                {item.name}
                {item.quantity && item.quantity !== '1' ? `  · ${item.quantity}` : ''}
              </Text>
              {needsCategorise && !done ? (
                <Text style={{ color: c.textSubtle, fontSize: 11 }}>Tap to categorise</Text>
              ) : null}
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                reassignCategory(item);
              }}
              hitSlop={8}>
              <Text style={[styles.catTag, { color: c.textMuted }]}>
                {item.category || 'Other'}
              </Text>
            </Pressable>
          </Pressable>
        );
      })}

      <Pressable
        onPress={() => router.push('/shopping-mode' as never)}
        style={[
          styles.aisleBtn,
          {
            backgroundColor: `${accentTheme.primary}22`,
            borderColor: `${accentTheme.primary}44`,
          },
        ]}>
        <MaterialIcons name="storefront" size={18} color={accentTheme.primary} />
        <Text style={{ color: accentTheme.primary, fontWeight: '700' }}>View list by aisle</Text>
      </Pressable>
    </PersistentScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: { fontSize: 28, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  suggestList: { gap: 6 },
  suggestRow: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  itemName: { fontSize: 16, fontWeight: '600' },
  catTag: { fontSize: 11, fontWeight: '600' },
  aisleBtn: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 14,
  },
});
