import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitListItem } from '@/components/orbit/orbit-list-item';
import { StatusPill } from '@/components/orbit/status-pill';
import { PREFERRED_STORES } from '@/data/preferred-stores';
import { scanDealsForHousehold } from '@/data/mock-deals';
import { summarizeShoppingRun } from '@/lib/grocery/savings';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

const statusTone = {
  Available: 'green',
  Low: 'amber',
  Missing: 'red',
  Purchased: 'cyan',
} as const;

export default function GroceriesScreen() {
  const {
    canAddGroceryWishlist,
    household,
    markGroceryLow,
    markGroceryPurchased,
    metrics,
    permissions,
    preferredStore,
    setPreferredStore,
    suggestNovaItinerary,
  } = useOrbit();
  const missing = household.groceries.filter((item) => item.status === 'Missing');
  const purchased = household.groceries.filter((item) => item.status === 'Purchased');
  const available = household.groceries.filter((item) => item.status !== 'Missing' && item.status !== 'Purchased');
  const summary = useMemo(() => summarizeShoppingRun(household.groceries), [household.groceries]);
  const deals = useMemo(
    () =>
      scanDealsForHousehold({
        groceryNames: household.groceries
          .filter((item) => item.status === 'Missing' || item.status === 'Low')
          .map((item) => item.name),
      }).slice(0, 4),
    [household.groceries]
  );

  const startStoreTrip = async () => {
    const created = await suggestNovaItinerary();
    if (created) {
      router.push(`/itinerary/${created.id}` as never);
    } else {
      router.push('/(tabs)/plan' as never);
    }
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Grocery Intelligence</Text>
        <Text style={orbitTypography.display}>This Week&apos;s List</Text>
        <Text style={orbitTypography.body}>
          {metrics.groceryReadiness}% readiness · Preferred store {preferredStore.name}
        </Text>
      </View>

      <GlassCard elevated style={styles.card}>
        <Text style={orbitTypography.cardTitle}>
          {summary.itemCount} cart items · Est. ${summary.estimatedTotal.toFixed(2)}
        </Text>
        <Text style={styles.savings}>
          {summary.onSaleCount} on sale · save ~${summary.estimatedSavings.toFixed(2)}
        </Text>
        <OrbitButton onPress={startStoreTrip}>Start store itinerary</OrbitButton>
      </GlassCard>

      {deals.length > 0 ? (
        <GlassCard style={styles.card}>
          <Text style={orbitTypography.cardTitle}>Nova deals</Text>
          <Text style={orbitTypography.caption}>Mock catalog · food + household goods</Text>
          {deals.map((deal) => (
            <View key={deal.id} style={styles.dealRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dealTitle}>{deal.title}</Text>
                <Text style={orbitTypography.caption}>
                  {deal.store} · {deal.category} · save ${deal.savings.toFixed(2)}
                </Text>
              </View>
              <StatusPill label={`$${deal.salePrice}`} tone="green" />
            </View>
          ))}
        </GlassCard>
      ) : null}

      <View style={styles.actions}>
        {permissions.canManageGroceries || canAddGroceryWishlist ? (
          <>
            <OrbitButton onPress={() => router.push('/scan-grocery' as never)}>Scan barcode</OrbitButton>
            <OrbitButton tone="secondary" onPress={() => router.push('/add-grocery' as never)}>
              + Missing Item
            </OrbitButton>
          </>
        ) : (
          <Text style={orbitTypography.caption}>Earn XP to unlock wishlist adds, or ask a parent.</Text>
        )}
        <OrbitButton tone="secondary" onPress={() => router.push('/shopping-recommendations' as never)}>
          Store recommendations
        </OrbitButton>
      </View>

      {permissions.canManageGroceries ? (
        <GlassCard style={styles.card}>
          <Text style={orbitTypography.cardTitle}>Preferred store</Text>
          {PREFERRED_STORES.map((store) => (
            <OrbitButton
              key={store.id}
              tone={store.id === preferredStore.id ? 'primary' : 'secondary'}
              onPress={() => setPreferredStore(store.id)}>
              {store.name}
            </OrbitButton>
          ))}
        </GlassCard>
      ) : null}

      <GlassCard elevated>
        <Text style={orbitTypography.cardTitle}>Shopping order (aisle)</Text>
        {summary.aisleOrder.length === 0 ? (
          <Text style={orbitTypography.caption}>Nothing missing right now.</Text>
        ) : (
          <View style={styles.list}>
            {summary.aisleOrder.map((item) => (
              <OrbitListItem
                key={item.id}
                meta={`${item.aisle ?? '—'} · ${item.quantity}${item.salePrice != null ? ' · On sale' : ''}`}
                title={item.name}
                trailing={
                  <OrbitButton style={styles.smallButton} tone="secondary" onPress={() => markGroceryPurchased(item.id)}>
                    Got it
                  </OrbitButton>
                }
              />
            ))}
          </View>
        )}
      </GlassCard>

      <Text style={orbitTypography.title}>Purchased</Text>
      {purchased.length === 0 ? (
        <GlassCard>
          <Text style={orbitTypography.caption}>Purchased items will appear here.</Text>
        </GlassCard>
      ) : (
        purchased.map((item) => (
          <GlassCard key={item.id}>
            <OrbitListItem
              meta={`${item.category} · ${item.quantity}`}
              title={item.name}
              trailing={<StatusPill label={item.status} tone="cyan" />}
            />
          </GlassCard>
        ))
      )}

      <Text style={orbitTypography.title}>Inventory</Text>
      {available.map((item) => (
        <GlassCard key={item.id}>
          <OrbitListItem
            meta={`${item.category} · ${item.quantity} · ${item.location}`}
            title={item.name}
            trailing={
              <View style={styles.trailing}>
                <StatusPill label={item.status} tone={statusTone[item.status]} />
                {permissions.canManageGroceries && item.status === 'Available' ? (
                  <OrbitButton style={styles.smallButton} tone="secondary" onPress={() => markGroceryLow(item.id)}>
                    Low
                  </OrbitButton>
                ) : null}
              </View>
            }
          />
        </GlassCard>
      ))}
      {missing.length === 0 && available.length === 0 ? (
        <GlassCard>
          <Text style={orbitTypography.caption}>Inventory is empty.</Text>
        </GlassCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: orbitSpacing.sm,
  },
  card: {
    gap: orbitSpacing.sm,
  },
  dealRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  dealTitle: {
    color: orbitColors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  list: {
    gap: orbitSpacing.sm,
    marginTop: orbitSpacing.sm,
  },
  savings: {
    color: orbitColors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  smallButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 6,
  },
});
