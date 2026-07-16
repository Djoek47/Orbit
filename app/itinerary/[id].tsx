import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

const kindTone = {
  school: 'blue',
  work: 'cyan',
  grocery: 'amber',
  pickup: 'green',
  custom: 'blue',
} as const;

export default function ItineraryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { advanceItineraryStop, household, openStopInMaps, reorderItineraryStops } = useOrbit();
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
    [swapped[index], swapped[next]] = [swapped[next], swapped[index]];
    await reorderItineraryStops(itinerary.id, swapped);
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>{itinerary.date}</Text>
        <Text style={orbitTypography.display}>{itinerary.title}</Text>
        {itinerary.summary ? <Text style={styles.summary}>{itinerary.summary}</Text> : null}
        <StatusPill label={itinerary.status} tone={itinerary.status === 'completed' ? 'green' : 'cyan'} />
      </View>

      {itinerary.suggestedByNova ? (
        <GlassCard style={styles.novaCard}>
          <Text style={styles.novaLabel}>Nova</Text>
          <Text style={orbitTypography.body}>
            Progressive Maps handoff — open directions for the active stop, then tap Arrived for the next leg.
          </Text>
        </GlassCard>
      ) : null}

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
              <Pressable onPress={() => moveStop(stop.id, -1)} style={styles.iconBtn}>
                <MaterialIcons name="keyboard-arrow-up" size={22} color={orbitColors.textMuted} />
              </Pressable>
              <Pressable onPress={() => moveStop(stop.id, 1)} style={styles.iconBtn}>
                <MaterialIcons name="keyboard-arrow-down" size={22} color={orbitColors.textMuted} />
              </Pressable>
              <OrbitButton
                style={styles.flexBtn}
                tone="secondary"
                onPress={() => openStopInMaps(itinerary.id, stop.id)}>
                Open in Maps
              </OrbitButton>
              {isActive && !isDone ? (
                <OrbitButton style={styles.flexBtn} onPress={() => advanceItineraryStop(itinerary.id, stop.id)}>
                  Arrived → next
                </OrbitButton>
              ) : null}
              {stop.kind === 'grocery' ? (
                <OrbitButton
                  style={styles.flexBtn}
                  tone="secondary"
                  onPress={() => router.push('/(tabs)/groceries' as never)}>
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
    color: orbitColors.orbitBlue,
    fontSize: 14,
    fontWeight: '600',
  },
});
