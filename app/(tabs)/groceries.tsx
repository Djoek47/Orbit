import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { scanDealsForHousehold } from '@/data/mock-deals';
import { PREFERRED_STORES } from '@/data/preferred-stores';
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
  const {
    accentTheme,
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

  const listItems = useMemo(
    () =>
      household.groceries.filter(
        (item) => item.status === 'Missing' || item.status === 'Low' || item.status === 'Purchased'
      ),
    [household.groceries]
  );

  const summary = useMemo(() => summarizeShoppingRun(household.groceries), [household.groceries]);
  const budget = 100;
  const leftover = Math.max(0, budget - summary.estimatedTotal);

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.caption}>Grocery Intelligence</Text>
          <Text style={styles.title}>This Week&apos;s List</Text>
        </View>
        {(permissions.canManageGroceries || canAddGroceryWishlist) && (
          <Pressable
            style={[styles.addBtn, { backgroundColor: `${accentTheme.primary}26`, borderColor: `${accentTheme.primary}33` }]}
            onPress={() => router.push('/add-grocery' as never)}>
            <MaterialIcons name="add" size={18} color={accentTheme.primary} />
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.cardTitle}>
              {collected} of {listItems.length} collected
            </Text>
            <Text style={styles.caption}>
              Est. total: ${summary.estimatedTotal.toFixed(0)} · Budget: ${budget}
            </Text>
          </View>
          <View style={styles.inline}>
            <MaterialIcons name="trending-down" size={14} color="#34D399" />
            <Text style={styles.savings}>${leftover.toFixed(0)} left</Text>
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
        <ActionChip label="Scan barcode" color="#06B6D4" onPress={() => router.push('/scan-grocery' as never)} />
        <ActionChip
          label="Store recommendations"
          color="#A78BFA"
          onPress={() => router.push('/shopping-recommendations' as never)}
        />
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
  content: { gap: 14, paddingBottom: 32, paddingHorizontal: 16, paddingTop: 44 },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  caption: { color: '#4B6080', fontSize: 12 },
  title: { color: '#EEF2FF', fontSize: 24, fontWeight: '700', lineHeight: 29 },
  addBtn: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 16,
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
  },
  progressFill: { borderRadius: 999, height: 8 },
  insights: {
    backgroundColor: 'rgba(6,182,212,0.08)',
    borderColor: 'rgba(56,189,248,0.15)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 16,
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
