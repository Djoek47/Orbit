/**
 * "Near home" — one tap saves a nearby place.
 *
 *   NEAR HOME                              ⟳
 *   ┌──────────┐ ┌──────────┐ ┌──────────┐
 *   │ 🛒 Metro │ │ 🛝 Parc  │ │ 🏫 École │
 *   │ 700 m    │ │ 1.2 km   │ │ 400 m    │
 *   │   + Add  │ │   + Add  │ │   + Add  │
 *   └──────────┘ └──────────┘ └──────────┘
 *
 * Looks around Home, or around you before Home is saved. Quiet when location is off or
 * nothing comes back — it's a shortcut, never a step.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import { typography } from '@/constants/orbit-theme';
import {
  coordsForAddress,
  findNearbyStores,
  getCurrentCoords,
} from '@/lib/places/nearby-stores';
import {
  loadCachedOrigin,
  loadLastShownSuggestions,
  saveCachedOrigin,
  saveLastShownSuggestions,
} from '@/lib/places/nearby-cache';
import {
  findNearbySuggestions,
  pickSuggestions,
  suggestionsFromStores,
  type NearbySuggestion,
} from '@/lib/places/nearby-suggestions';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export function NearbySuggestionsRow({ accent }: { accent: string }) {
  const { household, upsertSavedPlace } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const places = household.savedPlaces ?? [];
  const home = places.find((p) => p.kind === 'home');
  const [all, setAll] = useState<NearbySuggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  /** Location is off, rather than "nothing around" — the two need different words. */
  const [noLocation, setNoLocation] = useState(false);

  const homeLat = home?.lat;
  const homeLng = home?.lng;
  const homeAddress = home?.address?.trim();

  const load = useCallback(async (askForLocation = false) => {
    setBusy(true);
    setFailed(false);
    setNoLocation(false);
    try {
      // Home first; then the address we already resolved once; then this phone; then a fresh
      // geocode. The geocode is a network round trip, and doing it on every open left a
      // week-long cache stranded behind it — hence the spinner every single time.
      let origin =
        homeLat != null && homeLng != null ? { lat: homeLat, lng: homeLng } : null;
      if (!origin && homeAddress && !askForLocation) {
        origin = await loadCachedOrigin(homeAddress);
      }
      if (!origin) origin = await getCurrentCoords({ requestIfNeeded: askForLocation });
      if (!origin && homeAddress) {
        origin = await coordsForAddress(homeAddress);
        if (origin) await saveCachedOrigin(homeAddress, origin);
      }
      if (!origin) {
        setAll([]);
        setFailed(true);
        setNoLocation(true);
        return;
      }
      // Refresh button forces a new Overpass hit; otherwise use the week-long cache.
      const found = await findNearbySuggestions(origin, { forceRefresh: askForLocation });
      if (found.length) {
        setAll(found);
        void saveLastShownSuggestions(found);
        return;
      }
      const stores = await findNearbyStores(origin, { forceRefresh: askForLocation });
      const fromStores = suggestionsFromStores(stores.stores, origin);
      setAll(fromStores);
      if (fromStores.length) void saveLastShownSuggestions(fromStores);
      setFailed(fromStores.length === 0);
    } catch (error) {
      console.warn('nearby suggestions', error);
      setAll([]);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [homeAddress, homeLat, homeLng]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Paint whatever was here last time first. Even with every cache warm there are two
      // awaits before results arrive, which is long enough to show a spinner on every open
      // for a row whose answer almost never changes. The real load corrects it behind this.
      const last = await loadLastShownSuggestions();
      if (!cancelled && last?.length) setAll(last);
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const shown = pickSuggestions(all ?? [], places.map((p) => p.name));
  // Only disappear when there is genuinely nothing to say: no results and no way to retry.
  if (!busy && shown.length === 0 && !failed) return null;

  const save = async (suggestion: NearbySuggestion) => {
    setSaving(suggestion.id);
    try {
      upsertSavedPlace({
        id: suggestion.id,
        name: suggestion.name,
        kind: suggestion.kind,
        address: suggestion.address,
        placeQuery: suggestion.address
          ? `${suggestion.name} ${suggestion.address}`
          : suggestion.name,
        lat: suggestion.lat,
        lng: suggestion.lng,
        emoji: suggestion.emoji,
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[typography.eyebrow, { color: c.textSubtle }]}>
          {home ? 'Near home' : 'Near you'}
        </Text>
        <Pressable onPress={() => void load(true)} hitSlop={8} accessibilityLabel="Look again">
          <MaterialIcons name="refresh" size={16} color={c.textSubtle} />
        </Pressable>
      </View>

      {!busy && !shown.length && failed ? (
        <Pressable
          onPress={() => void load(true)}
          style={[
            styles.retry,
            {
              backgroundColor: noLocation ? `${accent}14` : glass(0.05),
              borderColor: noLocation ? `${accent}44` : glassBorder(0.1),
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            noLocation ? 'Use my location to find places nearby' : 'Look for places nearby again'
          }>
          <MaterialIcons
            name={noLocation ? 'my-location' : 'refresh'}
            size={16}
            color={noLocation ? accent : c.textMuted}
          />
          <Text
            style={[
              typography.footnote,
              { color: noLocation ? accent : c.textMuted, flex: 1, fontWeight: noLocation ? '700' : '400' },
            ]}>
            {noLocation
              ? 'Use my location to find shops and parks near you'
              : "Nothing came back just now. Tap to look again."}
          </Text>
        </Pressable>
      ) : busy && !shown.length ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={c.textMuted} />
          <Text style={[typography.footnote, { color: c.textMuted }]}>Looking around…</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {shown.map((suggestion, index) => (
            <Animated.View key={suggestion.id} entering={FadeInDown.delay(index * 50).springify().damping(18)}>
              <Pressable
                onPress={() => void save(suggestion)}
                disabled={saving === suggestion.id}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: glass(0.05),
                    borderColor: glassBorder(0.1),
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Save ${suggestion.name}, ${suggestion.detail}`}>
                <Moji emoji={suggestion.emoji} size={26} />
                <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
                  {suggestion.name}
                </Text>
                <Text style={[styles.detail, { color: c.textSubtle }]} numberOfLines={1}>
                  {suggestion.detail}
                </Text>
                <View style={[styles.add, { backgroundColor: `${accent}1F` }]}>
                  {saving === suggestion.id ? (
                    <ActivityIndicator size="small" color={accent} />
                  ) : (
                    <>
                      <MaterialIcons name="add" size={14} color={accent} />
                      <Text style={[styles.addLabel, { color: accent }]}>Add</Text>
                    </>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  head: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  loading: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingVertical: 10 },
  retry: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  row: { gap: 10, paddingVertical: 2, paddingRight: 4 },
  card: {
    alignItems: 'flex-start',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
    padding: 12,
    width: 136,
  },
  name: { fontSize: 14.5, fontWeight: '800', letterSpacing: -0.2 },
  detail: { fontSize: 11.5, fontWeight: '600' },
  add: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
    minHeight: 28,
    paddingHorizontal: 10,
  },
  addLabel: { fontSize: 12.5, fontWeight: '800' },
});
