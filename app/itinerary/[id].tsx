import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { ContextMenu } from '@/components/orbit/context-menu';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { orbitColors, space } from '@/constants/orbit-theme';
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

  const itinerary = household.itineraries?.find((item) => item.id === id);
  const intent = useMemo(
    () => (itinerary ? tripIntent(itinerary, todayIso()) : null),
    [itinerary]
  );

  useEffect(() => {
    if (!intent?.showReorder) setEditingRoute(false);
  }, [intent?.showReorder]);

  const tripColor = accentTheme.primary;

  const fail = (message: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert(message);
  };

  if (!itinerary || !intent) {
    return (
      <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top + 12 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={22} color={tripColor} />
          <Text style={[styles.backLabel, { color: tripColor }]}>Plan</Text>
        </Pressable>
        <Text style={[styles.pageTitle, { color: c.text }]}>Trip not found</Text>
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

  const onImHere = async () => {
    if (!current) return;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await advanceItineraryStop(itinerary.id, current.id);
    } catch {
      fail('Couldn’t update this stop. Try again.');
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
          <Pressable
            onPress={() => void toggleItineraryFavorite(itinerary.id)}
            style={[styles.starBtn, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={favoriteLabel}
            accessibilityState={{ selected: Boolean(itinerary.favorite) }}>
            <MaterialIcons
              name={itinerary.favorite ? 'star' : 'star-border'}
              size={20}
              color={itinerary.favorite ? orbitColors.rankGold : c.textMuted}
            />
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.header}>
          <Text style={[styles.eyebrow, { color: tripColor }]}>{intent.subtitle}</Text>
          <Text style={[styles.pageTitle, { color: c.text }]} accessibilityRole="header">
            {itinerary.title}
          </Text>
        </Animated.View>

        {intent.phase === 'empty' ? (
          <Animated.View
            entering={FadeInDown.delay(60).duration(280)}
            style={[
              styles.card,
              { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) },
            ]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>{intent.emptyTitle}</Text>
            <Text style={[styles.muted, { color: c.textMuted }]}>{intent.emptyBody}</Text>
            <OrbitButton tone="secondary" onPress={() => router.back()}>
              Back to Plan
            </OrbitButton>
          </Animated.View>
        ) : null}

        {current ? (
          <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
            <LinearGradient
              colors={[`${tripColor}38`, `${tripColor}12`, isDark ? 'rgba(7,13,28,0.2)' : 'rgba(255,255,255,0.4)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.hero, { borderColor: `${tripColor}55` }]}>
              <View style={[styles.heroMark, { backgroundColor: `${tripColor}28` }]}>
                <Text style={styles.heroEmoji}>{STOP_EMOJI[current.kind]}</Text>
              </View>
              <Text style={[styles.heroName, { color: c.text }]}>{current.label}</Text>
              {stopPlaceLine(current) ? (
                <Text style={[styles.heroPlace, { color: c.textSoft }]} numberOfLines={2}>
                  {stopPlaceLine(current)}
                </Text>
              ) : null}
              <View style={styles.heroActions}>
                {intent.showDirections ? (
                  <OrbitButton onPress={() => void onDirections()}>{intent.primaryCtaLabel}</OrbitButton>
                ) : null}
                {intent.showImHere ? (
                  <OrbitButton tone="secondary" onPress={() => void onImHere()}>
                    {intent.imHereLabel}
                  </OrbitButton>
                ) : null}
                {intent.showShopping ? (
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
                text={c.text}
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
                text={c.text}
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
              <Text key={stop.id} style={[styles.doneLine, { color: c.textSubtle }]}>
                {stop.label}
              </Text>
            ))}
          </View>
        ) : null}
      </PersistentScrollView>
    </View>
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
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  hero: {
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  heroMark: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    marginBottom: 2,
    width: 48,
  },
  heroEmoji: { fontSize: 24 },
  heroName: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  heroPlace: { fontSize: 14, lineHeight: 20 },
  heroActions: { gap: space.sm, marginTop: space.sm },
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
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  upcomingMark: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  upcomingEmoji: { fontSize: 18 },
  upcomingCopy: { flex: 1, gap: 2 },
  upcomingName: { fontSize: 16, fontWeight: '700' },
  upcomingPlace: { fontSize: 13 },
  reorderCol: { alignItems: 'center' },
});
