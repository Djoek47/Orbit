import { useEffect } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function ShoppingRecommendationsScreen() {
  const { household, metrics, refreshStoreRecommendations, storeRecommendations } = useOrbit();

  useEffect(() => {
    refreshStoreRecommendations();
  }, [refreshStoreRecommendations]);

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Grocery</Text>
        <Text style={orbitTypography.display}>Store recommendations</Text>
        <Text style={orbitTypography.body}>
          Based on {metrics.missingGroceries} missing items in {household.householdName}.
        </Text>
      </View>

      {storeRecommendations.map((store) => (
        <GlassCard key={store.id} style={styles.card}>
          <View style={orbitScreen.row}>
            <Text style={orbitTypography.cardTitle}>{store.title}</Text>
            <StatusPill label={`${store.itemCount} items`} tone="cyan" />
          </View>
          <Text style={orbitTypography.caption}>{store.detail}</Text>
          {store.description ? <Text style={orbitTypography.body}>{store.description}</Text> : null}
          {typeof store.etaMinutes === 'number' ? (
            <Text style={styles.eta}>{store.etaMinutes} min away</Text>
          ) : null}
        </GlassCard>
      ))}

      <OrbitButton tone="secondary" onPress={() => router.push('/add-grocery' as never)}>
        Add missing item
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Back
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: orbitSpacing.sm,
  },
  eta: {
    color: orbitColors.novaCyan,
    fontSize: 13,
    fontWeight: '700',
  },
});
