import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
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
import { SAVED_GOLD } from '@/components/orbit/trips/saved-trips';
import type { ItineraryStop, ItineraryStopKind } from '@/types/orbit';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';

const STOP_MOJI: Record<ItineraryStopKind, MojiName> = {
  school: 'school',
  work: 'briefcase',
  grocery: 'cart',
  pickup: 'box',
  practice: 'ball',
  family: 'heartHome',
  home: 'home',
  shop: 'cart',
  custom: 'pin',
};

/** Darken a #RRGGBB colour for the button's bottom lip. */
function shade(hex: string, amount = 0.28): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.max(0, Math.round(v * (1 - amount)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

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
  const titleColor = c.text;
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);
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
  const favoriteLabel = itinerary.favorite ? 'Remove from saved trips' : 'Save this trip';
  const stepsTotal = itinerary.stops.length;
  const stepIndex = Math.min(stepsTotal, intent.completed.length + (current ? 1 : 0));

  const onToggleFavorite = async () => {
    const wasFavorite = Boolean(itinerary.favorite);
    try {
      await toggleItineraryFavorite(itinerary.id);
      void Haptics.selectionAsync();
      setToast(wasFavorite ? 'Removed from saved' : 'Saved to your trips');
    } catch {
      fail('Couldn’t save this trip. Try again.');
    }
  };

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
            style={[styles.iconBtn, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back to Plan">
            <MaterialIcons name="chevron-left" size={24} color={c.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.eyebrow, { color: c.textMuted }]} numberOfLines={1}>
              {intent.subtitle}
            </Text>
          </View>
          <Pressable
            onPress={() => void onToggleFavorite()}
            style={[
              styles.iconBtn,
              {
                backgroundColor: itinerary.favorite ? `${SAVED_GOLD}2E` : glass(0.06),
                borderColor: itinerary.favorite ? `${SAVED_GOLD}99` : glassBorder(0.1),
              },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={favoriteLabel}
            accessibilityState={{ selected: Boolean(itinerary.favorite) }}>
            <MaterialIcons
              name={itinerary.favorite ? 'star' : 'star-border'}
              size={22}
              color={itinerary.favorite ? SAVED_GOLD : c.textMuted}
            />
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.header}>
          <Text style={[styles.pageTitle, { color: c.text }]} accessibilityRole="header" numberOfLines={2}>
            {itinerary.title}
          </Text>
          {stepsTotal > 0 && current ? (
            <View
              style={styles.progress}
              accessibilityLabel={`Stop ${stepIndex} of ${stepsTotal}`}>
              {itinerary.stops.map((stop, i) => (
                <View
                  key={stop.id}
                  style={[
                    styles.progressSeg,
                    {
                      backgroundColor:
                        i < stepIndex - 1
                          ? ARRIVED_GREEN
                          : i === stepIndex - 1
                            ? tripColor
                            : glass(0.12),
                    },
                  ]}
                />
              ))}
              <Text style={[styles.progressLabel, { color: c.textMuted }]}>
                {stepIndex} of {stepsTotal}
              </Text>
            </View>
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
            layout={Layout.springify()}
            style={[
              styles.hero,
              {
                backgroundColor: glass(0.06),
                borderColor: arrived ? `${ARRIVED_GREEN}88` : glassBorder(0.12),
              },
            ]}>
            <View
              style={[
                styles.heroMark,
                { backgroundColor: arrived ? `${ARRIVED_GREEN}26` : `${tripColor}1F` },
              ]}>
              <Moji name={STOP_MOJI[current.kind]} size={34} />
            </View>
            <Text style={[styles.heroName, { color: c.text }]}>{current.label}</Text>
            {stopPlaceLine(current) ? (
              <Text style={[styles.heroPlace, { color: c.textMuted }]} numberOfLines={2}>
                {stopPlaceLine(current)}
              </Text>
            ) : null}

            <View style={styles.heroActions}>
              {intent.showDirections && !arrived ? (
                <LipButton
                  color={tripColor}
                  icon="near-me"
                  label={intent.primaryCtaLabel}
                  onPress={() => void onDirections()}
                />
              ) : null}

              {!arrived && intent.showImHere ? (
                <Pressable
                  onPress={onImHere}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    { borderColor: glassBorder(0.16), backgroundColor: pressed ? glass(0.08) : 'transparent' },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="I’m here">
                  <Text style={[styles.secondaryLabel, { color: c.text }]}>I’m here</Text>
                </Pressable>
              ) : null}

              {arrived && intent.showShopping ? (
                <LipButton
                  color={tripColor}
                  icon="shopping-cart"
                  label="Open shopping list"
                  onPress={() => router.push('/shopping-mode' as never)}
                />
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
          </Animated.View>
        ) : null}

        {intent.primaryCta === 'run_again' ? (
          <Animated.View entering={FadeInDown.delay(100).duration(280)}>
            <LipButton color={tripColor} icon="replay" label={intent.primaryCtaLabel} onPress={() => void onRunAgain()} />
          </Animated.View>
        ) : null}

        {intent.showComingUp && !editingRoute ? (
          <Animated.View
            entering={FadeInDown.delay(120).duration(280)}
            style={[
              styles.card,
              { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) },
            ]}>
            <Text style={[styles.sectionHeading, { color: c.textMuted }]}>Coming up</Text>
            {intent.upcoming.map((stop, index) => (
              <UpcomingRow
                key={stop.id}
                stop={stop}
                index={index}
                number={intent.completed.length + 2 + index}
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
            <Text style={[styles.sectionHeading, { color: c.textMuted }]}>Route</Text>
            {intent.remaining.map((stop, index) => (
              <UpcomingRow
                key={stop.id}
                stop={stop}
                index={index}
                number={intent.completed.length + 1 + index}
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
                <View style={[styles.numDot, { backgroundColor: `${ARRIVED_GREEN}26` }]}>
                  <MaterialIcons name="check" size={14} color={ARRIVED_GREEN} />
                </View>
                <Text style={[styles.doneLine, { color: c.textSubtle, flex: 1 }]}>{stop.label}</Text>
                <Text style={[styles.reopenLabel, { color: tripColor }]}>Redo</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </PersistentScrollView>
      {toast ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOut.duration(200)}
          pointerEvents="none"
          style={[styles.toast, { bottom: insets.bottom + 24, backgroundColor: c.text }]}>
          <MaterialIcons name="star" size={16} color={SAVED_GOLD} />
          <Text style={[styles.toastLabel, { color: c.background }]}>{toast}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Primary button: solid accent with a 4px darker bottom lip (pressed → lip collapses). */
function LipButton({
  color,
  label,
  icon,
  onPress,
}: {
  color: string;
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) => (
        <View style={[styles.lipBase, { backgroundColor: shade(color), paddingBottom: pressed ? 0 : 4, marginTop: pressed ? 4 : 0 }]}>
          <View style={[styles.lipFace, { backgroundColor: color }]}>
            {icon ? <MaterialIcons name={icon} size={20} color="#FFFFFF" /> : null}
            <Text style={styles.lipLabel}>{label}</Text>
          </View>
        </View>
      )}
    </Pressable>
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

function UpcomingRow({
  stop,
  index,
  number,
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
  number: number;
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
      <View style={[styles.numDot, { backgroundColor: `${accent}22` }]}>
        <Text style={[styles.numDotLabel, { color: accent }]}>{number}</Text>
      </View>
      <Moji name={STOP_MOJI[stop.kind]} size={22} />
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
    gap: 12,
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
  header: { gap: 4, marginBottom: 2 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  iconBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  progress: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 8 },
  progressSeg: { borderRadius: 3, flex: 1, height: 6, maxWidth: 56 },
  progressLabel: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  secondaryBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 50,
  },
  secondaryLabel: { fontSize: 17, fontWeight: '600' },
  lipBase: { borderCurve: 'continuous', borderRadius: 16 },
  lipFace: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  lipLabel: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  numDot: {
    alignItems: 'center',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  numDotLabel: { fontSize: 13, fontWeight: '800' },
  toast: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
  },
  toastLabel: { fontSize: 15, fontWeight: '600' },
  hero: {
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    gap: 6,
    padding: 20,
  },
  heroMark: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    height: 60,
    justifyContent: 'center',
    marginBottom: 4,
    width: 60,
  },
  heroName: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  heroPlace: { fontSize: 13, lineHeight: 18 },
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
  upcomingCopy: { flex: 1, gap: 2 },
  upcomingName: { fontSize: 17, fontWeight: '600' },
  upcomingPlace: { fontSize: 13 },
  reorderCol: { alignItems: 'center' },
});
