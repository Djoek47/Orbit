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
import { getCurrentCoords } from '@/lib/places/nearby-stores';
import {
  findNearbySuggestions,
  pickSuggestions,
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

  const homeLat = home?.lat;
  const homeLng = home?.lng;

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const origin =
        homeLat != null && homeLng != null
          ? { lat: homeLat, lng: homeLng }
          : await getCurrentCoords({ requestIfNeeded: false });
      if (!origin) {
        setAll([]);
        return;
      }
      setAll(await findNearbySuggestions(origin));
    } finally {
      setBusy(false);
    }
  }, [homeLat, homeLng]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const shown = pickSuggestions(all ?? [], places.map((p) => p.name));
  if (!busy && shown.length === 0) return null;

  const save = async (suggestion: NearbySuggestion) => {
    setSaving(suggestion.id);
    try {
      upsertSavedPlace({
        id: suggestion.id,
        name: suggestion.name,
        kind: suggestion.kind,
        address: suggestion.address,
        placeQuery: `${suggestion.name} ${suggestion.address}`,
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
        <Pressable onPress={() => void load()} hitSlop={8} accessibilityLabel="Look again">
          <MaterialIcons name="refresh" size={16} color={c.textSubtle} />
        </Pressable>
      </View>

      {busy && !shown.length ? (
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
