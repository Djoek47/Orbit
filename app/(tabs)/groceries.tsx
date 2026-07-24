import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { scanDealsForHousehold } from '@/data/mock-deals';
import { PREFERRED_STORES } from '@/data/preferred-stores';
import { lookupGroceryProduct, type GroceryProductLookup } from '@/lib/grocery/product-lookup';
import { openDirections } from '@/lib/maps/directions';
import { summarizeShoppingRun } from '@/lib/grocery/savings';
import { useOrbit } from '@/store/orbit-store';
import type { GroceryItem } from '@/types/orbit';

const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  Produce: { emoji: '🥬', color: '#34D399' },
  'Dairy & Eggs': { emoji: '🥛', color: '#38BDF8' },
  Dairy: { emoji: '🥛', color: '#38BDF8' },
  Bakery: { emoji: '🍞', color: '#FBBF24' },
  'Meat & Seafood': { emoji: '🥩', color: '#F87171' },
  Frozen: { emoji: '🧊', color: '#7DD3FC' },
  Pantry: { emoji: '🫙', color: '#FB923C' },
  Beverages: { emoji: '🧃', color: '#A78BFA' },
  Snacks: { emoji: '🍪', color: '#F472B6' },
  Household: { emoji: '🧽', color: '#94A3B8' },
  Bathroom: { emoji: '🧴', color: '#38BDF8' },
  Cleaning: { emoji: '✨', color: '#34D399' },
  Pets: { emoji: '🐾', color: '#FB923C' },
  Baby: { emoji: '🍼', color: '#F472B6' },
  Other: { emoji: '📦', color: '#7C9CC0' },
};

