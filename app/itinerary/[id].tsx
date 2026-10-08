import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText as Text } from '@/components/orbit/app-text';
import { ContextMenu } from '@/components/orbit/context-menu';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { space } from '@/constants/orbit-theme';
import {
  makeStopNextIds,
  moveOpenStopIds,
  stopPlaceLine,
  todayIso,
  tripIntent,
} from '@/lib/itinerary/trip-intent';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { ItineraryStop, ItineraryStopKind } from '@/types/orbit';

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

const ARRIVED_GREEN = '#34D399';

function mapsSpokenName(app: string): string {
  if (app === 'apple') return 'Apple Maps';
  if (app === 'google') return 'Google Maps';
  if (app === 'waze') return 'Waze';
  return 'Maps';
}

export default function ItineraryDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const {
    advanceItineraryStop,
    reopenItineraryStop,
    accentTheme,
    household,
    openFullItineraryInMaps,
    openStopInMaps,
    preferredMapsApp,
    reorderItineraryStops,
    rerunItinerary,
    toggleItineraryFavorite,
  } = useOrbit();
  const [editingRoute, setEditingRoute] = useState(false);
  /** Local: arrived at current stop → show I'm done before advancing. */
  const [arrivedStopId, setArrivedStopId] = useState<string | null>(null);

  const itinerary = household.itineraries?.find((item) => item.id === id);
  const intent = useMemo(
    () => (itinerary ? tripIntent(itinerary, todayIso()) : null),
    [itinerary]
  );

  useEffect(() => {
    if (!intent?.showReorder) setEditingRoute(false);
  }, [intent?.showReorder]);

  useEffect(() => {
    // New current stop → reset arrived phase.
    if (intent?.current?.id && arrivedStopId && arrivedStopId !== intent.current.id) {
      setArrivedStopId(null);
    }
  }, [intent?.current?.id, arrivedStopId]);

  const tripColor = accentTheme.primary;
  // Warm brown canvases can report isDark=false while still being dark — never trust that
  // for the page title. Always use cream ink on this screen.
  const titleColor = '#F7F2EC';
  const softColor = '#C9B8AA';
  const arrived = Boolean(intent?.current && arrivedStopId === intent.current.id);
  const isLastStop = (intent?.remaining.length ?? 0) <= 1;

  const fail = (message: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    orbitAlert(message);
  };

  if (!itinerary || !intent) {
    return (
      <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top + 12 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={22} color={tripColor} />
          <Text style={[styles.backLabel, { color: tripColor }]}>Plan</Text>
        </Pressable>
        <Text style={[styles.pageTitle, { color: titleColor }]}>Trip not found</Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back to Plan
        </OrbitButton>
      </View>
    );
  }

  const current = intent.current;
  const mapsName = mapsSpokenName(preferredMapsApp);
  const favoriteLabel = itinerary.favorite
    ? 'Remove from preferred trips'
    : 'Save as preferred trip';

  const onDirections = async () => {
    try {
      await openFullItineraryInMaps(itinerary.id);
    } catch {
      fail(`Couldn’t open ${mapsName}. Try again in a moment.`);
    }
  };

  const onImHere = () => {
    if (!current) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setArrivedStopId(current.id);
  };

  const onImDone = async () => {
    if (!current) return;
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
      const wasLast = intent.remaining.length <= 1;
      await advanceItineraryStop(itinerary.id, current.id);
      setArrivedStopId(null);
      if (wasLast) {
        router.back();
      }
    } catch {
      fail('Couldn’t update this stop. Try again.');
    }
  };

  const onReopen = async (stopId: string) => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
      await reopenItineraryStop(itinerary.id, stopId);
      setArrivedStopId(null);
      void Haptics.selectionAsync();
    } catch {
      fail('Couldn’t reopen that stop.');
    }
  };

  const onRunAgain = async () => {
    try {
      const created = await rerunItinerary(itinerary.id);
      if (created) router.replace(`/itinerary/${created.id}` as never);
    } catch {
      fail('Couldn’t start this run again. Try again.');
    }
  };

  const onReorder = async (ids: string[] | null) => {
    if (!ids) return;
    try {
      await reorderItineraryStops(itinerary.id, ids);
    } catch {
      fail('Couldn’t change the order. Try again.');
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PersistentScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 },
        ]}
        indicatorColor={tripColor}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back to Plan">
            <MaterialIcons name="chevron-left" size={22} color={tripColor} />
            <Text style={[styles.backLabel, { color: tripColor }]}>Plan</Text>
          </Pressable>
          <GlowStar
            favorite={Boolean(itinerary.favorite)}
            onPress={() => void toggleItineraryFavorite(itinerary.id)}
            label={favoriteLabel}
            muted={c.textMuted}
            glassBg={glass(0.06)}
            glassBd={glassBorder(0.1)}
          />
        </View>

        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.header}>
          <Text style={[styles.eyebrow, { color: tripColor }]}>{intent.subtitle}</Text>
          <Text style={styles.pageTitle} accessibilityRole="header">
            {itinerary.title}
          </Text>
          {!itinerary.favorite ? (
            <Text style={[styles.saveHint, { color: softColor }]}>
              Tap the star to save this trip
            </Text>
          ) : null}
        </Animated.View>

        {intent.phase === 'empty' ? (
          <Animated.View
            entering={FadeInDown.delay(60).duration(280)}
            style={[
              styles.card,
              { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) },
            ]}>
            <Text style={[styles.cardTitle, { color: titleColor }]}>{intent.emptyTitle}</Text>
            <Text style={[styles.muted, { color: c.textMuted }]}>{intent.emptyBody}</Text>
            <OrbitButton tone="secondary" onPress={() => router.back()}>
              Back to Plan
            </OrbitButton>
          </Animated.View>
        ) : null}

        {current ? (
          <Animated.View
            entering={FadeInDown.delay(80).springify().damping(18)}
            layout={Layout.springify()}>
            <LinearGradient
              colors={
                arrived
                  ? [`${ARRIVED_GREEN}44`, `${ARRIVED_GREEN}14`, isDark ? 'rgba(7,13,28,0.2)' : 'rgba(255,255,255,0.4)']
                  : [`${tripColor}40`, `${tripColor}12`, isDark ? 'rgba(7,13,28,0.2)' : 'rgba(255,255,255,0.4)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.hero,
                { borderColor: arrived ? `${ARRIVED_GREEN}77` : `${tripColor}55` },
              ]}>
              <View
                style={[
                  styles.heroMark,
                  { backgroundColor: arrived ? `${ARRIVED_GREEN}30` : `${tripColor}28` },
                ]}>
                <Text style={styles.heroEmoji}>{STOP_EMOJI[current.kind]}</Text>
              </View>
              <Text style={[styles.heroName, { color: titleColor }]}>{current.label}</Text>
              {stopPlaceLine(current) ? (
                <Text style={[styles.heroPlace, { color: softColor }]} numberOfLines={2}>
                  {stopPlaceLine(current)}
                </Text>
              ) : null}

              <View style={styles.heroActions}>
                {intent.showDirections && !arrived ? (
                  <OrbitButton onPress={() => void onDirections()}>
                    {intent.primaryCtaLabel}
                  </OrbitButton>
                ) : null}

                {!arrived && intent.showImHere ? (
                  <OrbitButton tone="secondary" onPress={onImHere}>
                    I’m here
                  </OrbitButton>
                ) : null}

                {arrived && intent.showShopping ? (
                  <OrbitButton onPress={() => router.push('/shopping-mode' as never)}>
                    Open shopping list
                  </OrbitButton>
                ) : null}

                {arrived ? (
                  <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)}>
                    <DoneSlideButton
                      label={
                        isLastStop
                          ? 'I’m done · finish'
                          : intent.showShopping
                            ? 'List done · next stop'
                            : 'I’m done · next'
                      }
                      onDone={() => void onImDone()}
                    />
                  </Animated.View>
                ) : null}

                {intent.showShopping && !arrived ? (
                  <Pressable
                    onPress={() => router.push('/shopping-mode' as never)}
                    style={styles.textLink}
                    accessibilityRole="button"
                    accessibilityLabel="Open shopping list">
                    <Text style={[styles.textLinkLabel, { color: tripColor }]}>Open list</Text>
                  </Pressable>
                ) : null}
              </View>
            </LinearGradient>
          </Animated.View>
        ) : null}

        {intent.primaryCta === 'run_again' ? (
          <Animated.View entering={FadeInDown.delay(100).duration(280)}>
            <OrbitButton onPress={() => void onRunAgain()}>{intent.primaryCtaLabel}</OrbitButton>
          </Animated.View>
        ) : null}

        {intent.showComingUp && !editingRoute ? (
          <Animated.View
            entering={FadeInDown.delay(120).duration(280)}
            style={[
              styles.card,
              { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) },
            ]}>
            <Text style={[styles.sectionHeading, { color: tripColor }]}>Coming up</Text>
            {intent.upcoming.map((stop, index) => (
              <UpcomingRow
                key={stop.id}
                stop={stop}
                index={index}
                muted={c.textMuted}
                text={titleColor}
                accent={tripColor}
                glassBg={glass(0.04)}
                editing={false}
                onDirections={() => void openStopInMaps(itinerary.id, stop.id)}
                onMakeNext={() => void onReorder(makeStopNextIds(itinerary, stop.id))}
                onMove={(direction) => void onReorder(moveOpenStopIds(itinerary, stop.id, direction))}
              />
            ))}
            {intent.showReorder ? (
              <Pressable
                onPress={() => setEditingRoute(true)}
                style={styles.textLink}
                accessibilityRole="button"
                accessibilityLabel="Edit route">
                <Text style={[styles.textLinkLabel, { color: tripColor }]}>Edit route</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}

        {editingRoute && intent.showReorder ? (
          <View
            style={[
              styles.card,
              { backgroundColor: glass(0.05), borderColor: `${tripColor}44` },
            ]}>
            <Text style={[styles.sectionHeading, { color: tripColor }]}>Route</Text>
            {intent.remaining.map((stop, index) => (
              <UpcomingRow
                key={stop.id}
                stop={stop}
                index={index}
                muted={c.textMuted}
                text={titleColor}
                accent={tripColor}
                glassBg={glass(0.04)}
                editing
                onDirections={() => undefined}
                onMakeNext={() => undefined}
                onMove={(direction) => void onReorder(moveOpenStopIds(itinerary, stop.id, direction))}
              />
            ))}
            <Pressable
              onPress={() => setEditingRoute(false)}
              style={styles.textLink}
              accessibilityRole="button"
              accessibilityLabel="Done editing route">
              <Text style={[styles.textLinkLabel, { color: tripColor }]}>Done</Text>
            </Pressable>
          </View>
        ) : null}

        {intent.showCompletedRecap ? (
          <View
            style={[
              styles.card,
              { backgroundColor: glass(0.04), borderColor: glassBorder(0.08) },
            ]}>
            <Text style={[styles.sectionHeading, { color: c.textSubtle }]}>Done</Text>
            {intent.completed.map((stop) => (
              <Pressable
                key={stop.id}
                onPress={() => void onReopen(stop.id)}
                style={[styles.upcomingRow, { backgroundColor: glass(0.04) }]}
                accessibilityRole="button"
                accessibilityLabel={`Reopen ${stop.label}`}>
                <View style={[styles.upcomingMark, { backgroundColor: `${tripColor}18` }]}>
                  <Text style={styles.upcomingEmoji}>{STOP_EMOJI[stop.kind]}</Text>
                </View>
                <Text style={[styles.doneLine, { color: c.textSubtle, flex: 1 }]}>{stop.label}</Text>
                <Text style={[styles.reopenLabel, { color: tripColor }]}>Redo</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </PersistentScrollView>
    </View>
  );
}

/** Slide-ish I’m done control — tap advances; visual cue is the green fill + chevrons. */
function DoneSlideButton({ onDone, label }: { onDone: () => void; label: string }) {
  const scale = useSharedValue(1);
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
  }, [shimmer]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + shimmer.value * 0.45,
    transform: [{ translateX: (shimmer.value - 0.5) * 24 }],
  }));
  return (
    <Animated.View style={anim}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.97);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
        }}
        onPress={onDone}
        style={styles.doneBtn}
        accessibilityRole="button"
        accessibilityLabel={label}>
        <Animated.View style={[styles.doneShimmer, shimmerStyle]} />
        <MaterialIcons name="chevron-left" size={20} color="#041018" />
        <Text style={styles.doneBtnLabel}>{label}</Text>
        <MaterialIcons name="check-circle" size={18} color="#041018" />
      </Pressable>
    </Animated.View>
  );
}

