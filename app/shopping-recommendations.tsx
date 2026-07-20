import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { orbitColors } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function ShoppingRecommendationsScreen() {
  const insets = useSafeAreaInsets();
  const {
    accentTheme,
    household,
    metrics,
    preferredStore,
    refreshStoreRecommendations,
    setPreferredStore,
    storeRecommendations,
    suggestNovaItinerary,
  } = useOrbit();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshStoreRecommendations();
  }, [refreshStoreRecommendations]);

  async function startTrip() {
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
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.handle} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="close" size={18} color={orbitColors.textMuted} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Grocery</Text>
          <Text style={styles.title}>Store recommendations</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Based on {metrics.missingGroceries} missing items in {household.householdName}. Preferred:{' '}
          {preferredStore.name}.
        </Text>

        {storeRecommendations.map((store) => {
          const storeKey = store.storeId ?? store.id;
          const active = Boolean(store.storeId && store.storeId === preferredStore.id);
          return (
            <Pressable
              key={store.id}
              onPress={() => {
                if (store.storeId) setPreferredStore(store.storeId);
              }}
              style={[
                styles.card,
                active && {
                  borderColor: `${accentTheme.primary}55`,
                  backgroundColor: `${accentTheme.primary}14`,
                },
              ]}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{store.title}</Text>
                <View style={[styles.pill, { backgroundColor: `${accentTheme.primary}26` }]}>
                  <Text style={[styles.pillText, { color: accentTheme.primary }]}>
                    {store.itemCount} items
                  </Text>
                </View>
              </View>
              <Text style={styles.detail}>{store.detail}</Text>
              {store.description ? <Text style={styles.body}>{store.description}</Text> : null}
              {typeof store.etaMinutes === 'number' && store.etaMinutes > 0 ? (
                <Text style={styles.eta}>{store.etaMinutes} min away</Text>
              ) : null}
              {store.storeId ? (
                active ? (
                  <Text style={[styles.preferred, { color: accentTheme.primary }]}>Preferred store</Text>
                ) : (
                  <Text style={styles.tapHint}>Tap to set preferred · {storeKey}</Text>
                )
              ) : null}
            </Pressable>
          );
        })}

        <Pressable onPress={() => void startTrip()} disabled={busy} style={styles.ctaWrap}>
          <LinearGradient
            colors={[accentTheme.primary, accentTheme.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}>
            <MaterialIcons name="route" size={18} color="#04101F" />
            <Text style={styles.ctaText}>
              {busy ? 'Planning…' : `Start itinerary at ${preferredStore.name}`}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={() => router.push('/add-grocery' as never)} style={styles.secondaryBtn}>
          <Text style={[styles.secondaryText, { color: accentTheme.primary }]}>Add missing item</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A1525' },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  kicker: {
    color: orbitColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { color: orbitColors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  content: { padding: 16, gap: 12 },
  subtitle: { color: orbitColors.textSoft, fontSize: 13, lineHeight: 20 },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { color: orbitColors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },
  detail: { color: orbitColors.textMuted, fontSize: 12 },
  body: { color: orbitColors.textSoft, fontSize: 13, lineHeight: 19 },
  eta: { color: orbitColors.novaCyan, fontSize: 13, fontWeight: '700' },
  preferred: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  tapHint: { color: orbitColors.textSubtle, fontSize: 12, marginTop: 2 },
  ctaWrap: { borderRadius: 18, overflow: 'hidden', marginTop: 4 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  ctaText: { color: '#04101F', fontWeight: '800', fontSize: 14 },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secondaryText: { fontSize: 14, fontWeight: '700' },
});
