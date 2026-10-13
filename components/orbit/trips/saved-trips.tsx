/**
 * Saved (starred) trips — a chip that opens an inline list. Each row: title, stop count,
 * a short stop preview, last used; actions Start again (rerunItinerary) and unstar.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { Itinerary } from '@/types/orbit';

export const SAVED_GOLD = '#F2B940';

export function useSavedTrips(): Itinerary[] {
  const { household } = useOrbit();
  return useMemo(
    () => (household.itineraries ?? []).filter((trip) => trip.favorite),
    [household.itineraries]
  );
}

function lastUsedLabel(trip: Itinerary, all: Itinerary[]): string {
  const dates = all.filter((t) => t.title === trip.title).map((t) => t.date).filter(Boolean);
  const last = dates.sort().at(-1) ?? trip.date;
  if (!last) return '';
  const today = new Date().toISOString().slice(0, 10);
  if (last === today) return 'Used today';
  const days = Math.round((Date.parse(today) - Date.parse(last)) / 86_400_000);
  if (days === 1) return 'Used yesterday';
  if (days > 1 && days < 14) return `Used ${days} days ago`;
  const d = new Date(`${last}T12:00:00`);
  return `Used ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

/** The "★ Saved (N)" chip. `open` drives the chevron. */
export function SavedTripsChip({
  count,
  open,
  onPress,
  compact,
}: {
  count: number;
  open: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        {
          backgroundColor: `${SAVED_GOLD}${open ? '33' : '22'}`,
          borderColor: `${SAVED_GOLD}88`,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`Saved trips, ${count}`}>
      <MaterialIcons name="star" size={16} color={SAVED_GOLD} />
      <Text style={[styles.chipLabel, { color: SAVED_GOLD }]} numberOfLines={1}>
        Saved ({count})
      </Text>
    </Pressable>
  );
}

export function SavedTripsList({ trips }: { trips: Itinerary[] }) {
  const { c, glass, glassBorder } = useOrbitColors();
  const { household, rerunItinerary, toggleItineraryFavorite } = useOrbit();
  const [busyId, setBusyId] = useState<string | null>(null);
  const all = household.itineraries ?? [];

  const start = async (trip: Itinerary) => {
    setBusyId(trip.id);
    try {
      const created = await rerunItinerary(trip.id);
      if (created) router.push(`/itinerary/${created.id}` as never);
    } catch {
      orbitAlert('Couldn’t start this trip. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOut.duration(140)}
      style={[styles.list, { backgroundColor: glass(0.04), borderColor: `${SAVED_GOLD}44` }]}>
      {trips.map((trip, index) => {
        const preview = trip.stops.map((s) => s.label).slice(0, 3).join(' · ');
        return (
          <View
            key={trip.id}
            style={[
              styles.row,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: glassBorder(0.1) },
            ]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
                {trip.title}
              </Text>
              <Text style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>
                {trip.stops.length} stop{trip.stops.length === 1 ? '' : 's'}
                {preview ? ` · ${preview}` : ''}
              </Text>
              <Text style={[styles.caption, { color: c.textSubtle }]}>{lastUsedLabel(trip, all)}</Text>
            </View>
            <Pressable
              onPress={() => void start(trip)}
              disabled={busyId !== null}
              style={({ pressed }) => [
                styles.start,
                { backgroundColor: SAVED_GOLD, opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Start ${trip.title} again`}>
              {busyId === trip.id ? (
                <ActivityIndicator size="small" color="#2A1A00" />
              ) : (
                <Text style={styles.startLabel}>Start again</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => void toggleItineraryFavorite(trip.id)}
              hitSlop={8}
              style={styles.unstar}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${trip.title} from saved trips`}>
              <MaterialIcons name="star" size={22} color={SAVED_GOLD} />
            </Pressable>
          </View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 10,
  },
  chipCompact: { minHeight: 40, borderRadius: 12 },
  chipLabel: { fontSize: 14, fontWeight: '800' },
  list: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 12 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingVertical: 12 },
  title: { fontSize: 17, fontWeight: '600' },
  meta: { fontSize: 13 },
  caption: { fontSize: 12 },
  start: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 96,
    paddingHorizontal: 12,
  },
  startLabel: { color: '#2A1A00', fontSize: 13, fontWeight: '800' },
  unstar: { alignItems: 'center', height: 36, justifyContent: 'center', width: 28 },
});