function GlowStar({
  favorite,
  onPress,
  label,
  muted,
  glassBg,
  glassBd,
}: {
  favorite: boolean;
  onPress: () => void;
  label: string;
  muted: string;
  glassBg: string;
  glassBd: string;
}) {
  const glow = useSharedValue(favorite ? 1 : 0.35);
  useEffect(() => {
    if (favorite) {
      glow.value = withSpring(1);
      return;
    }
    glow.value = withRepeat(
      withSequence(withTiming(1, { duration: 750 }), withTiming(0.3, { duration: 750 })),
      -1,
      false
    );
  }, [favorite, glow]);
  const ring = useAnimatedStyle(() => ({
    shadowOpacity: 0.35 + glow.value * 0.65,
    transform: [{ scale: 0.94 + glow.value * 0.08 }],
  }));
  const starOrange = '#FF8A3D';
  return (
    <Animated.View
      style={[
        ring,
        {
          shadowColor: starOrange,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
        },
      ]}>
      <Pressable
        onPress={onPress}
        style={[
          styles.starBtn,
          {
            backgroundColor: favorite ? 'rgba(255,138,61,0.28)' : glassBg,
            borderColor: favorite ? starOrange : `${starOrange}99`,
            borderWidth: 1.5,
          },
        ]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: favorite }}>
        <MaterialIcons
          name={favorite ? 'star' : 'star-border'}
          size={22}
          color={favorite ? starOrange : starOrange}
        />
      </Pressable>
    </Animated.View>
  );
}

