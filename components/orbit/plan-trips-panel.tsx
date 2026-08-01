import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';

import { MyPlacesPanel } from '@/components/orbit/my-places-panel';
import { NovaOrb } from '@/components/orbit/nova-orb';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { RouteSteps, type RouteStepItem } from '@/components/orbit/route-steps';
import { buildPickupSummary } from '@/lib/places/pickup-summary';
import { useOrbit } from '@/store/orbit-store';
import type { Itinerary, ItineraryStop, ItineraryStopKind } from '@/types/orbit';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SuggestMode = 'efficient' | 'spread';
type TripsSection = 'trips' | 'places';

const TRIP_COLORS = ['#38BDF8', '#FB923C', '#34D399'] as const;

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

function glass(alpha = 0.07) {
  return `rgba(255,255,255,${alpha})`;
}

function formatDayLabel(dateKey: string): string {
  const todayKey = new Date().toISOString().slice(0, 10);
  if (dateKey === todayKey) return 'Today';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateKey === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
}

function totalTimeFromStops(stops: ItineraryStop[]): string {
  const mins = stops.reduce((n, s) => n + (s.etaMinutes ?? 15), 0);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

function estimateDistance(stops: ItineraryStop[]): string {
  return `${(stops.length * 2.1 + 1.5).toFixed(1)} mi`;
}

function estimateSavedTime(stops: ItineraryStop[]): string {
  return `${Math.max(15, Math.round(stops.length * 14))} min`;
}

function estimateTimeSavedAll(trips: Itinerary[]): string {
  const mins = trips.reduce((n, t) => n + Math.max(15, t.stops.length * 14), 0);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

function driveMinutesBetween(stops: ItineraryStop[], index: number): number {
  if (index === 0) return 0;
  const prev = stops[index - 1]?.etaMinutes ?? 10;
  const curr = stops[index]?.etaMinutes ?? 10;
  return Math.max(2, Math.min(12, Math.round((curr - prev) * 0.25) || 3));
}

function novaReasonForTrip(trip: Itinerary): string {
  if (trip.summary && trip.summary.length > 20) return trip.summary;
  const names = [...trip.stops]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => s.label)
    .join(', ');
  return `Bundled ${trip.stops.length} stops (${names}) into one efficient route. Combining saves time vs. separate trips.`;
}

function tripToRouteSteps(trip: Itinerary): RouteStepItem[] {
  const stops = [...trip.stops].sort((a, b) => a.sortOrder - b.sortOrder);
  return stops.map((stop, i) => ({
    id: stop.id,
    emoji: STOP_EMOJI[stop.kind],
    title: stop.label,
    address: stop.address || stop.placeQuery || 'No address',
    category: STOP_CATEGORY[stop.kind],
    driveMinutes: i < stops.length - 1 ? driveMinutesBetween(stops, i + 1) : undefined,
    estimatedMinutes: stop.etaMinutes ?? 15,
  }));
}

function TripCard({
  trip,
  index,
  onStartTrip,
}: {
  trip: Itinerary;
  index: number;
  onStartTrip: (trip: Itinerary) => void;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const [activated, setActivated] = useState(false);
  const color = TRIP_COLORS[index % TRIP_COLORS.length];
  const stops = [...trip.stops].sort((a, b) => a.sortOrder - b.sortOrder);
  const steps = useMemo(() => tripToRouteSteps(trip), [trip]);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  const handleStart = () => {
    setActivated(true);
    onStartTrip(trip);
  };

  const handleCopy = async () => {
    const lines = stops.map((s, i) => `${i + 1}. ${s.label} — ${s.address || s.placeQuery || ''}`);
    await Clipboard.setStringAsync(`${trip.title}\n${lines.join('\n')}`);
  };

  return (
    <View
      style={[
        styles.tripCard,
        {
          backgroundColor: expanded ? `${color}14` : glass(0.05),
          borderColor: expanded ? `${color}30` : 'rgba(255,255,255,0.09)',
        },
      ]}>
      <View
        pointerEvents="none"
        style={[
          styles.insetHighlight,
          { backgroundColor: glass(expanded ? 0.14 : 0.08) },
        ]}
      />
      <Pressable onPress={toggleExpanded} style={styles.tripCardHead}>
        <View style={styles.tripHeadRow}>
          <View
            style={[
              styles.routeIcon,
              {
                backgroundColor: `${color}28`,
                borderColor: `${color}30`,
              },
            ]}>
            <MaterialIcons name="route" size={18} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tripTitle}>{trip.title}</Text>
            <Text style={[styles.tripDayLabel, { color }]}>{formatDayLabel(trip.date)}</Text>
          </View>
          <MaterialIcons
            name="chevron-right"
            size={16}
            color="#4B6080"
            style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
          />
        </View>
        <View style={styles.tripStatsRow}>
          {[
            { icon: 'schedule' as const, val: totalTimeFromStops(stops), label: 'Total', accent: false },
            { icon: 'navigation' as const, val: estimateDistance(stops), label: 'Distance', accent: false },
            {
              icon: 'bolt' as const,
              val: `Save ${estimateSavedTime(stops)}`,
              label: 'vs. separate',
              accent: true,
            },
          ].map((s) => (
            <View key={s.label} style={styles.tripStat}>
              <MaterialIcons name={s.icon} size={12} color={s.accent ? '#34D399' : '#4B6080'} />
              <View>
                <Text style={[styles.tripStatVal, s.accent && { color: '#34D399' }]}>{s.val}</Text>
                <Text style={styles.tripStatLabel}>{s.label}</Text>
              </View>
            </View>
          ))}
          <View style={styles.stopCountPill}>
            <Text style={styles.stopCountText}>{stops.length} stops</Text>
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.tripExpanded}>
          <View style={styles.novaReason}>
            <MaterialIcons name="auto-awesome" size={13} color="#06B6D4" />
            <Text style={styles.heroBody}>
              <Text style={{ color: '#06B6D4', fontWeight: '700' }}>Nova: </Text>
              {novaReasonForTrip(trip)}
            </Text>
          </View>
          <RouteSteps steps={steps} accentColor={color} emphasized={!activated} />
          <View style={styles.tripCtaRow}>
            <Pressable onPress={handleStart} style={{ flex: 1 }}>
              {activated ? (
                <View style={styles.tripActivatedBtn}>
                  <MaterialIcons name="check" size={15} color="#34D399" />
                  <Text style={styles.tripActivatedText}>Trip Activated</Text>
                </View>
              ) : (
                <LinearGradient
                  colors={[color, `${color}CC`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tripStartBtn}>
                  <MaterialIcons name="navigation" size={16} color="#070D1C" />
                  <Text style={styles.tripStartText}>Start Trip in Maps</Text>
                </LinearGradient>
              )}
            </Pressable>
            <Pressable
              onPress={() => router.push(`/itinerary/${trip.id}` as never)}
              style={styles.detailBtn}>
              <MaterialIcons name="open-in-new" size={18} color="#C8D8F0" />
            </Pressable>
            <Pressable onPress={handleCopy} style={styles.clipboardBtn}>
              <Text style={{ fontSize: 16 }}>📋</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Full Nova Smart Trips experience — Design 8 glass + My Places segment.
 */
export function PlanTripsPanel({ selectedDateKey }: { selectedDateKey: string }) {
  const {
    accentTheme,
    household,
    openFullItineraryInMaps,
    orbitPalette,
    rerunItinerary,
    suggestNovaItinerary,
  } = useOrbit();
  const [section, setSection] = useState<TripsSection>('trips');
  const [mode, setMode] = useState<SuggestMode>('efficient');
  const [busy, setBusy] = useState(false);
  const [highlightPreferred, setHighlightPreferred] = useState(false);

  const itineraries = household.itineraries ?? [];
  const activeTrips = itineraries.filter((t) => t.status !== 'completed');
  const preferredTrips = itineraries.filter((t) => t.favorite);
  const completedTrips = itineraries.filter((t) => t.status === 'completed');
  const totalStopsBundled = activeTrips.reduce((n, t) => n + t.stops.length, 0);
  const pickupTotal = useMemo(
    () =>
      buildPickupSummary(
        household.savedPlaces ?? [],
        household.groceries,
        household.preferredStoreId
      ).total,
    [household.savedPlaces, household.groceries, household.preferredStoreId]
  );

  const runSuggest = async (opts?: { date?: string; eventIds?: string[] }) => {
    setBusy(true);
    try {
      const created = await suggestNovaItinerary({
        mode,
        date: opts?.date ?? selectedDateKey,
        eventIds: opts?.eventIds,
      });
      if (created) router.push(`/itinerary/${created.id}` as never);
    } finally {
      setBusy(false);
    }
  };

  const handleStartTrip = async (trip: Itinerary) => {
    await openFullItineraryInMaps(trip.id);
    router.push(`/itinerary/${trip.id}` as never);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.itinHeader}>
        <PageEyebrow>Nova Smart Trips</PageEyebrow>
        <Text style={[styles.h1, { color: orbitPalette.text }]}>Itineraries</Text>
      </View>

      {/* Smart Trips | My Places */}
      <View
        style={[
          styles.segment,
          {
            backgroundColor: glass(0.05),
            borderColor: orbitPalette.border,
          },
        ]}>
        {(
          [
            { id: 'trips' as const, label: 'Smart Trips', icon: 'route' as const, color: '#38BDF8' },
            { id: 'places' as const, label: 'My Places', icon: 'place' as const, color: '#A78BFA' },
          ] as const
        ).map((tab) => {
          const active = section === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSection(tab.id);
              }}
              style={[
                styles.segmentBtn,
                active && {
                  backgroundColor: `${tab.color}2E`,
                  borderColor: `${tab.color}4D`,
                },
              ]}>
              <MaterialIcons
                name={tab.icon}
                size={13}
                color={active ? tab.color : orbitPalette.textSubtle}
              />
              <Text
                style={[
                  styles.segmentLabel,
                  { color: active ? tab.color : orbitPalette.textSubtle, fontWeight: active ? '700' : '500' },
                ]}>
                {tab.label}
              </Text>
              {tab.id === 'places' && pickupTotal > 0 ? (
                <View style={styles.segmentBadge}>
                  <Text style={styles.segmentBadgeText}>{pickupTotal}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {section === 'places' ? (
        <MyPlacesPanel compact showFab />
      ) : (
        <>
          <LinearGradient
            colors={['rgba(6,182,212,0.15)', 'rgba(56,189,248,0.08)', 'rgba(129,140,248,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.novaHero}>
            <View style={styles.novaHeroGlow} />
            <View style={styles.novaHeroRow}>
              <NovaOrb size={56} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.novaLive}>
                  <View style={styles.liveDot} />
                  <Text style={styles.novaLiveText}>NOVA SMART ROUTING</Text>
                </View>
                <Text style={styles.heroBodyLg}>
                  I&apos;ve analysed your calendar and errands. I&apos;ve bundled{' '}
                  <Text style={{ color: '#38BDF8', fontWeight: '700' }}>
                    {Math.max(activeTrips.length, 1)} optimised trip
                    {activeTrips.length === 1 ? '' : 's'}
                  </Text>{' '}
                  that can save you{' '}
                  <Text style={{ color: '#34D399', fontWeight: '700' }}>
                    {estimateTimeSavedAll(activeTrips.length ? activeTrips : itineraries.slice(0, 1))}
                  </Text>{' '}
                  this week.
                </Text>
              </View>
            </View>
            <View style={styles.statRow}>
              {[
                { val: String(activeTrips.length || '—'), label: 'Smart trips', color: '#38BDF8' },
                {
                  val: activeTrips.length ? estimateTimeSavedAll(activeTrips) : '—',
                  label: 'Time saved',
                  color: '#34D399',
                },
                {
                  val: String(totalStopsBundled || '—'),
                  label: 'Stops bundled',
                  color: '#A78BFA',
                },
              ].map((s) => (
                <View key={s.label} style={styles.stat}>
                  <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

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
              accent={accentTheme.primary}
              onPress={() => router.push('/create-itinerary' as never)}
            />
            <ComposeChip
              icon="auto-awesome"
              label="Ask Nova"
              accent={accentTheme.primary}
              busy={busy}
              onPress={() => void runSuggest()}
            />
            <ComposeChip
              icon="event"
              label="Calendar"
              accent={accentTheme.primary}
              onPress={() => void runSuggest({ date: selectedDateKey })}
            />
            <ComposeChip
              icon="star-outline"
              label="Routines"
              accent={accentTheme.primary}
              onPress={() => {
                setHighlightPreferred(true);
                setTimeout(() => setHighlightPreferred(false), 1600);
              }}
            />
          </View>

          <View style={{ gap: 12 }}>
            {activeTrips.length === 0 ? (
              <View style={styles.emptyTrips}>
                <Text style={styles.emptyTripsTitle}>No active trips yet</Text>
                <Text style={styles.emptyTripsBody}>
                  Ask Nova to bundle today, or build one from your calendar.
                </Text>
              </View>
            ) : (
              activeTrips.map((trip, index) => (
                <TripCard key={trip.id} trip={trip} index={index} onStartTrip={handleStartTrip} />
              ))
            )}
          </View>

          <View
            style={[styles.completedArchive, highlightPreferred && styles.preferredHighlight]}
            collapsable={false}>
            <Text style={styles.completedTitle}>Preferred trips</Text>
            {preferredTrips.length === 0 ? (
              <Text style={styles.completedEmpty}>Save a trip as preferred to reuse it.</Text>
            ) : (
              preferredTrips.map((t, i) => (
                <Pressable
                  key={`fav-${t.id}`}
                  onPress={() =>
                    void rerunItinerary(t.id).then((created) => {
                      if (created) router.push(`/itinerary/${created.id}` as never);
                    })
                  }
                  style={[styles.completedRow, i > 0 && styles.completedRowBorder]}>
                  <Text style={{ fontSize: 16 }}>⭐</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.completedName}>{t.title}</Text>
                    <Text style={styles.completedMeta}>{t.stops.length} stops · tap to run again</Text>
                  </View>
                  <MaterialIcons name="replay" size={18} color="#38BDF8" />
                </Pressable>
              ))
            )}
          </View>

          <View style={styles.completedArchive}>
            <Text style={styles.completedTitle}>Trip history</Text>
            {completedTrips.length === 0 ? (
              <Text style={styles.completedEmpty}>No completed trips yet</Text>
            ) : (
              completedTrips.map((t, i) => (
                <Pressable
                  key={t.id}
                  onPress={() => router.push(`/itinerary/${t.id}` as never)}
                  style={[styles.completedRow, i > 0 && styles.completedRowBorder]}>
                  <Text style={{ fontSize: 16 }}>✅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.completedName}>{t.title}</Text>
                    <Text style={styles.completedMeta}>
                      {formatDayLabel(t.date)} · {t.stops.length} stops
                    </Text>
                  </View>
                  <Text style={styles.completedSaved}>Saved {estimateSavedTime(t.stops)}</Text>
                </Pressable>
              ))
            )}
          </View>
        </>
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

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  itinHeader: { gap: 2, paddingTop: 2 },
  h1: { fontSize: 24, fontWeight: '700', lineHeight: 29 },
  segment: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentLabel: { fontSize: 13 },
  segmentBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  segmentBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  novaHero: {
    borderColor: 'rgba(56,189,248,0.2)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    overflow: 'hidden',
    padding: 16,
  },
  novaHeroGlow: {
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderRadius: 80,
    height: 160,
    position: 'absolute',
    right: 0,
    top: 0,
    transform: [{ translateX: 48 }, { translateY: -48 }],
    width: 160,
  },
  novaHeroRow: { flexDirection: 'row', gap: 16 },
  novaLive: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  novaLiveText: { color: '#34D399', fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  liveDot: { backgroundColor: '#34D399', borderRadius: 3, height: 6, width: 6 },
  heroBody: { color: '#C8D8F0', flex: 1, fontSize: 12, lineHeight: 18 },
  heroBodyLg: { color: '#C8D8F0', fontSize: 14, lineHeight: 21 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  statLabel: { color: '#4B6080', fontSize: 9, marginTop: 2 },
  statVal: { fontSize: 16, fontWeight: '800', lineHeight: 16 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: {
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modeLabel: { color: '#7C9CC0', fontSize: 13, fontWeight: '700' },
  composeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  composeLabel: { fontSize: 13, fontWeight: '700' },
  emptyTrips: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    padding: 20,
  },
  emptyTripsTitle: { color: '#EEF2FF', fontSize: 15, fontWeight: '700' },
  emptyTripsBody: { color: '#7C9CC0', fontSize: 13, lineHeight: 18 },
  tripCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  insetHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 1,
  },
  tripCardHead: { paddingBottom: 12, paddingHorizontal: 16, paddingTop: 16 },
  tripHeadRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  tripTitle: { color: '#EEF2FF', fontSize: 14, fontWeight: '700' },
  tripDayLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  tripStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  tripStat: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  tripStatLabel: { color: '#4B6080', fontSize: 9 },
  tripStatVal: { color: '#EEF2FF', fontSize: 12, fontWeight: '700', lineHeight: 12 },
  stopCountPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: 999,
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  stopCountText: { color: '#34D399', fontSize: 10, fontWeight: '700' },
  tripExpanded: { paddingBottom: 16, paddingHorizontal: 16 },
  novaReason: {
    backgroundColor: 'rgba(6,182,212,0.1)',
    borderColor: 'rgba(6,182,212,0.2)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    padding: 12,
  },
  tripCtaRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tripStartBtn: {
    alignItems: 'center',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  tripStartText: { color: '#070D1C', fontSize: 14, fontWeight: '700' },
  tripActivatedBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(52,211,153,0.14)',
    borderColor: 'rgba(52,211,153,0.28)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  tripActivatedText: { color: '#34D399', fontSize: 14, fontWeight: '700' },
  clipboardBtn: {
    alignItems: 'center',
    backgroundColor: glass(0.07),
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  detailBtn: {
    alignItems: 'center',
    backgroundColor: glass(0.07),
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  routeIcon: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  completedArchive: {
    backgroundColor: glass(0.04),
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  preferredHighlight: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.28)',
  },
  completedTitle: { color: '#7C9CC0', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  completedEmpty: { color: '#4B6080', fontSize: 12, marginTop: 4 },
  completedRow: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 10 },
  completedRowBorder: { borderTopColor: 'rgba(255,255,255,0.04)', borderTopWidth: 1 },
  completedName: { color: '#C8D8F0', fontSize: 14, fontWeight: '600' },
  completedMeta: { color: '#4B6080', fontSize: 12 },
  completedSaved: { color: '#2A3A54', fontSize: 12 },
});
