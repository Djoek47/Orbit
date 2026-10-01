import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View, type ScrollView, type TextInput as RNTextInput } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Moji } from '@/components/orbit/moji/moji';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { EmptyState } from '@/components/orbit/empty-state';
import { GlassCard } from '@/components/orbit/glass-card';
import { GroceryCategoryGrid } from '@/components/orbit/grocery-category-grid';
import { GroceryItemSheet } from '@/components/orbit/grocery/grocery-item-sheet';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { useTourScroll } from '@/components/orbit/tour/use-tour-scroll';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { RefreshIconButton } from '@/components/orbit/refresh-icon-button';
import { SearchBar } from '@/components/orbit/search-bar';
import { TourTarget } from '@/components/orbit/tour/tour-target';
import { typography } from '@/constants/orbit-theme';
import type { CatalogProduct } from '@/lib/grocery/catalog';
import { getCatalogProduct, iconForGroceryName } from '@/lib/grocery/catalog';
import { searchCatalog } from '@/lib/grocery/search-index';
import {
  listBuyAgainProducts,
  listComplementSuggestions,
  listFavoriteProducts,
} from '@/lib/grocery/suggest';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { GroceryItem } from '@/types/orbit';

/**
 * Canada-first grocery planner — shared chrome (PageEyebrow, SearchBar, GlassCard, EmptyState).
 */
