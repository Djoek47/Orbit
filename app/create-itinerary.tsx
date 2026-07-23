import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { getPreferredStore } from '@/data/preferred-stores';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { shopNearStops, findNearbyStores } from '@/lib/places/nearby-stores';
import { useOrbit } from '@/store/orbit-store';
import type { ItineraryStopKind, PreferredStore, SavedPlace } from '@/types/orbit';

type DraftStop = {
  key: string;
  label: string;
  kind: ItineraryStopKind;
  address?: string;
  placeQuery?: string;
  lat?: number;
  lng?: number;
  groceryListId?: string;
  savedPlaceId?: string;
};

function placeToStop(place: SavedPlace): DraftStop {
  const kindMap: Record<SavedPlace['kind'], ItineraryStopKind> = {
    home: 'home',
    work: 'work',
    school: 'school',
    shop: 'shop',
    practice: 'practice',
    family: 'family',
    custom: 'custom',
  };
  return {
    key: `place-${place.id}`,
    label: place.name,
    kind: kindMap[place.kind],
    address: place.address,
    placeQuery: place.placeQuery ?? place.address,
    lat: place.lat,
    lng: place.lng,
    savedPlaceId: place.id,
    groceryListId: place.kind === 'shop' ? 'cart-today' : undefined,
  };
}

function storeToStop(store: PreferredStore): DraftStop {
  return {
    key: `store-${store.id}`,
    label: store.name,
    kind: 'grocery',
    address: store.address,
    placeQuery: store.placeQuery,
    lat: store.lat,
    lng: store.lng,
    groceryListId: 'cart-today',
  };
}

export default function CreateItineraryScreen() {
  const { createItinerary, household, preferredStore, accentTheme } = useOrbit();
  const [title, setTitle] = useState('Family run');
  const [selected, setSelected] = useState<DraftStop[]>([]);
  const [nearby, setNearby] = useState<PreferredStore[]>([]);
  const [nearbySource, setNearbySource] = useState<string>('');
  const [passByHint, setPassByHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const date = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const places = household.savedPlaces ?? [];
  const missingCount = household.groceries.filter(
    (g) => g.status === 'Missing' || g.status === 'Low'
  ).length;
  const store = getPreferredStore(household.preferredStoreId);

  useEffect(() => {
    let mounted = true;
    findNearbyStores()
      .then((result) => {
        if (!mounted) return;
        setNearby(result.stores.slice(0, 8));
        setNearbySource(result.source);
      })
      .catch(() => {
        if (mounted) setNearby([preferredStore]);
      });
    return () => {
      mounted = false;
    };
  }, [preferredStore]);

  useEffect(() => {
    if (missingCount === 0 || selected.length === 0) {
      setPassByHint(null);
      return;
    }
    const shop =
      nearby.find((s) => shopNearStops(s, selected, 1500)) ??
      (shopNearStops(store, selected, 1500) ? store : null);
    const alreadyHasGrocery = selected.some((s) => s.kind === 'grocery' || s.kind === 'shop');
    if (shop && !alreadyHasGrocery) {
      setPassByHint(
        `Save a trip — pick up ${missingCount} missing items at ${shop.name} on the way`
      );
    } else {
      setPassByHint(null);
    }
  }, [selected, nearby, missingCount, store]);

  const toggleStop = (stop: DraftStop) => {
    setSelected((current) => {
      if (current.some((item) => item.key === stop.key)) {
        return current.filter((item) => item.key !== stop.key);
      }
      return [...current, stop];
    });
  };

  const addPassByShop = () => {
    const shop =
      nearby.find((s) => shopNearStops(s, selected, 1500)) ??
      (shopNearStops(store, selected, 1500) ? store : preferredStore);
    toggleStop(storeToStop(shop));
    setPassByHint(null);
  };

  const handleCreate = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const created = await createItinerary({
        title,
        date,
        summary: `${selected.length} stops · Maps multi-stop ready`,
        stops: selected.map((stop, index) => ({
          label: stop.label,
          kind: stop.kind,
          address: stop.address,
          placeQuery: stop.placeQuery,
          lat: stop.lat,
          lng: stop.lng,
          groceryListId: stop.groceryListId,
          savedPlaceId: stop.savedPlaceId,
          etaMinutes: 12 + index * 8,
          sortOrder: index,
        })),
      });
      if (created) {
        router.replace(`/itinerary/${created.id}` as never);
      } else {
        router.back();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Plan</Text>
        <Text style={orbitTypography.display}>Create itinerary</Text>
        <Text style={orbitTypography.body}>
          Pick saved places and nearby stores. Open the full trip in your preferred maps app.
        </Text>
      </View>

      <GlassCard>
        <OrbitInput label="Title" value={title} onChangeText={setTitle} />
      </GlassCard>

      {passByHint ? (
        <Pressable
          onPress={addPassByShop}
          style={[styles.hintCard, { borderColor: `${accentTheme.primary}55` }]}>
          <MaterialIcons name="local-grocery-store" size={18} color={accentTheme.primary} />
          <Text style={[styles.hintText, { color: accentTheme.primary }]}>{passByHint}</Text>
          <Text style={styles.hintAdd}>Add</Text>
        </Pressable>
      ) : null}

      <Text style={styles.sectionLabel}>Saved places</Text>
      <View style={styles.chipWrap}>
        {places.map((place) => {
          const stop = placeToStop(place);
          const on = selected.some((s) => s.key === stop.key);
          return (
            <Pressable
              key={place.id}
              onPress={() => toggleStop(stop)}
              style={[styles.chip, on && { backgroundColor: `${accentTheme.primary}28`, borderColor: accentTheme.primary }]}>
              <Text style={[styles.chipText, on && { color: accentTheme.primary }]}>
                {place.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>
        Stores near you{nearbySource ? ` · ${nearbySource}` : ''}
      </Text>
      <View style={styles.chipWrap}>
        {(nearby.length ? nearby : [store]).map((item) => {
          const stop = storeToStop(item);
          const on = selected.some((s) => s.key === stop.key);
          return (
            <Pressable
              key={item.id}
              onPress={() => toggleStop(stop)}
              style={[styles.chip, on && { backgroundColor: `${accentTheme.primary}28`, borderColor: accentTheme.primary }]}>
              <Text style={[styles.chipText, on && { color: accentTheme.primary }]}>
                {item.name}
                {item.distanceMeters != null ? ` · ${Math.round(item.distanceMeters / 100) / 10}km` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selected.length > 0 ? (
        <GlassCard>
          <Text style={orbitTypography.cardTitle}>Stop order</Text>
          {selected.map((stop, index) => (
            <View key={stop.key} style={styles.orderRow}>
              <Text style={styles.orderIndex}>{index + 1}</Text>
              <Text style={styles.orderLabel}>{stop.label}</Text>
              <Pressable onPress={() => toggleStop(stop)}>
                <MaterialIcons name="close" size={18} color={orbitColors.danger} />
              </Pressable>
            </View>
          ))}
        </GlassCard>
      ) : null}

      <OrbitButton disabled={busy || !title.trim() || selected.length === 0} onPress={() => void handleCreate()}>
        {busy ? 'Saving…' : 'Save itinerary'}
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Cancel
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: orbitColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: orbitRadius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    color: orbitColors.textSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  orderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: orbitSpacing.sm,
  },
  orderIndex: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    width: 20,
  },
  orderLabel: {
    color: orbitColors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  hintCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  hintAdd: {
    color: orbitColors.text,
    fontSize: 13,
    fontWeight: '800',
  },
});
