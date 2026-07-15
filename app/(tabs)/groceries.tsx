import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitListItem } from '@/components/orbit/orbit-list-item';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

const statusTone = {
  Available: 'green',
  Low: 'amber',
  Missing: 'red',
  Purchased: 'cyan',
} as const;

export default function GroceriesScreen() {
  const { household, markGroceryPurchased, metrics } = useOrbit();
  const missing = household.groceries.filter((item) => item.status === 'Missing');
  const purchased = household.groceries.filter((item) => item.status === 'Purchased');
  const available = household.groceries.filter((item) => item.status !== 'Missing' && item.status !== 'Purchased');

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Inventory intelligence</Text>
        <Text style={orbitTypography.display}>Groceries</Text>
        <Text style={orbitTypography.body}>{metrics.groceryReadiness}% grocery readiness from local inventory state.</Text>
      </View>

      <OrbitButton onPress={() => router.push('/add-grocery' as never)}>+ Missing Item</OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.push('/shopping-recommendations' as never)}>
        Store recommendations
      </OrbitButton>

      <GlassCard elevated>
        <Text style={orbitTypography.cardTitle}>Missing items</Text>
        {missing.length === 0 ? <Text style={orbitTypography.caption}>Nothing missing right now.</Text> : null}
        <View style={styles.list}>
          {missing.map((item) => (
            <OrbitListItem
              key={item.id}
              meta={`${item.category} • ${item.quantity} • ${item.location}`}
              title={item.name}
              trailing={
                <OrbitButton style={styles.smallButton} tone="secondary" onPress={() => markGroceryPurchased(item.id)}>
                  Purchased
                </OrbitButton>
              }
            />
          ))}
        </View>
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
              meta={`${item.category} • ${item.quantity} • ${item.location}`}
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
            meta={`${item.category} • ${item.quantity} • ${item.location}`}
            title={item.name}
            trailing={<StatusPill label={item.status} tone={statusTone[item.status]} />}
          />
        </GlassCard>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: orbitSpacing.md,
  },
  smallButton: {
    minHeight: 44,
    paddingHorizontal: orbitSpacing.md,
  },
});
