import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { getPreferredStore } from '@/data/preferred-stores';
import { radius, space } from '@/constants/orbit-theme';
import { optimizeDraftStops } from '@/lib/calendar/suggest-itinerary';
import { shopNearStops, findNearbyStores } from '@/lib/places/nearby-stores';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useMajordomoName } from '@/lib/ai/use-majordomo-name';
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
    clothing: 'shop',
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
  const insets = useSafeAreaInsets();
  const { createItinerary, household, preferredStore, accentTheme, upsertSavedPlace } = useOrbit();
  const majordomoName = useMajordomoName();
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const accent = accentTheme.primary;
  const params = useLocalSearchParams<{
    title?: string | string[];
    detail?: string | string[];
    dayLabel?: string | string[];
  }>();
  const paramTitle = Array.isArray(params.title) ? params.title[0] : params.title;
  const paramDay = Array.isArray(params.dayLabel) ? params.dayLabel[0] : params.dayLabel;
  const [title, setTitle] = useState(
    paramTitle?.trim() || (paramDay?.trim() ? `${paramDay.trim()} run` : 'Family run')
  );
  const [selected, setSelected] = useState<DraftStop[]>([]);
  const [nearby, setNearby] = useState<PreferredStore[]>([]);
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
    void (async () => {
      const found = await findNearbyStores();
      if (!mounted) return;
      setNearby(found.stores);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (missingCount === 0 || selected.length === 0) {
      setPassByHint(null);
      return;
    }
    const shop =
      nearby.find((s) => shopNearStops(s, selected, 1500)) ??
      (store && shopNearStops(store, selected, 1500) ? store : null);
    const alreadyHasGrocery = selected.some((s) => s.kind === 'grocery' || s.kind === 'shop');
    if (shop && !alreadyHasGrocery) {
      setPassByHint(`Pick up ${missingCount} at ${shop.name}`);
    } else {
      setPassByHint(null);
    }
  }, [selected, nearby, missingCount, store]);

  const persistNearbyAsPlace = (item: PreferredStore) => {
    upsertSavedPlace({
      id: item.id.startsWith('osm-') ? item.id : `place-${item.id}`,
      name: item.name,
      kind: item.shopKind === 'clothing' ? 'clothing' : 'shop',
      address: item.address?.trim() || '',
      placeQuery: item.placeQuery || item.name,
      lat: item.lat,
      lng: item.lng,
      emoji: item.shopKind === 'clothing' ? '👕' : '🛒',
    });
  };

  const toggleStop = (stop: DraftStop) => {
    setSelected((current) => {
      if (current.some((s) => s.key === stop.key)) {
        return current.filter((s) => s.key !== stop.key);
      }
      return [...current, stop];
    });
  };

  const toggleNearbyStore = (item: PreferredStore) => {
    const stop = storeToStop(item);
    const already = selected.some((s) => s.key === stop.key);
    if (!already) persistNearbyAsPlace(item);
    toggleStop(stop);
  };

  const moveStop = (key: string, direction: -1 | 1) => {
    setSelected((current) => {
      const index = current.findIndex((s) => s.key === key);
      if (index < 0) return current;
      const next = index + direction;
      if (next < 0 || next >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item!);
      return copy;
    });
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

  const addPassByShop = () => {
    const shop =
      nearby.find((s) => shopNearStops(s, selected, 1500)) ??
      (store && shopNearStops(store, selected, 1500) ? store : preferredStore ?? store);
    if (!shop) return;
    toggleNearbyStore(shop);
    setPassByHint(null);
  };

  const handleCreate = async () => {
    if (!title.trim() || selected.length === 0) return;
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

  const Chip = ({
    label,
    on,
    onPress,
    emoji,
  }: {
    label: string;
    on: boolean;
    onPress: () => void;
    emoji?: string;
  }) => (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: on ? `${accent}28` : glass(0.06),
          borderColor: on ? accent : glassBorder(0.1),
        },
      ]}>
      {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
      <Text style={[styles.chipText, { color: on ? accent : c.textSoft }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={22} color={accent} />
          <Text style={[styles.backLabel, { color: accent }]}>Plan</Text>
        </Pressable>
      </View>

      <PersistentScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
        indicatorColor={accent}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.header}>
          <Text style={[styles.eyebrow, { color: accent }]}>Trip</Text>
          <Text style={[styles.pageTitle, { color: c.text }]}>New trip</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(50).duration(260)}>
          <LinearGradient
            colors={[`${accent}30`, `${accent}0A`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.titleCard, { borderColor: `${accent}44` }]}>
            <Text style={[styles.fieldLabel, { color: accent }]}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Family run"
              placeholderTextColor={c.textFaint}
              style={[styles.titleInput, { color: c.text, backgroundColor: glassFill(isDark) }]}
              returnKeyType="done"
            />
          </LinearGradient>
        </Animated.View>

        {passByHint ? (
          <Pressable
            onPress={addPassByShop}
            style={[styles.hintCard, { backgroundColor: `${accent}18`, borderColor: `${accent}55` }]}>
            <MaterialIcons name="local-grocery-store" size={18} color={accent} />
            <Text style={[styles.hintText, { color: c.text }]} numberOfLines={2}>
              {passByHint}
            </Text>
            <Text style={[styles.hintAdd, { color: accent }]}>Add</Text>
          </Pressable>
        ) : null}

        {todayEvents.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(80).duration(260)} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: accent }]}>Today</Text>
            <View style={styles.chipWrap}>
              {todayEvents.map((event) => {
                const stop = eventToStop(event);
                return (
                  <Chip
                    key={event.id}
                    label={event.title}
                    on={selected.some((s) => s.key === stop.key)}
                    onPress={() => toggleStop(stop)}
                    emoji={STOP_EMOJI[stop.kind]}
                  />
                );
              })}
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(100).duration(260)} style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: accent }]}>Places</Text>
            <Pressable onPress={() => router.push('/places' as never)} hitSlop={8}>
              <Text style={[styles.manageLink, { color: accent }]}>Manage</Text>
            </Pressable>
          </View>
          <View style={styles.chipWrap}>
            {places.length === 0 ? (
              <Chip
                label="Add home / work"
                on={false}
                onPress={() => router.push('/places' as never)}
                emoji="📍"
              />
            ) : null}
            {places.map((place) => {
              const stop = placeToStop(place);
              return (
                <Chip
                  key={place.id}
                  label={place.name}
                  on={selected.some((s) => s.key === stop.key)}
                  onPress={() => toggleStop(stop)}
                  emoji={place.emoji || STOP_EMOJI[stop.kind]}
                />
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(260)} style={styles.section}>
          <Text style={[styles.sectionLabel, { color: accent }]}>Nearby</Text>
          <View style={styles.chipWrap}>
            {(nearby.length ? nearby : [store]).filter(Boolean).map((item) => {
              const stop = storeToStop(item!);
              const km =
                item!.distanceMeters != null
                  ? ` · ${Math.round(item!.distanceMeters / 100) / 10}km`
                  : '';
              return (
                <Chip
                  key={item!.id}
                  label={`${item!.name}${km}`}
                  on={selected.some((s) => s.key === stop.key)}
                  onPress={() => toggleNearbyStore(item!)}
                  emoji="🛒"
                />
              );
            })}
          </View>
        </Animated.View>

        {selected.length > 0 ? (
          <Animated.View
            entering={FadeInDown.delay(140).duration(260)}
            style={[
              styles.orderCard,
              { backgroundColor: glass(0.05), borderColor: `${accent}33` },
            ]}>
            <View style={styles.orderHead}>
              <Text style={[styles.orderTitle, { color: c.text }]}>
                {selected.length} stop{selected.length === 1 ? '' : 's'}
              </Text>
              {selected.length > 1 ? (
                <Pressable onPress={handleOptimize} hitSlop={8}>
                  <Text style={[styles.optimizeLink, { color: accent }]}>
                    Optimize · {majordomoName}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {selected.map((stop, index) => (
              <View
                key={stop.key}
                style={[styles.orderRow, { backgroundColor: glass(0.04) }]}>
                <View style={[styles.orderIndex, { backgroundColor: `${accent}22` }]}>
                  <Text style={[styles.orderIndexText, { color: accent }]}>{index + 1}</Text>
                </View>
                <Text style={styles.orderEmoji}>{STOP_EMOJI[stop.kind]}</Text>
                <Text style={[styles.orderLabel, { color: c.text }]} numberOfLines={1}>
                  {stop.label}
                </Text>
                <Pressable onPress={() => moveStop(stop.key, -1)} hitSlop={6}>
                  <MaterialIcons name="keyboard-arrow-up" size={20} color={c.textMuted} />
                </Pressable>
                <Pressable onPress={() => moveStop(stop.key, 1)} hitSlop={6}>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color={c.textMuted} />
                </Pressable>
                <Pressable onPress={() => toggleStop(stop)} hitSlop={6}>
                  <MaterialIcons name="close" size={18} color={c.danger} />
                </Pressable>
              </View>
            ))}
          </Animated.View>
        ) : null}

        <OrbitButton
          disabled={busy || !title.trim() || selected.length === 0}
          onPress={() => void handleCreate()}>
          {busy ? 'Saving…' : 'Create trip'}
        </OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Cancel
        </OrbitButton>
      </PersistentScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  backBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    minHeight: 44,
  },
  backLabel: { fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1 },
  content: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  header: { gap: 2 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  titleCard: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  titleInput: {
    borderCurve: 'continuous',
    borderRadius: 14,
    fontSize: 17,
    fontWeight: '700',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  section: { gap: 10 },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  manageLink: { fontSize: 13, fontWeight: '700' },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipEmoji: { fontSize: 13 },
  chipText: { fontSize: 13, fontWeight: '700', maxWidth: 180 },
  orderCard: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  orderHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  orderTitle: { fontSize: 16, fontWeight: '800' },
  optimizeLink: { fontSize: 13, fontWeight: '700' },
  orderRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    flexDirection: 'row',
    gap: space.xs,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  orderIndex: {
    alignItems: 'center',
    borderRadius: 10,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  orderIndexText: { fontSize: 12, fontWeight: '800' },
  orderEmoji: { fontSize: 15 },
  orderLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
  hintCard: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  hintText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  hintAdd: { fontSize: 13, fontWeight: '800' },
});
