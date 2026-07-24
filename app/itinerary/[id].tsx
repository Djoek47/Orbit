import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
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
    accentTheme,
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

  const doneCount = ordered.filter((s) => s.status === 'done').length;
  const canRun = itinerary?.status === 'active' || itinerary?.status === 'draft';

  if (!itinerary) {
    return (
      <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
        <Stack.Screen options={{ title: 'Trip', headerBackTitle: 'Plan' }} />
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
    if (index < 0 || next < 0 || next >= ids.length) return;
    const swapped = [...ids];
    [swapped[index], swapped[next]] = [swapped[next]!, swapped[index]!];
    await reorderItineraryStops(itinerary.id, swapped);
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      <Stack.Screen
        options={{
          title: 'Trip',
          headerBackTitle: 'Plan',
          headerTintColor: accentTheme.primary,
        }}
      />

      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>{itinerary.date}</Text>
        <Text style={orbitTypography.display}>{itinerary.title}</Text>
        {itinerary.summary ? <Text style={styles.summary}>{itinerary.summary}</Text> : null}
        <View style={styles.pillRow}>
          <StatusPill
            label={itinerary.status}
            tone={itinerary.status === 'completed' ? 'green' : 'cyan'}
          />
          {itinerary.favorite ? <StatusPill label="preferred" tone="amber" /> : null}
          {itinerary.suggestedByNova ? <StatusPill label="Nova" tone="blue" /> : null}
          <Text style={styles.progress}>
            {doneCount} of {ordered.length}
          </Text>
        </View>
      </View>

      {canRun ? (
        <View style={styles.primaryBlock}>
          <OrbitButton onPress={() => void openFullItineraryInMaps(itinerary.id)}>
            Open full trip
          </OrbitButton>
          <Text style={styles.mapsCaption}>Opens in {preferredMapsApp}</Text>
        </View>
      ) : null}

      <View style={styles.stopList}>
        {ordered.map((stop, index) => {
          const isActive = stop.status === 'active';
          const isDone = stop.status === 'done';
          const row = (
            <View style={styles.stopInner}>
              <View style={styles.stopRow}>
                <View style={[styles.dot, isActive && styles.dotActive, isDone && styles.dotDone]}>
                  <Text style={styles.dotText}>{isDone ? '✓' : index + 1}</Text>
                </View>
                <View style={styles.stopBody}>
                  <Text style={[orbitTypography.cardTitle, isDone && styles.doneText]}>
                    {stop.label}
                  </Text>
                  <Text style={orbitTypography.caption} numberOfLines={1}>
                    {stop.address || stop.placeQuery || 'No address'}
                    {stop.etaMinutes ? ` · ~${stop.etaMinutes}m` : ''}
                  </Text>
                  <StatusPill label={stop.kind} tone={kindTone[stop.kind]} />
                </View>
                {!isDone ? (
                  <View style={styles.reorderCol}>
                    <Pressable onPress={() => void moveStop(stop.id, -1)} hitSlop={8}>
                      <MaterialIcons name="keyboard-arrow-up" size={20} color={orbitColors.textSubtle} />
                    </Pressable>
                    <Pressable onPress={() => void moveStop(stop.id, 1)} hitSlop={8}>
                      <MaterialIcons name="keyboard-arrow-down" size={20} color={orbitColors.textSubtle} />
                    </Pressable>
                  </View>
                ) : null}
              </View>

              {isActive && !isDone ? (
                <View style={styles.activeActions}>
                  <OrbitButton onPress={() => void advanceItineraryStop(itinerary.id, stop.id)}>
                    Arrived → next
                  </OrbitButton>
                  <Pressable
                    onPress={() => void openStopInMaps(itinerary.id, stop.id)}
                    style={styles.textLink}>
                    <Text style={[styles.textLinkLabel, { color: accentTheme.primary }]}>
                      Open this stop
                    </Text>
                  </Pressable>
                  {stop.kind === 'grocery' || stop.kind === 'shop' ? (
                    <Pressable
                      onPress={() => router.push('/shopping-mode' as never)}
                      style={styles.textLink}>
                      <Text style={[styles.textLinkLabel, { color: accentTheme.primary }]}>
                        Shopping list
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          );

          return isActive ? (
            <GlassCard key={stop.id} elevated style={styles.stopActive}>
              {row}
            </GlassCard>
          ) : (
            <View key={stop.id} style={styles.stopQuiet}>
              {row}
            </View>
          );
        })}
      </View>

      <View style={styles.secondaryRow}>
        <Pressable
          onPress={() => void toggleItineraryFavorite(itinerary.id)}
          style={styles.secondaryChip}>
          <MaterialIcons
            name={itinerary.favorite ? 'star' : 'star-border'}
            size={16}
            color={orbitColors.rankGold}
          />
          <Text style={styles.secondaryLabel}>
            {itinerary.favorite ? 'Preferred' : 'Save preferred'}
          </Text>
        </Pressable>
        {itinerary.status === 'completed' || itinerary.favorite ? (
          <Pressable
            onPress={() =>
              void rerunItinerary(itinerary.id).then((created) => {
                if (created) router.replace(`/itinerary/${created.id}` as never);
              })
            }
            style={styles.secondaryChip}>
            <MaterialIcons name="replay" size={16} color={accentTheme.primary} />
            <Text style={[styles.secondaryLabel, { color: accentTheme.primary }]}>Run again</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  activeActions: {
    gap: orbitSpacing.sm,
    marginTop: orbitSpacing.md,
  },
  doneText: {
    color: orbitColors.textSubtle,
    textDecorationLine: 'line-through',
  },
  dot: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: orbitColors.border,
    borderRadius: 14,
    borderWidth: 1.5,
    height: 32,
    justifyContent: 'center',
    width: 32,
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
    fontSize: 12,
    fontWeight: '700',
  },
  mapsCaption: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    textAlign: 'center',
  },
  pillRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryBlock: {
    gap: 6,
  },
  progress: {
    color: orbitColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  reorderCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryChip: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryLabel: {
    color: orbitColors.textSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  stopActive: {
    borderColor: 'rgba(56,189,248,0.35)',
  },
  stopBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  stopInner: {
    gap: 0,
  },
  stopList: {
    gap: 10,
  },
  stopQuiet: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  stopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  summary: {
    color: orbitColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  textLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  textLinkLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
