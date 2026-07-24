import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { ItineraryStopKind } from '@/types/orbit';

const kindTone: Record<ItineraryStopKind, 'blue' | 'cyan' | 'amber' | 'green'> = {
  school: 'blue',
  work: 'cyan',
  grocery: 'amber',
  pickup: 'green',
  practice: 'green',
  family: 'blue',
  home: 'cyan',
  shop: 'amber',
  custom: 'blue',
};

export default function ItineraryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    advanceItineraryStop,
    household,
    openFullItineraryInMaps,
    openStopInMaps,
    preferredMapsApp,
    reorderItineraryStops,
    rerunItinerary,
    toggleItineraryFavorite,
  } = useOrbit();
  const itinerary = household.itineraries?.find((item) => item.id === id);
  const ordered = useMemo(
    () => (itinerary ? [...itinerary.stops].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [itinerary]
  );

  if (!itinerary) {
    return (
      <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
        <Text style={orbitTypography.title}>Trip not found</Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back
        </OrbitButton>
      </ScrollView>
    );
  }

  const moveStop = async (stopId: string, direction: -1 | 1) => {
    const ids = ordered.map((stop) => stop.id);
    const index = ids.indexOf(stopId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) {
      return;
    }
    const swapped = [...ids];
    [swapped[index], swapped[next]] = [swapped[next]!, swapped[index]!];
    await reorderItineraryStops(itinerary.id, swapped);
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: 'Trip', headerBackTitle: 'Plan' }} />
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>{itinerary.date}</Text>
        <Text style={orbitTypography.display}>{itinerary.title}</Text>
        {itinerary.summary ? <Text style={styles.summary}>{itinerary.summary}</Text> : null}
        <View style={styles.pillRow}>
          <StatusPill label={itinerary.status} tone={itinerary.status === 'completed' ? 'green' : 'cyan'} />
          {itinerary.favorite ? <StatusPill label="preferred" tone="amber" /> : null}
        </View>
      </View>

      <GlassCard style={styles.novaCard}>
        <Text style={styles.novaLabel}>Maps · {preferredMapsApp}</Text>
        <Text style={orbitTypography.body}>
          Open the full multi-stop trip, or hand off one leg at a time. Waze opens the first stop only —
          use Arrived → next for the rest.
        </Text>
        <OrbitButton onPress={() => void openFullItineraryInMaps(itinerary.id)}>
          Open full trip
        </OrbitButton>
        <View style={styles.actionRow}>
          <OrbitButton
            tone="secondary"
            onPress={() => void toggleItineraryFavorite(itinerary.id)}>
            {itinerary.favorite ? 'Unsave preferred' : 'Save as preferred'}
          </OrbitButton>
          {itinerary.status === 'completed' || itinerary.favorite ? (
            <OrbitButton
              tone="secondary"
              onPress={() =>
                void rerunItinerary(itinerary.id).then((created) => {
                  if (created) router.replace(`/itinerary/${created.id}` as never);
                })
              }>
              Run again
            </OrbitButton>
          ) : null}
        </View>
      </GlassCard>

      {ordered.map((stop, index) => {
        const isActive = stop.status === 'active';
        const isDone = stop.status === 'done';
        return (
          <GlassCard key={stop.id} elevated={isActive} style={[styles.stopCard, isActive && styles.stopActive]}>
            <View style={styles.stopRow}>
              <View style={[styles.dot, isActive && styles.dotActive, isDone && styles.dotDone]}>
                <Text style={styles.dotText}>{isDone ? '✓' : index + 1}</Text>
              </View>
              <View style={styles.stopBody}>
                <Text style={orbitTypography.cardTitle}>{stop.label}</Text>
                <Text style={orbitTypography.caption}>
                  {stop.address || stop.placeQuery || 'No address'}
                  {stop.etaMinutes ? ` · ~${stop.etaMinutes}m` : ''}
                </Text>
                <StatusPill label={stop.kind} tone={kindTone[stop.kind]} />
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => void moveStop(stop.id, -1)} style={styles.iconBtn}>
                <MaterialIcons name="keyboard-arrow-up" size={22} color={orbitColors.textMuted} />
              </Pressable>
              <Pressable onPress={() => void moveStop(stop.id, 1)} style={styles.iconBtn}>
                <MaterialIcons name="keyboard-arrow-down" size={22} color={orbitColors.textMuted} />
              </Pressable>
              <OrbitButton
                style={styles.flexBtn}
                tone="secondary"
                onPress={() => void openStopInMaps(itinerary.id, stop.id)}>
                Open in Maps
              </OrbitButton>
              {isActive && !isDone ? (
                <OrbitButton
                  style={styles.flexBtn}
                  onPress={() => void advanceItineraryStop(itinerary.id, stop.id)}>
                  Arrived → next
                </OrbitButton>
              ) : null}
              {stop.kind === 'grocery' || stop.kind === 'shop' ? (
                <OrbitButton
                  style={styles.flexBtn}
                  tone="secondary"
                  onPress={() => router.push('/shopping-mode' as never)}>
                  Shopping list
                </OrbitButton>
              ) : null}
            </View>
          </GlassCard>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: orbitSpacing.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: orbitSpacing.sm,
    marginTop: orbitSpacing.sm,
  },
  dot: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: orbitColors.border,
    borderRadius: 14,
    borderWidth: 2,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  dotActive: {
    backgroundColor: 'rgba(56,189,248,0.2)',
    borderColor: 'rgba(56,189,248,0.5)',
  },
  dotDone: {
    backgroundColor: 'rgba(52,211,153,0.2)',
    borderColor: orbitColors.success,
  },
  dotText: {
    color: orbitColors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  flexBtn: {
    flexGrow: 1,
    minWidth: 120,
  },
  iconBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: orbitRadius.sm,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  novaCard: {
    gap: 6,
  },
  novaLabel: {
    color: orbitColors.novaCyan,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stopActive: {
    borderColor: 'rgba(56,189,248,0.28)',
  },
  stopBody: {
    flex: 1,
    gap: 4,
  },
  stopCard: {
    gap: orbitSpacing.sm,
  },
  stopRow: {
    flexDirection: 'row',
    gap: orbitSpacing.md,
  },
  summary: {
    color: orbitColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
