import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { classifyGroceryItem, listGroceryCategories } from '@/lib/grocery/classify';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { GroceryItem } from '@/types/orbit';

/**
 * Revision C §4 — one list, type-to-file, aisle tags, clear checked (admin).
 * Grocery Intelligence / budget / preferred store / storage removed.
 */
export default function GroceriesScreen() {
  const chromePad = useTabChromePaddingTop();
  const insets = useSafeAreaInsets();
  const {
    accentTheme,
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
  } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    markGroceriesOpened();
    // Intentionally once on mount — marks admin "last opened" for Home badge.
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

  const preview = draft.trim()
    ? classifyGroceryItem(draft, household.groceryCategoryOverrides)
    : null;
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
        <View
          style={[
            styles.addRow,
            { borderColor: glassBorder(0.12), backgroundColor: glass(0.04) },
          ]}>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder="Add an item…"
            placeholderTextColor={c.textSubtle}
            returnKeyType="done"
            onSubmitEditing={() => void quickAdd()}
            style={[styles.addInput, { color: c.text }]}
          />
          <Pressable
            disabled={busy || !draft.trim()}
            onPress={() => void quickAdd()}
            style={[styles.addBtn, { backgroundColor: `${accentTheme.primary}22` }]}>
            <MaterialIcons name="add" size={20} color={accentTheme.primary} />
          </Pressable>
        </View>
      ) : null}
      {preview ? (
        <Text style={{ color: c.textMuted, fontSize: 12 }}>
          → {preview.categoryName}
          {preview.quantityDisplay ? ` · ${preview.quantityDisplay}` : ''}
        </Text>
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
  addRow: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addInput: { flex: 1, fontSize: 16, minHeight: 40, paddingVertical: 8 },
  addBtn: { borderRadius: 10, padding: 8 },
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