function UpcomingRow({
  stop,
  index,
  muted,
  text,
  accent,
  glassBg,
  editing,
  onDirections,
  onMakeNext,
  onMove,
}: {
  stop: ItineraryStop;
  index: number;
  muted: string;
  text: string;
  accent: string;
  glassBg: string;
  editing: boolean;
  onDirections: () => void;
  onMakeNext: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const place = stopPlaceLine(stop);
  const body = (
    <Animated.View
      entering={FadeInDown.delay(40 + index * 40).duration(240)}
      style={[styles.upcomingRow, { backgroundColor: glassBg }]}>
      <View style={[styles.upcomingMark, { backgroundColor: `${accent}22` }]}>
        <Text style={styles.upcomingEmoji}>{STOP_EMOJI[stop.kind]}</Text>
      </View>
      <View style={styles.upcomingCopy}>
        <Text style={[styles.upcomingName, { color: text }]}>{stop.label}</Text>
        {place ? (
          <Text style={[styles.upcomingPlace, { color: muted }]} numberOfLines={1}>
            {place}
          </Text>
        ) : null}
      </View>
      {editing ? (
        <View style={styles.reorderCol}>
          <Pressable
            onPress={() => onMove(-1)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Move ${stop.label} earlier`}>
            <MaterialIcons name="keyboard-arrow-up" size={22} color={muted} />
          </Pressable>
          <Pressable
            onPress={() => onMove(1)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Move ${stop.label} later`}>
            <MaterialIcons name="keyboard-arrow-down" size={22} color={muted} />
          </Pressable>
        </View>
      ) : (
        <MaterialIcons name="chevron-right" size={20} color={muted} />
      )}
    </Animated.View>
  );

  if (editing) return body;

  return (
    <ContextMenu
      onPress={onDirections}
      actions={[{ key: 'next', label: 'Go here next', icon: 'flag', onPress: onMakeNext }]}>
      {body}
    </ContextMenu>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    gap: 14,
    paddingHorizontal: 20,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    marginLeft: -4,
    minHeight: 44,
  },
  backLabel: { fontSize: 16, fontWeight: '700' },
  starBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  header: { gap: 4, marginBottom: 2 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pageTitle: {
    color: '#F7F2EC',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  saveHint: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  hero: {
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1.5,
    gap: 8,
    padding: 18,
  },
  heroMark: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    marginBottom: 2,
    width: 52,
  },
  heroEmoji: { fontSize: 26 },
  heroName: { color: '#F7F2EC', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  heroPlace: { fontSize: 14, lineHeight: 20 },
  heroActions: { gap: space.sm, marginTop: space.sm },
  doneBtn: {
    alignItems: 'center',
    backgroundColor: ARRIVED_GREEN,
    borderCurve: 'continuous',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 52,
    overflow: 'hidden',
    paddingHorizontal: 20,
  },
  doneShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.35)',
    width: 48,
  },
  doneBtnLabel: { color: '#041018', fontSize: 17, fontWeight: '800' },
  reopenLabel: { fontSize: 13, fontWeight: '800' },
  card: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  muted: { fontSize: 14, lineHeight: 20 },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  textLink: {
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  textLinkLabel: { fontSize: 15, fontWeight: '700' },
  doneLine: {
    fontSize: 15,
    lineHeight: 22,
    textDecorationLine: 'line-through',
  },
  upcomingRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  upcomingMark: {
    alignItems: 'center',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  upcomingEmoji: { fontSize: 16 },
  upcomingCopy: { flex: 1, gap: 2 },
  upcomingName: { fontSize: 16, fontWeight: '700' },
  upcomingPlace: { fontSize: 13 },
  reorderCol: { alignItems: 'center' },
});
