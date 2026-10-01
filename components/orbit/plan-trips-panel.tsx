import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { Moji } from '@/components/orbit/moji/moji';
import { MyPlacesPanel } from '@/components/orbit/my-places-panel';
import { PoppinsOrb } from '@/components/orbit/poppins-orb';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { RouteSteps, type RouteStepItem } from '@/components/orbit/route-steps';
import { SmartTripsIntro } from '@/components/orbit/trips/smart-trips-intro';
import { TourTarget } from '@/components/orbit/tour/tour-target';
import { FontFamily } from '@/constants/typography';
import { buildPickupSummary } from '@/lib/places/pickup-summary';
import { useMajordomoName } from '@/lib/ai/use-majordomo-name';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { Itinerary, ItineraryStop, ItineraryStopKind } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

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

function poppinsReasonForTrip(trip: Itinerary): string {
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
  const { c, glass, glassBorder } = useOrbitColors();
  const majordomoName = useMajordomoName();
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

  return (
    <View
      style={[
        styles.tripCard,
        {
          backgroundColor: expanded ? `${color}14` : glass(0.05),
          borderColor: expanded ? `${color}30` : glassBorder(0.09),
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
            <Text style={[styles.tripTitle, { color: '#F7F2EC' }]}>{trip.title}</Text>
            <Text style={[styles.tripDayLabel, { color }]}>{formatDayLabel(trip.date)}</Text>
          </View>
          {trip.favorite ? (
            <MaterialIcons name="star" size={16} color="#FBBF24" style={{ marginRight: 4 }} />
          ) : null}
          <MaterialIcons
            name="chevron-right"
            size={16}
            color={c.textSubtle}
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
              <MaterialIcons name={s.icon} size={12} color={s.accent ? '#34D399' : c.textSubtle} />
              <View>
                <Text
                  style={[
                    styles.tripStatVal,
                    { color: c.text },
                    s.accent && { color: '#34D399' },
                  ]}>
                  {s.val}
                </Text>
                <Text style={[styles.tripStatLabel, { color: c.textSubtle }]}>{s.label}</Text>
              </View>
            </View>
          ))}
          <View style={styles.stopCountPill}>
            <Text style={styles.stopCountText}>{stops.length} stops</Text>
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.tripExpanded}>
          <View style={styles.poppinsReason}>
            <MaterialIcons name="auto-awesome" size={13} color="#06B6D4" />
            <Text style={[styles.heroBody, { color: c.textSoft }]}>
              <Text style={{ color: '#06B6D4', fontFamily: FontFamily.bold, fontWeight: '700' }}>
                {majordomoName}:{' '}
              </Text>
              {poppinsReasonForTrip(trip)}
            </Text>
          </View>
          <RouteSteps steps={steps} accentColor={color} emphasized={!activated} />
          <Animated.View entering={FadeInUp.delay(80).springify().damping(18)} style={styles.tripCtaRow}>
            <Pressable
              onPress={handleStart}
              accessibilityRole="button"
              accessibilityLabel="Start trip in Maps"
              style={{ flex: 1 }}>
              {activated ? (
                <View style={styles.tripActivatedBtn}>
                  <MaterialIcons name="check" size={16} color="#34D399" />
                  <Text style={styles.tripActivatedText}>Trip Activated</Text>
                </View>
              ) : (
                <LinearGradient
                  colors={[color, `${color}B8`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tripStartBtn}>
                  <MaterialIcons name="navigation" size={17} color={c.ink} />
                  <Text style={[styles.tripStartText, { color: c.ink }]}>Start Trip in Maps</Text>
                </LinearGradient>
              )}
            </Pressable>
            <Pressable
              onPress={() => router.push(`/itinerary/${trip.id}` as never)}
              accessibilityRole="button"
              accessibilityLabel="Edit trip"
              style={({ pressed }) => [
                styles.editBtn,
                {
                  backgroundColor: glass(0.08),
                  borderColor: glassBorder(0.14),
                  opacity: pressed ? 0.88 : 1,
                },
              ]}>
              <MaterialIcons name="edit" size={16} color={c.textSoft} />
              <Text style={[styles.editBtnText, { color: c.textSoft }]}>Edit</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Full Poppins Smart Trips experience — Design 8 glass + My Places segment.
 */
export function PlanTripsPanel({
  selectedDateKey,
  section: sectionProp,
  onSectionChange,
}: {
  selectedDateKey: string;
  section?: TripsSection;
  onSectionChange?: (section: TripsSection) => void;
}) {
  const {
    accentTheme,
    household,
    openFullItineraryInMaps,
    rerunItinerary,
    suggestPoppinsItinerary,
  } = useOrbit();
  const majordomoName = useMajordomoName();
  const { c, glass, glassBorder } = useOrbitColors();
  const [sectionLocal, setSectionLocal] = useState<TripsSection>('trips');
  const section = sectionProp ?? sectionLocal;
  const setSection = (next: TripsSection) => {
    if (onSectionChange) onSectionChange(next);
    else setSectionLocal(next);
  };
  const [mode, setMode] = useState<SuggestMode>('efficient');
  const [busy, setBusy] = useState(false);
  const [askHint, setAskHint] = useState('');
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
    setAskHint('');
    try {
      const created = await suggestPoppinsItinerary({
        mode,
        date: opts?.date ?? selectedDateKey,
        eventIds: opts?.eventIds,
      });
      if (created) router.push(`/itinerary/${created.id}` as never);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Ask Poppins about trips. It opens the Poppins tab — in whichever mode the household is on —
   * with a trip question ready to send, rather than running a hidden request from this screen
   * and leaving people on a page that looks unchanged.
   */
  const askPoppinsAboutTrips = () => {
    router.push('/(tabs)/poppins?ask=trips' as never);
  };


  const handleStartTrip = async (trip: Itinerary) => {
    await openFullItineraryInMaps(trip.id);
    router.push(`/itinerary/${trip.id}` as never);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.itinHeader}>
        <PageEyebrow>{majordomoName} Smart Trips</PageEyebrow>
        <Text style={[styles.h1, { color: c.text }]}>Itineraries</Text>
      </View>

      {/* Smart Trips | My Places */}
      <TourTarget id="plan.smartTrips">
      <View
        style={[
          styles.segment,
          {
            backgroundColor: glass(0.05),
            borderColor: glassBorder(0.1),
          },
        ]}>
        {(
          [
            { id: 'trips' as const, label: 'Smart Trips', icon: 'route' as const, color: '#38BDF8' },
            { id: 'places' as const, label: 'My Places', icon: 'place' as const, color: '#A78BFA' },
          ] as const
        ).map((tab) => {
          const active = section === tab.id;
          const inactiveColor = c.textMuted;
          const btn = (
            <Pressable
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
                color={active ? tab.color : inactiveColor}
              />
              <Text
                style={[
                  styles.segmentLabel,
                  { color: active ? tab.color : inactiveColor, fontWeight: active ? '700' : '600' },
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
          if (tab.id === 'places') {
            return (
              <TourTarget id="plan.placesSegment" key={tab.id} style={{ flex: 1 }}>
                {btn}
              </TourTarget>
            );
          }
          return <View key={tab.id} style={{ flex: 1 }}>{btn}</View>;
        })}
      </View>
      </TourTarget>

      {section === 'places' ? (
        <TourTarget id="plan.myPlaces">
          <View>
            <TourTarget id="plan.addPlace">
              <MyPlacesPanel compact showFab />
            </TourTarget>
          </View>
        </TourTarget>
      ) : (
        <>
          {activeTrips.length === 0 ? (
            <TourTarget id="plan.newTrip">
            <SmartTripsIntro
              majordomoName={majordomoName}
              busy={busy}
              onAsk={askPoppinsAboutTrips}
              onCalendar={() => void runSuggest({ date: selectedDateKey })}
              onNew={() => router.push('/create-itinerary' as never)}
            />
            </TourTarget>
          ) : (
            <>
              <LinearGradient
                colors={['rgba(6,182,212,0.15)', 'rgba(56,189,248,0.08)', 'rgba(129,140,248,0.08)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.poppinsHero}>
                <View style={styles.poppinsHeroGlow} />
                <View style={styles.poppinsHeroRow}>
                  <PoppinsOrb size={48} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.poppinsLive}>
                      <View style={styles.liveDot} />
                      <Text style={styles.poppinsLiveText}>{majordomoName.toUpperCase()} SMART ROUTING</Text>
                    </View>
                    <Text style={[styles.heroBodyLg, { color: c.textSoft }]}>
                      {activeTrips.length} trip{activeTrips.length === 1 ? '' : 's'} planned ·{' '}
                      <Text style={{ color: '#34D399', fontWeight: '700' }}>
                        {estimateTimeSavedAll(activeTrips)} saved
                      </Text>
                    </Text>
                  </View>
                </View>
                <View style={styles.statRow}>
                  {[
                    { val: String(activeTrips.length), label: 'Trips', color: '#38BDF8' },
                    { val: estimateTimeSavedAll(activeTrips), label: 'Time saved', color: '#34D399' },
                    { val: String(totalStopsBundled), label: 'Stops', color: '#A78BFA' },
                  ].map((s) => (
                    <View key={s.label} style={styles.stat}>
                      <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
                      <Text style={[styles.statLabel, { color: c.textSubtle }]}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>

              <TourTarget id="plan.newTrip">
              <View style={styles.actionBar}>
                <ComposeChip
                  icon="auto-awesome"
                  label={`Ask ${majordomoName}`}
                  accent="#38BDF8"
                  fill="#38BDF8"
                  busy={busy}
                  onPress={askPoppinsAboutTrips}
                />
                <ComposeChip
                  icon="event"
                  label="From calendar"
                  accent="#F59E0B"
                  onPress={() => void runSuggest({ date: selectedDateKey })}
                />
                <ComposeChip
                  icon="add"
                  label="New"
                  accent="#2DD4BF"
                  onPress={() => router.push('/create-itinerary' as never)}
                />
              </View>
              </TourTarget>
              {/* How the stops get ordered */}
              <View style={styles.modeRow}>
                <Text style={[styles.modeHint, { color: c.textSubtle }]}>Order stops</Text>
                {(['efficient', 'spread'] as const).map((option) => {
                  const active = mode === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setMode(option)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={
                        option === 'efficient' ? 'Shortest route' : 'Spread across the day'
                      }
                      style={[
                        styles.modeChip,
                        { borderColor: glassBorder(0.12), backgroundColor: glass(0.04) },
                        active && {
                          backgroundColor: `${accentTheme.primary}28`,
                          borderColor: `${accentTheme.primary}66`,
                        },
                      ]}>
                      <MaterialIcons
                        name={option === 'efficient' ? 'bolt' : 'spa'}
                        size={14}
                        color={active ? accentTheme.primary : c.textMuted}
                      />
                      <Text
                        style={[
                          styles.modeLabel,
                          { color: c.textMuted },
                          active && { color: accentTheme.primary },
                        ]}>
                        {option === 'efficient' ? 'Shortest' : 'Relaxed'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {askHint ? (
            <Text style={[styles.emptyTripsBody, { color: c.textMuted, marginBottom: 8 }]}>{askHint}</Text>
          ) : null}

          <View style={{ gap: 12 }}>
            {activeTrips.map((trip, index) => (
              <TripCard key={trip.id} trip={trip} index={index} onStartTrip={handleStartTrip} />
            ))}
          </View>

          {preferredTrips.length ? (
          <View
            style={[
              styles.completedArchive,
              { backgroundColor: glass(0.04), borderColor: glassBorder(0.07) },
            ]}>
            <Text style={[styles.completedTitle, { color: c.textMuted }]}>Routines</Text>
            {(
              preferredTrips.map((t, i) => (
                <Pressable
                  key={`fav-${t.id}`}
                  onPress={() =>
                    void rerunItinerary(t.id).then((created) => {
                      if (created) router.push(`/itinerary/${created.id}` as never);
                    })
                  }
                  style={[
                    styles.completedRow,
                    i > 0 && { borderTopColor: glassBorder(0.04), borderTopWidth: 1 },
                  ]}>
                  <Moji name="star" size={18} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.completedName, { color: c.textSoft }]}>{t.title}</Text>
                    <Text style={[styles.completedMeta, { color: c.textSubtle }]}>
                      {t.stops.length} stops · tap to run again
                    </Text>
                  </View>
                  <MaterialIcons name="replay" size={18} color="#38BDF8" />
                </Pressable>
              ))
            )}
          </View>
          ) : null}

          {completedTrips.length ? (
          <View
            style={[
              styles.completedArchive,
              { backgroundColor: glass(0.04), borderColor: glassBorder(0.07) },
            ]}>
            <Text style={[styles.completedTitle, { color: c.textMuted }]}>Past trips</Text>
            {(
              completedTrips.map((t, i) => (
                <Pressable
                  key={t.id}
                  onPress={() => router.push(`/itinerary/${t.id}` as never)}
                  style={[
                    styles.completedRow,
                    i > 0 && { borderTopColor: glassBorder(0.04), borderTopWidth: 1 },
                  ]}>
                  <Moji name="check" size={18} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.completedName, { color: c.textSoft }]}>{t.title}</Text>
                    <Text style={[styles.completedMeta, { color: c.textSubtle }]}>
                      {formatDayLabel(t.date)} · {t.stops.length} stops
                    </Text>
                  </View>
                  <Text style={[styles.completedSaved, { color: c.textFaint }]}>
                    Saved {estimateSavedTime(t.stops)}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
          ) : null}
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
  fill,
  busy,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  accent: string;
  /** Solid fill (Poppins path) vs tinted outline (DIY). */
  fill?: string;
  busy?: boolean;
}) {
  const ink = fill ? '#041018' : accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.composeChip,
        {
          backgroundColor: fill ?? `${accent}24`,
          borderColor: fill ?? `${accent}88`,
        },
        pressed && { opacity: 0.85 },
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={ink} />
      ) : (
        <MaterialIcons name={icon} size={16} color={ink} />
      )}
      <Text style={[styles.composeLabel, { color: ink }]}>{label}</Text>
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
  poppinsHero: {
    borderColor: 'rgba(56,189,248,0.2)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    overflow: 'hidden',
    padding: 16,
  },
  poppinsHeroGlow: {
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderRadius: 80,
    height: 160,
    position: 'absolute',
    right: 0,
    top: 0,
    transform: [{ translateX: 48 }, { translateY: -48 }],
    width: 160,
  },
  poppinsHeroRow: { flexDirection: 'row', gap: 16 },
  poppinsLive: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  poppinsLiveText: { color: '#34D399', fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  liveDot: { backgroundColor: '#34D399', borderRadius: 3, height: 6, width: 6 },
  heroBody: { flex: 1, fontSize: 12, lineHeight: 18 },
  heroBodyLg: { fontSize: 14, lineHeight: 21 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  statLabel: { fontSize: 9, marginTop: 2 },
  statVal: { fontSize: 16, fontWeight: '800', lineHeight: 16 },
  actionBar: { flexDirection: 'row', gap: 8 },
  modeHint: { fontSize: 12, fontWeight: '700', marginRight: 2 },
  modeRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  modeChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeLabel: { fontSize: 13, fontWeight: '700' },
  composeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  composeChip: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  composeLabel: { fontSize: 13, fontWeight: '700' },
  emptyTrips: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    padding: 20,
  },
  emptyTripsTitle: { fontSize: 15, fontWeight: '700' },
  emptyTripsBody: { fontSize: 13, lineHeight: 18 },
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
  tripTitle: { fontSize: 14, fontWeight: '700' },
  tripDayLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  tripStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  tripStat: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  tripStatLabel: { fontSize: 9 },
  tripStatVal: { fontSize: 12, fontWeight: '700', lineHeight: 12 },
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
  poppinsReason: {
    backgroundColor: 'rgba(6,182,212,0.1)',
    borderColor: 'rgba(6,182,212,0.2)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    padding: 12,
  },
  tripCtaRow: { alignItems: 'stretch', flexDirection: 'row', gap: 8, marginTop: 16 },
  tripStartBtn: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tripStartText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  tripActivatedBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(52,211,153,0.14)',
    borderColor: 'rgba(52,211,153,0.28)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: 14,
  },
  tripActivatedText: {
    color: '#34D399',
    fontFamily: FontFamily.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  editBtn: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  editBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    fontWeight: '600',
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
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  preferredHighlight: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.28)',
  },
  completedTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  completedEmpty: { fontSize: 12, marginTop: 4 },
  completedRow: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 10 },
  completedName: { fontSize: 14, fontWeight: '600' },
  completedMeta: { fontSize: 12 },
  completedSaved: { fontSize: 12 },
});