export default function GroceriesScreen() {
  // The tour scrolls this screen so what it points at lands centred.
  const tourScrollRef = useRef<ScrollView>(null);
  const tourScroll = useTourScroll('/(tabs)/groceries', tourScrollRef);
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
    orbitPalette,
    patchGroceryCategory,
    permissions,
    removeGroceryItem,
    updateGroceryDetails,
    toggleGroceryFavorite,
  } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  const [chip, setChip] = useState<'favorites' | 'buyAgain' | 'suggest' | null>(null);
  const [editing, setEditing] = useState<GroceryItem | null>(null);
  const inputRef = useRef<RNTextInput>(null);

  useEffect(() => {
    markGroceriesOpened();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listItems = useMemo(
    () =>
      household.groceries.filter(
        (item) =>
          item.status === 'Missing' || item.status === 'Low' || item.status === 'Purchased'
      ),
    [household.groceries]
  );

  const active = listItems.filter((i) => i.status !== 'Purchased');
  const checked = listItems.filter((i) => i.status === 'Purchased');
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

  const searchSuggestions = useMemo(() => {
    if (!draft.trim()) return [];
    return searchCatalog(draft, 10).map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: p.browseCategory.replace(/_/g, ' '),
      icon: p.icon,
    }));
  }, [draft]);

  const isAdmin = permissions.canManageHousehold || permissions.canManageGroceries;

  const quickAdd = async () => {
    if (!draft.trim() || !canAddGroceryWishlist) return;
    setBusy(true);
    try {
      await addMissingGrocery({ name: draft.trim() });
      setDraft('');
      inputRef.current?.focus();
    } catch (error) {
      Alert.alert(
        'Could not add item',
        error instanceof Error ? error.message : 'Try again.'
      );
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

  const setCategory = async (item: GroceryItem, categoryId: string) => {
    const { withCategoryOverride } = await import('@/lib/grocery/classify');
    const overrides = withCategoryOverride(household.groceryCategoryOverrides, item.name, categoryId);
    await patchGroceryCategory(item.id, categoryId, overrides);
    setEditing((current) =>
      current && current.id === item.id ? { ...current, categoryId } : current
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
      ref={tourScrollRef}
      onScroll={tourScroll.onScroll}
      scrollEventThrottle={16}
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        gap: 12,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 16,
        paddingTop: chromePad,
      }}
      keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <PageEyebrow>Buy</PageEyebrow>
          <Text style={[typography.title1, { color: orbitPalette.text }]}>Groceries</Text>
        </View>
        <RefreshIconButton />
        {isAdmin ? (
          <Pressable onPress={openMenu} hitSlop={8} accessibilityLabel="Grocery options">
            <MaterialIcons name="more-horiz" size={22} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {canAddGroceryWishlist ? (
        
        <TourTarget id="groceries.search">
<SearchBar
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => void quickAdd()}
          suggestions={searchSuggestions}
          onPickSuggestion={(s) => {
            const product = getCatalogProduct(s.id);
            if (product) void pickProduct(product);
          }}
          showAddAsTyped
          inputRef={inputRef}
          disabled={busy}
          placeholder="Search milk, shampoo…"
        />

        </TourTarget>
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

      {chip ? (
        chipProducts.length ? (
          <View style={styles.suggestList}>
            {chipProducts.map((p) => (
              <GlassCard key={p.id} style={styles.suggestCard}>
                <Pressable
                  onPress={() => void pickProduct(p)}
                  onLongPress={() => toggleGroceryFavorite(p.id)}
                  style={styles.suggestRow}>
                  <Moji emoji={p.icon} size={20} />
                  <Text style={{ flex: 1, color: c.text, fontWeight: '600' }}>{p.name}</Text>
                  <Text style={{ color: accentTheme.primary, fontWeight: '700', fontSize: 12 }}>
                    Add
                  </Text>
                </Pressable>
              </GlassCard>
            ))}
          </View>
        ) : (
          <EmptyState
            tone="noResults"
            title="Nothing here yet"
            caption={
              chip === 'favorites'
                ? 'Long-press a product to favorite it.'
                : chip === 'buyAgain'
                  ? 'Buy-again fills in after you shop.'
                  : 'Add a few items and suggestions will appear.'
            }
          />
        )
      ) : null}

      {showBrowse ? (
        <TourTarget id="groceries.aisles">
        <GroceryCategoryGrid
          onSelect={(browse) => {
            setShowBrowse(false);
            router.push({ pathname: '/grocery-browse', params: { browseId: browse.id } } as never);
          }}
        />
        </TourTarget>
      ) : null}

      <TourTarget id="groceries.storeRun">
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
        <Text style={{ color: accentTheme.primary, fontWeight: '700' }}>Start shopping</Text>
      </Pressable>
        </TourTarget>

      {active.length === 0 && checked.length === 0 ? (
        <EmptyState
          tone="noneYet"
          title="Nothing on the list"
          caption="Search above or browse an aisle to add items."
        />
      ) : null}

      {active.length ? (
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
          To get · {active.length}
        </Text>
      ) : null}
      {active.map((item, index) => {
        const needsCategorise = !item.category || item.category === 'Other';
        return (
          <Animated.View
            key={item.id}
            entering={FadeInDown.delay(Math.min(index, 8) * 35).springify().damping(18)}
            layout={LinearTransition.springify().damping(20)}>
            <View style={[styles.itemCard, { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) }]}>
              <Pressable
                onPress={() => void toggleItem(item)}
                hitSlop={8}
                style={styles.tick}
                accessibilityRole="button"
                accessibilityLabel={`Tick off ${item.name}`}>
                <MaterialIcons name="radio-button-unchecked" size={24} color={accentTheme.primary} />
              </Pressable>
              <Pressable
                onPress={() => setEditing(item)}
                style={styles.rowBody}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.name}`}>
                <Moji emoji={iconForGroceryName(item.name, item.categoryId)} size={24} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: c.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.metaRow}>
                    <View
                      style={[
                        styles.catPill,
                        {
                          backgroundColor: needsCategorise ? `${c.warning}1F` : glass(0.06),
                          borderColor: needsCategorise ? `${c.warning}55` : glassBorder(0.1),
                        },
                      ]}>
                      <Text
                        style={[styles.catPillText, { color: needsCategorise ? c.warning : c.textMuted }]}>
                        {needsCategorise ? 'Pick an aisle' : item.category}
                      </Text>
                    </View>
                    {item.quantity && item.quantity !== '1' ? (
                      <Text style={[styles.qty, { color: c.textSubtle }]}>×{item.quantity}</Text>
                    ) : null}
                  </View>
                </View>
                <MaterialIcons name="more-vert" size={20} color={c.textSubtle} />
              </Pressable>
            </View>
          </Animated.View>
        );
      })}

      {checked.length ? (
        <Pressable
          onPress={() => {
            if (!isAdmin) return;
            void clearCheckedGroceries();
          }}
          style={styles.gotRow}
          accessibilityRole="button"
          accessibilityLabel={isAdmin ? 'Clear the checked items' : 'Checked items'}>
          <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Got it · {checked.length}</Text>
          {isAdmin ? (
            <Text style={[styles.clearLink, { color: accentTheme.primary }]}>Clear</Text>
          ) : null}
        </Pressable>
      ) : null}
      {checked.map((item) => (
        <Animated.View key={item.id} entering={FadeIn.duration(180)} layout={LinearTransition.springify().damping(20)}>
          <View
            style={[
              styles.itemCard,
              { backgroundColor: glass(0.03), borderColor: glassBorder(0.06), opacity: 0.6 },
            ]}>
            <Pressable
              onPress={() => void toggleItem(item)}
              hitSlop={8}
              style={styles.tick}
              accessibilityRole="button"
              accessibilityLabel={`Put ${item.name} back on the list`}>
              <MaterialIcons name="check-circle" size={24} color="#34D399" />
            </Pressable>
            <Pressable onPress={() => setEditing(item)} style={styles.rowBody}>
              <Moji emoji={iconForGroceryName(item.name, item.categoryId)} size={24} />
              <Text
                style={[styles.itemName, { color: c.textMuted, textDecorationLine: 'line-through', flex: 1 }]}
                numberOfLines={1}>
                {item.name}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      ))}

      <GroceryItemSheet
        item={editing}
        accent={accentTheme.primary}
        canEdit={isAdmin}
        onClose={() => setEditing(null)}
        onSave={(patch) => updateGroceryDetails(editing!.id, patch)}
        onCategory={(categoryId) => setCategory(editing!, categoryId)}
        onRemove={() => removeGroceryItem(editing!.id)}
      />
    </PersistentScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  suggestList: { gap: 6 },
  suggestCard: { padding: 0 },
  suggestRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingLeft: 12,
  },
  tick: { paddingVertical: 14, paddingRight: 10 },
  rowBody: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    paddingRight: 12,
    paddingVertical: 12,
  },
  itemName: { fontSize: 16, fontWeight: '700' },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 3 },
  catPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catPillText: { fontSize: 11, fontWeight: '700' },
  qty: { fontSize: 12, fontWeight: '700' },
  gotRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  clearLink: { fontSize: 13, fontWeight: '800' },
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
