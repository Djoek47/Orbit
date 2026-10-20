import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import { PlannerMap, type PlannerPin } from '@/components/orbit/trip-planner/planner-map';
import { getPreferredStore } from '@/data/preferred-stores';
import { radius } from '@/constants/orbit-theme';
import { optimizeDraftStops } from '@/lib/calendar/suggest-itinerary';
import { shopNearStops, findNearbyStores } from '@/lib/places/nearby-stores';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import {
  estimateDriveMinutes,
  formatKm,
  formatMinutes,
  hasCoords,
  kmSaved,
  optimizeOrder,
  pathKm,
  type OptimizeMode,
} from '@/lib/trips/route-plan';
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
  emoji?: string;
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
    emoji: place.emoji,
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

type Candidate = { stop: DraftStop; emoji?: string; meta?: string; onAdd?: () => void };
type OptChoice = OptimizeMode | 'ai';

function tapHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export default function CreateItineraryScreen() {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
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
  const [query, setQuery] = useState('');
  const [reorderKey, setReorderKey] = useState<string | null>(null);
  const [optChoice, setOptChoice] = useState<OptChoice | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const date = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const places = household.savedPlaces ?? [];
  const missingCount = household.groceries.filter(
    (g) => g.status === 'Missing' || g.status === 'Low'
  ).length;
  const store = getPreferredStore(household.preferredStoreId);

  const homePlace = places.find((p) => p.kind === 'home' && hasCoords(p));
  const home: PlannerPin | null = homePlace
    ? {
        key: `home-start-${homePlace.id}`,
        label: 'Home',
        isHome: true,
        lat: homePlace.lat!,
        lng: homePlace.lng!,
        emoji: homePlace.emoji,
      }
    : null;
  const homeLL = home ? { lat: home.lat, lng: home.lng } : null;

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
    tapHaptic();
    setOptChoice(null);
    setSavedNote(null);
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
    tapHaptic();
    setOptChoice(null);
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

  /** Every pickable thing — today's events, saved places, nearby shops. */
  const candidates: Candidate[] = useMemo(() => {
    const list: Candidate[] = [];
    for (const event of todayEvents) {
      const stop = eventToStop(event);
      list.push({ stop, meta: 'Today' });
    }
    for (const place of places) {
      list.push({ stop: placeToStop(place), emoji: place.emoji });
    }
    const shops = (nearby.length ? nearby : store ? [store] : []).filter(Boolean);
    for (const item of shops) {
      const stop = storeToStop(item);
      if (list.some((x) => x.stop.key === stop.key)) continue;
      list.push({
        stop,
        emoji: '🛒',
        meta:
          item.distanceMeters != null
            ? `${Math.round(item.distanceMeters / 100) / 10} km`
            : 'Nearby',
        onAdd: () => toggleNearbyStore(item),
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayEvents, places, nearby, store, selected]);

  const filtered = query.trim()
    ? candidates.filter((x) => x.stop.label.toLowerCase().includes(query.trim().toLowerCase()))
    : candidates;

  const pickCandidate = (cand: Candidate) => (cand.onAdd ? cand.onAdd() : toggleStop(cand.stop));

  /** Map pins: every candidate with coordinates, plus chosen stops. */
  const pins: PlannerPin[] = useMemo(() => {
    const out = new Map<string, PlannerPin>();
    const add = (stop: DraftStop, emoji?: string) => {
      if (!hasCoords(stop)) return;
      out.set(stop.key, {
        key: stop.key,
        label: stop.label,
        emoji: emoji ?? STOP_EMOJI[stop.kind],
        lat: stop.lat!,
        lng: stop.lng!,
      });
    };
    for (const cand of candidates) add(cand.stop, cand.emoji);
    for (const stop of selected) add(stop);
    return [...out.values()];
  }, [candidates, selected]);

  const onTogglePin = (key: string) => {
    const chosen = selected.find((s) => s.key === key);
    if (chosen) return toggleStop(chosen);
    const cand = candidates.find((x) => x.stop.key === key);
    if (cand) pickCandidate(cand);
  };

  const currentKm = pathKm(selected, homeLL);
  const located = selected.filter((s) => hasCoords(s)).length;
  const driveMin = estimateDriveMinutes(currentKm, selected.length);

  const applyOrder = (next: DraftStop[], choice: OptChoice, beforeKm: number, afterKm: number) => {
    setSelected(next);
    setOptChoice(choice);
    const saved = kmSaved(beforeKm, afterKm);
    setSavedNote(saved > 0 ? `Saves ${formatKm(saved)}` : 'Already the best order');
    tapHaptic();
  };

  const handleOptimize = (choice: OptChoice) => {
    if (selected.length < 2) return;
    if (choice === 'ai') {
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
      const next = optimized.map((stop, index) => {
        const key = stop.eventId
          ? `event-${stop.eventId}`
          : stop.savedPlaceId
            ? `place-${stop.savedPlaceId}`
            : `opt-${index}-${stop.label}`;
        const prior = selected.find((s) => s.key === key || s.label === stop.label);
        return {
          ...prior,
          key: prior?.key ?? key,
          label: stop.label,
          kind: stop.kind,
          address: stop.address,
          placeQuery: stop.placeQuery,
          lat: stop.lat,
          lng: stop.lng,
          groceryListId: stop.groceryListId,
          savedPlaceId: stop.savedPlaceId,
          eventId: stop.eventId,
        } as DraftStop;
      });
      applyOrder(next, 'ai', currentKm, pathKm(next, homeLL));
      return;
    }
    const back = choice === 'round-trip' ? (homeLL ?? (hasCoords(selected[0]) ? selected[0] : null)) : null;
    const startPt = homeLL ?? null;
    const beforeKm = pathKm(selected, startPt, back as never);
    const next = optimizeOrder(selected, choice, startPt);
    const backAfter = choice === 'round-trip' ? (homeLL ?? (hasCoords(next[0]) ? next[0] : null)) : null;
    applyOrder(next, choice, beforeKm, pathKm(next, startPt, backAfter as never));
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

  const sheetTop = Math.round(screenH * 0.52);
  const sheetBg = isDark ? '#0B1424' : '#FFFFFF';
  const optOptions: { id: OptChoice; label: string }[] = [
    { id: 'shortest', label: 'Shortest' },
    { id: 'round-trip', label: home ? 'Round trip home' : 'Round trip' },
    { id: 'ai', label: `Ask ${majordomoName}` },
  ];
  const canCreate = !busy && !!title.trim() && selected.length > 0;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.mapWrap, { height: sheetTop + 28 }]}>
        <PlannerMap
          pins={pins}
          stopKeys={selected.map((s) => s.key)}
          home={home}
          accent={accent}
          onTogglePin={onTogglePin}
          bottomInset={40}
        />
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={[styles.backBtn, { top: insets.top + 6, backgroundColor: sheetBg, borderColor: glassBorder(0.12) }]}>
          <MaterialIcons name="chevron-left" size={22} color={accent} />
          <Text style={[styles.backLabel, { color: c.text }]}>Plan</Text>
        </Pressable>
        {pins.length === 0 ? (
          <View style={[styles.mapHint, { top: insets.top + 56, backgroundColor: sheetBg }]}>
            <Text style={[styles.mapHintText, { color: c.textMuted }]}>
              Save places with an address to see them on the map.
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.sheet,
          { top: sheetTop, backgroundColor: sheetBg, borderColor: glassBorder(0.1) },
        ]}>
        <View style={[styles.handle, { backgroundColor: glassBorder(0.3) }]} />
        <ScrollView
          contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Family run"
            placeholderTextColor={c.textMuted}
            style={[styles.titleInput, { color: c.text }]}
            returnKeyType="done"
            accessibilityLabel="Trip title"
          />

          {selected.length > 0 ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.summaryRow}>
              <Text style={[styles.summaryText, { color: c.text }]}>
                {selected.length} stop{selected.length === 1 ? '' : 's'}
                {located >= 1 ? ` · ${formatKm(currentKm)} · ~${formatMinutes(driveMin)}` : ''}
              </Text>
              {savedNote ? (
                <Text style={[styles.savedNote, { color: accent }]}>{savedNote}</Text>
              ) : null}
            </Animated.View>
          ) : (
            <Text style={[styles.emptyHint, { color: c.textMuted }]}>
              Tap pins on the map or places below to add stops.
            </Text>
          )}

          {passByHint ? (
            <Pressable
              onPress={addPassByShop}
              style={[styles.hintCard, { backgroundColor: `${accent}18`, borderColor: `${accent}55` }]}>
              <MaterialIcons name="local-grocery-store" size={18} color={accent} />
              <Text style={[styles.hintText, { color: c.text }]} numberOfLines={2}>
                {passByHint}
              </Text>
              <Text style={[styles.hintAdd, { color: c.text }]}>Add</Text>
            </Pressable>
          ) : null}

          {selected.map((stop, index) => (
            <Animated.View
              key={stop.key}
              layout={LinearTransition.springify().damping(18)}
              entering={FadeInDown.duration(200)}>
              <Pressable
                onLongPress={() => {
                  tapHaptic();
                  setReorderKey((k) => (k === stop.key ? null : stop.key));
                }}
                delayLongPress={250}
                style={[
                  styles.stopRow,
                  {
                    backgroundColor: glass(0.05),
                    borderColor: reorderKey === stop.key ? accent : 'transparent',
                  },
                ]}>
                <View style={[styles.stopNum, { backgroundColor: accent }]}>
                  <Text style={styles.stopNumText}>{index + 1}</Text>
                </View>
                <Moji emoji={stop.emoji ?? STOP_EMOJI[stop.kind]} size={18} fallback="pin" />
                <Text style={[styles.stopLabel, { color: c.text }]} numberOfLines={1}>
                  {stop.label}
                </Text>
                {!hasCoords(stop) ? (
                  <MaterialIcons name="location-off" size={14} color={c.textMuted} />
                ) : null}
                {reorderKey === stop.key ? (
                  <>
                    <Pressable onPress={() => moveStop(stop.key, -1)} hitSlop={6} accessibilityLabel="Move up">
                      <MaterialIcons name="keyboard-arrow-up" size={22} color={c.text} />
                    </Pressable>
                    <Pressable onPress={() => moveStop(stop.key, 1)} hitSlop={6} accessibilityLabel="Move down">
                      <MaterialIcons name="keyboard-arrow-down" size={22} color={c.text} />
                    </Pressable>
                  </>
                ) : (
                  <MaterialIcons name="drag-indicator" size={18} color={c.textMuted} />
                )}
                <Pressable onPress={() => toggleStop(stop)} hitSlop={6} accessibilityLabel="Remove stop">
                  <MaterialIcons name="close" size={18} color={c.textMuted} />
                </Pressable>
              </Pressable>
            </Animated.View>
          ))}
          {selected.length > 1 ? (
            <Text style={[styles.tinyHint, { color: c.textMuted }]}>Long-press a stop to reorder</Text>
          ) : null}

          {selected.length > 1 ? (
            <View style={styles.block}>
              <Text style={[styles.blockLabel, { color: c.textMuted }]}>Optimize order</Text>
              <View style={[styles.segment, { backgroundColor: glass(0.06) }]}>
                {optOptions.map((o) => {
                  const on = optChoice === o.id;
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => handleOptimize(o.id)}
                      style={[styles.segBtn, on && { backgroundColor: accent }]}>
                      <Text
                        numberOfLines={1}
                        style={[styles.segText, { color: on ? '#0B1220' : c.text }]}>
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.tinyHint, { color: c.textMuted }]}>
                {home ? 'Starts from Home. ' : ''}Straight-line distance; drive time assumes ~30 km/h + 5 min a stop.
              </Text>
            </View>
          ) : null}

          <View style={styles.block}>
            <View style={styles.addHead}>
              <Text style={[styles.blockLabel, { color: c.textMuted }]}>Add a place</Text>
              <Pressable onPress={() => router.push('/places' as never)} hitSlop={8}>
                <Text style={[styles.manageLink, { color: c.text }]}>Manage</Text>
              </Pressable>
            </View>
            <View style={[styles.search, { backgroundColor: glass(0.06) }]}>
              <MaterialIcons name="search" size={18} color={c.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Filter places"
                placeholderTextColor={c.textMuted}
                style={[styles.searchInput, { color: c.text }]}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scroller}
              keyboardShouldPersistTaps="handled">
              {places.length === 0 ? (
                <Pressable
                  onPress={() => router.push('/places' as never)}
                  style={[styles.card, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}>
                  <Moji name="home" size={24} />
                  <Text style={[styles.cardLabel, { color: c.text }]}>Add home / work</Text>
                </Pressable>
              ) : null}
              {filtered.map((cand) => {
                const on = selected.some((s) => s.key === cand.stop.key);
                const noLoc = !hasCoords(cand.stop);
                return (
                  <Pressable
                    key={cand.stop.key}
                    onPress={() => pickCandidate(cand)}
                    style={[
                      styles.card,
                      {
                        backgroundColor: on ? `${accent}26` : glass(0.06),
                        borderColor: on ? accent : glassBorder(0.1),
                      },
                    ]}>
                    <View>
                      <Moji emoji={cand.emoji ?? STOP_EMOJI[cand.stop.kind]} size={24} fallback="pin" />
                      {on ? (
                        <View style={[styles.cardCheck, { backgroundColor: accent }]}>
                          <MaterialIcons name="check" size={10} color="#0B1220" />
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.cardLabel, { color: c.text }]} numberOfLines={1}>
                      {cand.stop.label}
                    </Text>
                    <View style={styles.cardMetaRow}>
                      {noLoc ? <MaterialIcons name="location-off" size={11} color={c.textMuted} /> : null}
                      <Text style={[styles.cardMeta, { color: c.textMuted }]} numberOfLines={1}>
                        {noLoc ? 'No location' : cand.meta ?? 'Saved'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <Pressable
            disabled={!canCreate}
            onPress={() => void handleCreate()}
            style={({ pressed }) => [
              styles.primary,
              {
                backgroundColor: accent,
                opacity: canCreate ? 1 : 0.45,
                borderBottomWidth: pressed ? 1 : 4,
                transform: [{ translateY: pressed ? 3 : 0 }],
              },
            ]}>
            <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Create trip'}</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.cancel}>
            <Text style={[styles.cancelText, { color: c.textMuted }]}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mapWrap: { left: 0, position: 'absolute', right: 0, top: 0 },
  backBtn: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    left: 12,
    minHeight: 40,
    paddingLeft: 4,
    paddingRight: 12,
    position: 'absolute',
  },
  backLabel: { fontSize: 15, fontWeight: '700' },
  mapHint: { borderRadius: 12, left: 16, padding: 10, position: 'absolute', right: 16 },
  mapHintText: { fontSize: 13, textAlign: 'center' },
  sheet: {
    borderCurve: 'continuous',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  handle: { alignSelf: 'center', borderRadius: 3, height: 5, marginTop: 8, width: 40 },
  sheetContent: { gap: 10, paddingHorizontal: 16, paddingTop: 6 },
  titleInput: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4, paddingVertical: 4 },
  summaryRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  summaryText: { fontSize: 17, fontWeight: '600' },
  savedNote: { fontSize: 13, fontWeight: '700' },
  emptyHint: { fontSize: 13 },
  tinyHint: { fontSize: 12 },
  stopRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  stopNum: { alignItems: 'center', borderRadius: 11, height: 22, justifyContent: 'center', width: 22 },
  stopNumText: { color: '#0B1220', fontSize: 12, fontWeight: '800' },
  stopLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  block: { gap: 8, marginTop: 4 },
  blockLabel: { fontSize: 13, fontWeight: '600' },
  segment: { borderRadius: 12, flexDirection: 'row', padding: 3 },
  segBtn: { alignItems: 'center', borderRadius: 10, flex: 1, paddingVertical: 8 },
  segText: { fontSize: 13, fontWeight: '700' },
  addHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  manageLink: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  search: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 6, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 15, minHeight: 38 },
  scroller: { gap: 8, paddingRight: 8 },
  card: {
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    padding: 10,
    width: 112,
  },
  cardCheck: {
    alignItems: 'center',
    borderRadius: 7,
    height: 14,
    justifyContent: 'center',
    left: 16,
    position: 'absolute',
    top: -2,
    width: 14,
  },
  cardLabel: { fontSize: 13, fontWeight: '700' },
  cardMetaRow: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  cardMeta: { fontSize: 11 },
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
  primary: {
    alignItems: 'center',
    borderBottomColor: 'rgba(0,0,0,0.28)',
    borderCurve: 'continuous',
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
  },
  primaryText: { color: '#0B1220', fontSize: 17, fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 15, fontWeight: '600' },
});