export default function GroceriesScreen() {
  const chromePad = useTabChromePaddingTop(8);
  const insets = useSafeAreaInsets();
  const {
    accentTheme,
    addMissingGrocery,
    canAddGroceryWishlist,
    household,
    markGroceryPurchased,
    markGroceryMissing,
    metrics,
    permissions,
    preferredStore,
    setPreferredStore,
    suggestNovaItinerary,
  } = useOrbit();

  const [expandedCat, setExpandedCat] = useState<string | null>('Produce');
  const [busy, setBusy] = useState(false);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookup, setLookup] = useState<GroceryProductLookup | null>(null);

  const listItems = useMemo(
    () =>
      household.groceries.filter(
        (item) => item.status === 'Missing' || item.status === 'Low' || item.status === 'Purchased'
      ),
    [household.groceries]
  );

  const summary = useMemo(
    () => summarizeShoppingRun(household.groceries, { includePurchased: true }),
    [household.groceries],
  );
  const softBudget = 100;
  const leftover = softBudget - summary.estimatedTotal;
  const leftoverLabel =
    leftover >= 0 ? `$${leftover.toFixed(0)} left` : `$${Math.abs(leftover).toFixed(0)} over`;
  const leftoverColor = leftover >= 0 ? '#34D399' : '#F87171';

  const categories = useMemo(() => {
    const map = new Map<string, GroceryItem[]>();
    for (const item of listItems) {
      const key = item.category || 'Other';
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).map(([name, items]) => ({
      name,
      items,
      ...(CATEGORY_META[name] ?? CATEGORY_META.Other),
    }));
  }, [listItems]);

  const collected = listItems.filter((item) => item.status === 'Purchased').length;
  const total = listItems.length || 1;

  const startStoreTrip = async () => {
    setBusy(true);
    try {
      const created = await suggestNovaItinerary();
      if (created) {
        router.push(`/itinerary/${created.id}` as never);
      } else {
        router.push('/(tabs)/plan' as never);
      }
    } finally {
      setBusy(false);
    }
  };

  const insights = useMemo(() => {
    const rows: { text: string; action?: string; actionKind?: 'expand' | 'trip' }[] = [];
    const critical = household.groceries.filter((item) => item.status === 'Missing' || item.status === 'Low');
    if (critical[0]) {
      rows.push({
        text: `${critical[0].name} is ${critical[0].status === 'Missing' ? 'missing' : 'running low'} — keep it near the top of the list.`,
        action: 'Open item',
        actionKind: 'expand',
      });
    }
    const deals = scanDealsForHousehold({
      groceryNames: critical.map((item) => item.name),
    }).slice(0, 1);
    if (deals[0]) {
      rows.push({
        text: `${deals[0].title} is on sale at ${deals[0].store} — save $${deals[0].savings.toFixed(2)}.`,
        action: `Save $${deals[0].savings.toFixed(2)}`,
      });
    }
    rows.push({
      text: `Preferred store is ${preferredStore.name}. Start a store itinerary when you are ready to shop.`,
      action: 'Plan trip',
      actionKind: 'trip',
    });
    return rows.slice(0, 3);
  }, [household.groceries, preferredStore.name]);

  const toggleItem = async (item: GroceryItem) => {
    if (item.status === 'Purchased') {
      await markGroceryMissing(item.id);
      return;
    }
    await markGroceryPurchased(item.id);
  };

  const runLookup = (value: string) => {
    setLookupQuery(value);
    setLookup(lookupGroceryProduct(value, preferredStore.id));
  };

  const addLookupToList = async () => {
    if (!lookup || !canAddGroceryWishlist) return;
    await addMissingGrocery({
      name: lookup.name,
      category: lookup.category,
      quantity: lookup.packSize,
      typicalPrice: lookup.estimatedPackPrice,
      storeId: lookup.store.id,
      note: lookup.note,
    });
    setLookupQuery('');
    setLookup(null);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: chromePad,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          <Text style={styles.caption}>Grocery Intelligence</Text>
          <Text style={styles.title}>This Week&apos;s List</Text>
        </View>
      </View>
      {(permissions.canManageGroceries || canAddGroceryWishlist) && (
        <Pressable
          style={[
            styles.addBtn,
            {
              backgroundColor: `${accentTheme.primary}26`,
              borderColor: `${accentTheme.primary}33`,
            },
          ]}
          onPress={() => router.push('/add-grocery' as never)}
          accessibilityRole="button"
          accessibilityLabel="Add grocery item">
          <MaterialIcons name="add" size={18} color={accentTheme.primary} />
        </Pressable>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Find a product</Text>
        <Text style={styles.caption}>AI-ish lookup · unit price · preferred or nearby store</Text>
        <TextInput
          value={lookupQuery}
          onChangeText={runLookup}
          placeholder="e.g. milk, olive oil, blueberries"
          placeholderTextColor="#4B6080"
          style={styles.lookupInput}
        />
        {lookup ? (
          <View style={styles.lookupResult}>
            <Text style={styles.lookupName}>{lookup.name}</Text>
            <Text style={styles.caption}>
              {lookup.packSize} · ${lookup.estimatedPackPrice.toFixed(2)} est.
              {lookup.brand ? ` · ${lookup.brand}` : ''}
            </Text>
            {lookup.pricePerLiter != null ? (
              <Text style={[styles.unitPrice, { color: accentTheme.primary }]}>
                ${lookup.pricePerLiter.toFixed(2)}/L · ${lookup.pricePerGallon?.toFixed(2)}/gal
              </Text>
            ) : (
              <Text style={styles.caption}>Pack estimate at {lookup.store.name}</Text>
            )}
            <Text style={styles.caption}>
              Buy at {lookup.store.name} · {lookup.store.address}
            </Text>
            <View style={styles.lookupActions}>
              <Pressable
                onPress={() =>
                  void openDirections(undefined, {
                    address: lookup.store.address,
                    placeQuery: lookup.store.placeQuery,
                  })
                }
                style={[styles.lookupBtn, { borderColor: `${accentTheme.primary}55` }]}>
                <MaterialIcons name="map" size={14} color={accentTheme.primary} />
                <Text style={[styles.lookupBtnText, { color: accentTheme.primary }]}>Open in Maps</Text>
              </Pressable>
              {(permissions.canManageGroceries || canAddGroceryWishlist) && (
                <Pressable
                  onPress={() => void addLookupToList()}
                  style={[styles.lookupBtn, { backgroundColor: `${accentTheme.primary}22`, borderColor: `${accentTheme.primary}55` }]}>
                  <MaterialIcons name="add" size={14} color={accentTheme.primary} />
                  <Text style={[styles.lookupBtnText, { color: accentTheme.primary }]}>Add to list</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.cardTitle}>
              {collected} of {listItems.length} collected
            </Text>
            <Text style={styles.caption}>
              Est. total: ${summary.estimatedTotal.toFixed(0)} · Soft budget: ${softBudget}
            </Text>
          </View>
          <View style={styles.inline}>
            <MaterialIcons
              name={leftover >= 0 ? 'trending-down' : 'trending-up'}
              size={14}
              color={leftoverColor}
            />
            <Text style={[styles.savings, { color: leftoverColor }]}>{leftoverLabel}</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={[accentTheme.primary, '#34D399']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${Math.round((collected / total) * 100)}%` }]}
          />
        </View>
      </View>

      <View style={styles.insights}>
        <View style={styles.inline}>
          <MaterialIcons name="auto-awesome" size={14} color="#06B6D4" />
          <Text style={styles.insightsEyebrow}>NOVA INSIGHTS</Text>
        </View>
        {insights.map((insight) => (
          <View key={insight.text} style={styles.insightRow}>
            <Text style={styles.insightText}>{insight.text}</Text>
            {insight.action ? (
              <Pressable
                onPress={() => {
                  if (insight.actionKind === 'trip') {
                    void startStoreTrip();
                    return;
                  }
                  if (insight.actionKind === 'expand') {
                    const critical = household.groceries.find(
                      (item) => item.status === 'Missing' || item.status === 'Low',
                    );
                    if (critical) setExpandedCat(critical.category);
                  }
                }}
                style={[styles.insightChip, { backgroundColor: `${accentTheme.primary}26` }]}>
                <Text style={[styles.insightChipText, { color: accentTheme.primary }]}>{insight.action}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsRow}>
        <ActionChip
          label={busy ? 'Planning…' : 'Start store itinerary'}
          color={accentTheme.primary}
          onPress={() => void startStoreTrip()}
        />
        <ActionChip
          label="Shopping mode"
          color="#34D399"
          onPress={() => router.push('/shopping-mode' as never)}
        />
        <ActionChip label="Scan barcode" color="#06B6D4" onPress={() => router.push('/scan-grocery' as never)} />
        <ActionChip
          label="Store recommendations"
          color="#A78BFA"
          onPress={() => router.push('/shopping-recommendations' as never)}
        />
        {permissions.canManageGroceries ? (
          <ActionChip
            label={`Preferred: ${preferredStore.name}`}
            color={accentTheme.secondary}
            onPress={() => {
              const idx = PREFERRED_STORES.findIndex((store) => store.id === preferredStore.id);
              const next = PREFERRED_STORES[(idx + 1) % PREFERRED_STORES.length];
              setPreferredStore(next.id);
            }}
          />
        ) : null}
      </ScrollView>

      {permissions.canManageGroceries ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preferred store</Text>
          <View style={styles.storeRow}>
            {PREFERRED_STORES.map((store) => {
              const active = store.id === preferredStore.id;
              return (
                <Pressable
                  key={store.id}
                  onPress={() => setPreferredStore(store.id)}
                  style={[
                    styles.storeChip,
                    active && {
                      backgroundColor: `${accentTheme.primary}22`,
                      borderColor: `${accentTheme.primary}55`,
                    },
                  ]}>
                  <Text style={[styles.storeChipText, active && { color: accentTheme.primary }]}>
                    {store.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {categories.map((cat) => {
        const isExpanded = expandedCat === cat.name;
        const catChecked = cat.items.filter((item) => item.status === 'Purchased').length;
        return (
          <View
            key={cat.name}
            style={[
              styles.catCard,
              isExpanded && { borderColor: `${cat.color}33` },
            ]}>
            <Pressable style={styles.catHeader} onPress={() => setExpandedCat(isExpanded ? null : cat.name)}>
              <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{cat.name}</Text>
                <Text style={styles.caption}>
                  {catChecked}/{cat.items.length} items
                </Text>
              </View>
              <View style={styles.miniBars}>
                {cat.items.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.miniBar,
                      { backgroundColor: item.status === 'Purchased' ? cat.color : 'rgba(255,255,255,0.1)' },
                    ]}
                  />
                ))}
              </View>
              <MaterialIcons
                name={isExpanded ? 'expand-more' : 'chevron-right'}
                size={18}
                color="#4B6080"
              />
            </Pressable>
            {isExpanded ? (
              <View style={styles.catBody}>
                {cat.items.map((item) => {
                  const checked = item.status === 'Purchased';
                  const urgent = item.status === 'Low' || item.status === 'Missing';
                  return (
                    <Pressable key={item.id} style={styles.itemRow} onPress={() => void toggleItem(item)}>
                      <View
                        style={[
                          styles.check,
                          checked && { backgroundColor: cat.color, borderColor: cat.color },
                        ]}>
                        {checked ? <MaterialIcons name="check" size={12} color="#070D1C" /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.inline}>
                          <Text style={[styles.itemName, checked && styles.itemNameDone]}>{item.name}</Text>
                          {urgent && !checked ? (
                            <View style={styles.lowPill}>
                              <Text style={styles.lowPillText}>{item.status === 'Missing' ? 'NEED' : 'LOW'}</Text>
                            </View>
                          ) : null}
                        </View>
                        {item.salePrice != null && !checked ? (
                          <Text style={styles.caption}>On sale · aisle {item.aisle ?? '—'}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.qty}>{item.quantity}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={styles.addInCat}
                  onPress={() => router.push('/add-grocery' as never)}>
                  <MaterialIcons name="add" size={14} color={cat.color} />
                  <Text style={[styles.addInCatText, { color: cat.color }]}>Add item</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}

      <Text style={[styles.caption, { textAlign: 'center', marginTop: 8 }]}>
        Readiness {metrics.groceryReadiness}% · {preferredStore.name}
      </Text>
    </ScrollView>
  );
}

function ActionChip({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionChip, { backgroundColor: `${color}18`, borderColor: `${color}33` }]}>
      <Text style={[styles.actionChipText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#070D1C', flex: 1 },
  content: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
    gap: 14,
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 44,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 36,
    paddingTop: 0,
    width: '100%',
  },
  caption: { color: '#4B6080', fontSize: 12 },
  title: { color: '#EEF2FF', fontSize: 22, fontWeight: '700', lineHeight: 27, marginTop: 2 },
  addBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    marginTop: 2,
    width: 36,
  },
  lookupInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    color: '#EEF2FF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  lookupResult: { gap: 6, marginTop: 10 },
  lookupName: { color: '#EEF2FF', fontSize: 16, fontWeight: '700' },
  unitPrice: { fontSize: 13, fontWeight: '700' },
  lookupActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  lookupBtn: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lookupBtnText: { fontSize: 12, fontWeight: '700' },
  card: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 16,
    width: '100%',
  },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { color: '#EEF2FF', fontSize: 14, fontWeight: '600' },
  inline: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  savings: { color: '#34D399', fontSize: 12, fontWeight: '600' },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: { borderRadius: 999, height: 8 },
  insights: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(6,182,212,0.08)',
    borderColor: 'rgba(56,189,248,0.15)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 16,
    width: '100%',
  },
  insightsEyebrow: { color: '#06B6D4', fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
  insightRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  insightText: { color: '#C8D8F0', flex: 1, fontSize: 12, lineHeight: 18 },
  insightChip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  insightChipText: { fontSize: 11, fontWeight: '600' },
  actionsRow: { gap: 8, paddingVertical: 2 },
  actionChip: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionChipText: { fontSize: 12, fontWeight: '700' },
  storeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  storeChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  storeChipText: { color: '#7C9CC0', fontSize: 12, fontWeight: '600' },
  catCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  catHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 16 },
  miniBars: { flexDirection: 'row', gap: 3, marginRight: 6 },
  miniBar: { borderRadius: 999, height: 16, width: 6 },
  catBody: { borderTopColor: 'rgba(255,255,255,0.05)', borderTopWidth: 1, paddingBottom: 4 },
  itemRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    paddingVertical: 12,
  },
  check: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  itemName: { color: '#EEF2FF', fontSize: 14 },
  itemNameDone: { color: '#4B6080', textDecorationLine: 'line-through' },
  lowPill: {
    backgroundColor: 'rgba(248,113,113,0.15)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lowPillText: { color: '#F87171', fontSize: 9, fontWeight: '700' },
  qty: { color: '#4B6080', fontSize: 12 },
  addInCat: {
    alignItems: 'center',
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  addInCatText: { fontSize: 12, fontWeight: '600' },
});
