import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { RouteSteps } from '@/components/orbit/route-steps';
import { getPreferredStore } from '@/data/preferred-stores';
import { orbitColors, orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import { optimizeDraftStops } from '@/lib/calendar/suggest-itinerary';
import { shopNearStops, findNearbyStores } from '@/lib/places/nearby-stores';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdEvent, ItineraryStopKind, PreferredStore, SavedPlace } from '@/types/orbit';

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
  eventId?: string;
};

const STOP_EMOJI: Record<ItineraryStopKind, string> = {
  school: '🏫',
  work: '💼',
  grocery: '🛒',
  pickup: '📦',
  practice: '🏃',
  family: '🏠',
  home: '🏡',
  shop: '🛒',
  custom: '📍',
};

const STOP_CATEGORY: Record<ItineraryStopKind, string> = {
  school: 'School',
  work: 'Work',
  grocery: 'Grocery',
  pickup: 'Pickup',
  practice: 'Practice',
  family: 'Family',
  home: 'Home',
  shop: 'Shop',
  custom: 'Errand',
};

function placeToStop(place: SavedPlace): DraftStop {
  const kindMap: Record<SavedPlace['kind'], ItineraryStopKind> = {
    home: 'home',
    work: 'work',
    school: 'school',
    shop: 'shop',
    practice: 'practice',
    family: 'family',
    cafe: 'custom',
    pickup: 'pickup',
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

function eventToStop(event: HouseholdEvent): DraftStop {
  const kind: ItineraryStopKind =
    event.category === 'School'
      ? 'school'
      : event.category === 'Activity'
        ? 'practice'
        : event.category === 'Appointment'
          ? 'pickup'
          : 'custom';
  return {
    key: `event-${event.id}`,
    label: event.title,
    kind,
    address: event.location,
    placeQuery: event.location,
    eventId: event.id,
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

  const todayEvents = useMemo(() => {
    return household.events.filter(
      (event) => /today/i.test(event.date) || event.startsAt?.startsWith(date)
    );
  }, [household.events, date]);

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

  const moveStop = (key: string, direction: -1 | 1) => {
    setSelected((current) => {
      const index = current.findIndex((s) => s.key === key);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[next]] = [copy[next]!, copy[index]!];
      return copy;
    });
  };

  const addPassByShop = () => {
    const shop =
      nearby.find((s) => shopNearStops(s, selected, 1500)) ??
      (shopNearStops(store, selected, 1500) ? store : preferredStore);
    toggleStop(storeToStop(shop));
    setPassByHint(null);
  };

  const handleOptimize = () => {
    const optimized = optimizeDraftStops(
      selected.map((stop, index) => ({
        label: stop.label,
        kind: stop.kind,
        address: stop.address,
        placeQuery: stop.placeQuery,
        lat: stop.lat,
        lng: stop.lng,
        groceryListId: stop.groceryListId,
        savedPlaceId: stop.savedPlaceId,
        eventId: stop.eventId,
        etaMinutes: 12 + index * 8,
        sortOrder: index,
      })),
      'efficient'
    );
    setSelected(
      optimized.map((stop, index) => ({
        key: stop.eventId
          ? `event-${stop.eventId}`
          : stop.savedPlaceId
            ? `place-${stop.savedPlaceId}`
            : `opt-${index}-${stop.label}`,
        label: stop.label,
        kind: stop.kind,
        address: stop.address,
        placeQuery: stop.placeQuery,
        lat: stop.lat,
        lng: stop.lng,
        groceryListId: stop.groceryListId,
        savedPlaceId: stop.savedPlaceId,
        eventId: stop.eventId,
      }))
    );
  };

  const handleCreate = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const created = await createItinerary({
        title,
        date,
        summary: `${selected.length} stops`,
        stops: selected.map((stop, index) => ({
          label: stop.label,
          kind: stop.kind,
          address: stop.address,
          placeQuery: stop.placeQuery,
          lat: stop.lat,
          lng: stop.lng,
          groceryListId: stop.groceryListId,
          savedPlaceId: stop.savedPlaceId,
          eventId: stop.eventId,
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
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={orbitScreen.header}>
        <Text style={typography.footnote}>Plan</Text>
        <Text style={typography.title1}>New trip</Text>
        <Text style={typography.body}>
          Add stops from places, today’s calendar, or nearby stores.
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

      {todayEvents.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Today’s calendar</Text>
          <View style={styles.chipWrap}>
            {todayEvents.map((event) => {
              const stop = eventToStop(event);
              const on = selected.some((s) => s.key === stop.key);
              return (
                <Pressable
                  key={event.id}
                  onPress={() => toggleStop(stop)}
                  style={[
                    styles.chip,
                    on && { backgroundColor: `${accentTheme.primary}28`, borderColor: accentTheme.primary },
                  ]}>
                  <Text style={[styles.chipText, on && { color: accentTheme.primary }]}>
                    {event.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>Saved places</Text>
        <Pressable onPress={() => router.push('/places' as never)} hitSlop={8}>
          <Text style={[styles.manageLink, { color: accentTheme.primary }]}>Manage</Text>
        </Pressable>
      </View>
      <View style={styles.chipWrap}>
        {places.length === 0 ? (
          <Pressable
            onPress={() => router.push('/places' as never)}
            style={[styles.chip, { borderColor: `${accentTheme.primary}55` }]}>
            <Text style={[styles.chipText, { color: accentTheme.primary }]}>Add home / work…</Text>
          </Pressable>
        ) : null}
        {places.map((place) => {
          const stop = placeToStop(place);
          const on = selected.some((s) => s.key === stop.key);
          return (
            <Pressable
              key={place.id}
              onPress={() => toggleStop(stop)}
              style={[
                styles.chip,
                on && { backgroundColor: `${accentTheme.primary}28`, borderColor: accentTheme.primary },
              ]}>
              <Text style={[styles.chipText, on && { color: accentTheme.primary }]}>{place.name}</Text>
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
              style={[
                styles.chip,
                on && { backgroundColor: `${accentTheme.primary}28`, borderColor: accentTheme.primary },
              ]}>
              <Text style={[styles.chipText, on && { color: accentTheme.primary }]}>
                {item.name}
                {item.distanceMeters != null
                  ? ` · ${Math.round(item.distanceMeters / 100) / 10}km`
                  : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selected.length > 0 ? (
        <GlassCard
          elevated
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderColor: `${accentTheme.primary}28`,
          }}>
          <View style={styles.orderHead}>
            <Text style={typography.headline}>Stop order</Text>
            <Pressable onPress={handleOptimize} hitSlop={8}>
              <Text style={[styles.optimizeLink, { color: accentTheme.primary }]}>
                Optimize with Nova
              </Text>
            </Pressable>
          </View>
          <RouteSteps
            steps={selected.map((stop, index) => ({
              id: stop.key,
              emoji: STOP_EMOJI[stop.kind],
              title: stop.label,
              address: stop.address || stop.placeQuery,
              category: STOP_CATEGORY[stop.kind],
              driveMinutes: index < selected.length - 1 ? 5 : undefined,
              estimatedMinutes: 12 + index * 8,
            }))}
            accentColor={accentTheme.primary}
            emphasized
          />
          <View style={{ gap: 4, marginTop: 8 }}>
            {selected.map((stop, index) => (
              <View key={stop.key} style={styles.orderRow}>
                <Text style={styles.orderIndex}>{index + 1}</Text>
                <Text style={styles.orderLabel}>{stop.label}</Text>
                <Pressable onPress={() => moveStop(stop.key, -1)} hitSlop={6}>
                  <MaterialIcons name="keyboard-arrow-up" size={20} color={orbitColors.textMuted} />
                </Pressable>
                <Pressable onPress={() => moveStop(stop.key, 1)} hitSlop={6}>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color={orbitColors.textMuted} />
                </Pressable>
                <Pressable onPress={() => toggleStop(stop)}>
                  <MaterialIcons name="close" size={18} color={orbitColors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        </GlassCard>
      ) : null}

      <OrbitButton
        disabled={busy || !title.trim() || selected.length === 0}
        onPress={() => void handleCreate()}>
        {busy ? 'Saving…' : 'Create trip'}
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Cancel
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: orbitColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  manageLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    color: orbitColors.textSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  orderHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  optimizeLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  orderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.xs,
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
