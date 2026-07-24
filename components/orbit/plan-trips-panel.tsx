import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { Itinerary } from '@/types/orbit';

type SuggestMode = 'efficient' | 'spread';

function formatDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  if (dateKey === todayKey) return 'Today';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateKey === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function PlanTripsPanel({ selectedDateKey }: { selectedDateKey: string }) {
  const {
    accentTheme,
    household,
    openFullItineraryInMaps,
    rerunItinerary,
    suggestNovaItinerary,
  } = useOrbit();
  const [mode, setMode] = useState<SuggestMode>('efficient');
  const [busy, setBusy] = useState(false);
  const [highlightPreferred, setHighlightPreferred] = useState(false);

  const itineraries = household.itineraries ?? [];
  const activeTrips = itineraries.filter((t) => t.status !== 'completed');
  const preferredTrips = itineraries.filter((t) => t.favorite);
  const completedTrips = itineraries.filter((t) => t.status === 'completed');

  const runSuggest = async (opts?: { date?: string; eventIds?: string[] }) => {
    setBusy(true);
    try {
      const created = await suggestNovaItinerary({
        mode,
        date: opts?.date ?? selectedDateKey,
        eventIds: opts?.eventIds,
      });
      if (created) {
        router.push(`/itinerary/${created.id}` as never);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Trips</Text>
        <Text style={styles.h1}>Today’s runs and saved routines</Text>
      </View>

      <View style={styles.modeRow}>
        {(['efficient', 'spread'] as const).map((option) => {
          const active = mode === option;
          return (
            <Pressable
              key={option}
              onPress={() => setMode(option)}
              style={[
                styles.modeChip,
                active && {
                  backgroundColor: `${accentTheme.primary}28`,
                  borderColor: `${accentTheme.primary}66`,
                },
              ]}>
              <Text style={[styles.modeLabel, active && { color: accentTheme.primary }]}>
                {option === 'efficient' ? 'Efficient' : 'Spread'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.composeRow}>
        <ComposeChip
          icon="add"
          label="New"
          onPress={() => router.push('/create-itinerary' as never)}
          accent={accentTheme.primary}
        />
        <ComposeChip
          icon="auto-awesome"
          label="Ask Nova"
          onPress={() => void runSuggest()}
          accent={accentTheme.primary}
          busy={busy}
        />
        <ComposeChip
          icon="event"
          label="Calendar"
          onPress={() => void runSuggest({ date: selectedDateKey })}
          accent={accentTheme.primary}
        />
        <ComposeChip
          icon="star-outline"
          label="Routines"
          onPress={() => {
            setHighlightPreferred(true);
            setTimeout(() => setHighlightPreferred(false), 1600);
          }}
          accent={accentTheme.primary}
        />
      </View>

      <Text style={styles.sectionTitle}>Active</Text>
      {activeTrips.length === 0 ? (
        <Text style={styles.empty}>No active trips — create one or ask Nova.</Text>
      ) : (
        activeTrips.map((trip) => (
          <TripRow
            key={trip.id}
            trip={trip}
            accent={accentTheme.primary}
            showMaps
            onOpen={() => router.push(`/itinerary/${trip.id}` as never)}
            onMaps={() => {
              void openFullItineraryInMaps(trip.id);
              router.push(`/itinerary/${trip.id}` as never);
            }}
          />
        ))
      )}

      <View
        style={highlightPreferred ? styles.preferredHighlight : undefined}
        collapsable={false}>
        <Text style={styles.sectionTitle}>Preferred</Text>
        {preferredTrips.length === 0 ? (
          <Text style={styles.empty}>Save a trip as preferred to reuse it.</Text>
        ) : (
          preferredTrips.map((trip) => (
            <TripRow
              key={`fav-${trip.id}`}
              trip={trip}
              accent={accentTheme.primary}
              preferred
              onOpen={() =>
                void rerunItinerary(trip.id).then((created) => {
                  if (created) router.push(`/itinerary/${created.id}` as never);
                })
              }
            />
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Recent</Text>
      {completedTrips.length === 0 ? (
        <Text style={styles.empty}>Completed trips show up here.</Text>
      ) : (
        completedTrips.map((trip) => (
          <TripRow
            key={`done-${trip.id}`}
            trip={trip}
            accent={accentTheme.primary}
            muted
            onOpen={() => router.push(`/itinerary/${trip.id}` as never)}
          />
        ))
      )}
    </View>
  );
}

function ComposeChip({
  icon,
  label,
  onPress,
  accent,
  busy,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  accent: string;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.composeChip,
        { borderColor: `${accent}44` },
        pressed && { opacity: 0.85 },
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={accent} />
      ) : (
        <MaterialIcons name={icon} size={16} color={accent} />
      )}
      <Text style={[styles.composeLabel, { color: accent }]}>{label}</Text>
    </Pressable>
  );
}

function TripRow({
  trip,
  accent,
  onOpen,
  onMaps,
  showMaps,
  preferred,
  muted,
}: {
  trip: Itinerary;
  accent: string;
  onOpen: () => void;
  onMaps?: () => void;
  showMaps?: boolean;
  preferred?: boolean;
  muted?: boolean;
}) {
  return (
    <Pressable onPress={onOpen}>
      <GlassCard style={styles.tripCard}>
        <View style={styles.tripRow}>
          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <Text style={[styles.tripTitle, muted && styles.tripTitleMuted]} numberOfLines={1}>
              {trip.title}
            </Text>
            <Text style={styles.tripMeta}>
              {formatDayLabel(trip.date)} · {trip.stops.length} stops
            </Text>
            <View style={styles.pillRow}>
              <StatusPill
                label={trip.status}
                tone={trip.status === 'completed' ? 'green' : trip.status === 'active' ? 'cyan' : 'blue'}
              />
              {trip.suggestedByNova ? <StatusPill label="Nova" tone="blue" /> : null}
              {preferred || trip.favorite ? <StatusPill label="preferred" tone="amber" /> : null}
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={18} color={orbitColors.textSubtle} />
        </View>
        {showMaps && onMaps && trip.status === 'active' ? (
          <Pressable onPress={onMaps} style={[styles.mapsLink, { borderColor: `${accent}33` }]}>
            <MaterialIcons name="navigation" size={14} color={accent} />
            <Text style={[styles.mapsLinkText, { color: accent }]}>Open in Maps</Text>
          </Pressable>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  header: { gap: 4 },
  kicker: {
    color: orbitColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  h1: {
    color: '#EEF2FF',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: {
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modeLabel: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  composeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  composeChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  composeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 6,
  },
  preferredHighlight: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.28)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 10,
  },
  empty: {
    color: orbitColors.textSubtle,
    fontSize: 13,
  },
  tripCard: { gap: 10 },
  tripRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  tripTitle: {
    color: '#EEF2FF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  tripTitleMuted: {
    color: orbitColors.textMuted,
  },
  tripMeta: {
    color: orbitColors.textSubtle,
    fontSize: 12,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  mapsLink: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapsLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
