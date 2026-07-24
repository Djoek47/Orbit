import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { ItineraryStopKind } from '@/types/orbit';

const STOP_EMOJI: Record<ItineraryStopKind, string> = {
  school: '🏫',
  work: '💼',
  grocery: '🛒',
  pickup: '⚽',
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

function formatTripDate(dateKey: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (dateKey === today) return 'Today';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateKey === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function mapsLabel(app: string): string {
  if (app === 'auto') return 'Maps';
  if (app === 'apple') return 'Apple Maps';
  if (app === 'google') return 'Google Maps';
  if (app === 'waze') return 'Waze';
  return 'Maps';
}

export default function ItineraryDetailScreen() {
  const insets = useSafeAreaInsets();
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
  const tripColor = accentTheme.primary;

  const themedBack = (
    <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
      <MaterialIcons name="chevron-left" size={22} color={tripColor} />
      <Text style={[styles.backLabel, { color: tripColor }]}>Plan</Text>
    </Pressable>
  );

  if (!itinerary) {
    return (
      <ScrollView
        style={orbitScreen.container}
        contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}>
        <Stack.Screen options={{ headerShown: false }} />
        {themedBack}
        <Text style={orbitTypography.title}>Trip not found</Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back to Plan
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
      contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}>
      <Stack.Screen options={{ headerShown: false }} />

      {themedBack}

      <View style={styles.header}>
        <PageEyebrow>{formatTripDate(itinerary.date)}</PageEyebrow>
        <Text style={orbitTypography.display}>{itinerary.title}</Text>
        {itinerary.summary ? <Text style={styles.summary}>{itinerary.summary}</Text> : null}
        <View style={styles.metaRow}>
          <View style={[styles.statusChip, { backgroundColor: `${tripColor}18` }]}>
            <Text style={[styles.statusChipText, { color: tripColor }]}>
              {itinerary.status === 'completed' ? 'Done' : itinerary.status === 'draft' ? 'Draft' : 'Active'}
            </Text>
          </View>
          {itinerary.favorite ? (
            <View style={[styles.statusChip, { backgroundColor: 'rgba(251,191,36,0.14)' }]}>
              <MaterialIcons name="star" size={12} color={orbitColors.rankGold} />
              <Text style={[styles.statusChipText, { color: orbitColors.rankGold }]}>Preferred</Text>
            </View>
          ) : null}
          {itinerary.suggestedByNova ? (
            <View style={[styles.statusChip, { backgroundColor: 'rgba(6,182,212,0.14)' }]}>
              <MaterialIcons name="auto-awesome" size={12} color={orbitColors.novaCyan} />
              <Text style={[styles.statusChipText, { color: orbitColors.novaCyan }]}>Nova</Text>
            </View>
          ) : null}
          <Text style={styles.progress}>
            {doneCount}/{ordered.length}
          </Text>
        </View>
      </View>

      {canRun ? (
        <Pressable onPress={() => void openFullItineraryInMaps(itinerary.id)}>
          <LinearGradient
            colors={[tripColor, accentTheme.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.startBtn}>
            <MaterialIcons name="navigation" size={18} color="#070D1C" />
            <Text style={styles.startBtnText}>Start trip in {mapsLabel(preferredMapsApp)}</Text>
          </LinearGradient>
        </Pressable>
      ) : null}

      <View style={styles.stopList}>
        {ordered.map((stop, index) => {
          const isActive = stop.status === 'active';
          const isDone = stop.status === 'done';
          const isLast = index === ordered.length - 1;
          const driveMin =
            index === 0
              ? 0
              : Math.max(2, Math.min(12, Math.round(((stop.etaMinutes ?? 10) - (ordered[index - 1]?.etaMinutes ?? 10)) * 0.25) || 3));

          const row = (
            <View style={styles.stopInner}>
              <View style={styles.timelineCol}>
                <View
                  style={[
                    styles.node,
                    isActive && { backgroundColor: `${tripColor}33`, borderColor: `${tripColor}66` },
                    isDone && styles.nodeDone,
                  ]}>
                  <Text style={styles.nodeEmoji}>{isDone ? '✓' : STOP_EMOJI[stop.kind]}</Text>
                </View>
                {!isLast ? (
                  <View style={styles.connector}>
                    {[0, 1].map((d) => (
                      <View
                        key={d}
                        style={[
                          styles.connectorDot,
                          { backgroundColor: isActive ? tripColor : 'rgba(255,255,255,0.12)' },
                        ]}
                      />
                    ))}
                    {driveMin > 0 ? (
                      <Text style={styles.driveHint}>{driveMin}m</Text>
                    ) : (
                      <View style={[styles.connectorDot, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
                    )}
                    {[0, 1].map((d) => (
                      <View
                        key={`b-${d}`}
                        style={[
                          styles.connectorDot,
                          { backgroundColor: isActive ? tripColor : 'rgba(255,255,255,0.12)' },
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </View>

              <View style={styles.stopBody}>
                <View style={styles.stopHead}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.stopTitle, isDone && styles.doneText]} numberOfLines={1}>
                      {stop.label}
                    </Text>
                    <View style={styles.addrRow}>
                      <MaterialIcons name="place" size={11} color={orbitColors.textSubtle} />
                      <Text style={styles.addrText} numberOfLines={1}>
                        {stop.address || stop.placeQuery || 'No address'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.stopMeta}>
                    <View style={[styles.catPill, { backgroundColor: `${tripColor}18` }]}>
                      <Text style={[styles.catText, { color: tripColor }]}>
                        {STOP_CATEGORY[stop.kind]}
                      </Text>
                    </View>
                    {stop.etaMinutes ? (
                      <View style={styles.timeRow}>
                        <MaterialIcons name="schedule" size={11} color={orbitColors.textSubtle} />
                        <Text style={styles.timeText}>~{stop.etaMinutes}m</Text>
                      </View>
                    ) : null}
                  </View>
                  {!isDone ? (
                    <View style={styles.reorderCol}>
                      <Pressable onPress={() => void moveStop(stop.id, -1)} hitSlop={10}>
                        <MaterialIcons name="keyboard-arrow-up" size={18} color={orbitColors.textSubtle} />
                      </Pressable>
                      <Pressable onPress={() => void moveStop(stop.id, 1)} hitSlop={10}>
                        <MaterialIcons name="keyboard-arrow-down" size={18} color={orbitColors.textSubtle} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>

                {isActive && !isDone ? (
                  <View style={styles.activeActions}>
                    <OrbitButton onPress={() => void advanceItineraryStop(itinerary.id, stop.id)}>
                      Arrived → next
                    </OrbitButton>
                    <View style={styles.linkRow}>
                      <Pressable
                        onPress={() => void openStopInMaps(itinerary.id, stop.id)}
                        style={styles.textLink}>
                        <Text style={[styles.textLinkLabel, { color: tripColor }]}>Open this stop</Text>
                      </Pressable>
                      {stop.kind === 'grocery' || stop.kind === 'shop' ? (
                        <Pressable
                          onPress={() => router.push('/shopping-mode' as never)}
                          style={styles.textLink}>
                          <Text style={[styles.textLinkLabel, { color: tripColor }]}>Shopping list</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          );

          return isActive ? (
            <GlassCard key={stop.id} elevated style={[styles.stopActive, { borderColor: `${tripColor}40` }]}>
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
            <MaterialIcons name="replay" size={16} color={tripColor} />
            <Text style={[styles.secondaryLabel, { color: tripColor }]}>Run again</Text>
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
  addrRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
  },
  addrText: {
    color: orbitColors.textSubtle,
    flex: 1,
    fontSize: 12,
  },
  backBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
    marginLeft: -4,
  },
  backLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  catPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catText: {
    fontSize: 11,
    fontWeight: '700',
  },
  connector: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    paddingVertical: 4,
  },
  connectorDot: {
    borderRadius: 2,
    height: 3,
    width: 3,
  },
  doneText: {
    color: orbitColors.textSubtle,
    textDecorationLine: 'line-through',
  },
  driveHint: {
    color: orbitColors.textSubtle,
    fontSize: 9,
    fontWeight: '600',
  },
  header: {
    gap: 6,
  },
  linkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  node: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1.5,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  nodeDone: {
    backgroundColor: 'rgba(52,211,153,0.2)',
    borderColor: orbitColors.success,
  },
  nodeEmoji: {
    fontSize: 15,
  },
  progress: {
    color: orbitColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  reorderCol: {
    alignItems: 'center',
    marginLeft: 2,
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
  startBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: orbitRadius.lg,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: orbitSpacing.lg,
  },
  startBtnText: {
    color: '#070D1C',
    fontSize: 16,
    fontWeight: '800',
  },
  statusChip: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  stopActive: {
    paddingVertical: 4,
  },
  stopBody: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 4,
  },
  stopHead: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  stopInner: {
    flexDirection: 'row',
    gap: 12,
  },
  stopList: {
    gap: 4,
  },
  stopMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  stopQuiet: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  stopTitle: {
    color: orbitColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  summary: {
    color: orbitColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  textLink: {
    paddingVertical: 2,
  },
  textLinkLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  timeText: {
    color: orbitColors.textSubtle,
    fontSize: 11,
    fontWeight: '600',
  },
  timelineCol: {
    alignItems: 'center',
    width: 36,
  },
});
