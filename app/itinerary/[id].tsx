import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { ContextMenu } from '@/components/orbit/context-menu';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { orbitColors, orbitScreen, space, typography } from '@/constants/orbit-theme';
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
  const { c } = useOrbitColors();
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
    [itinerary],
  );

  useEffect(() => {
    if (!intent?.showReorder) setEditingRoute(false);
  }, [intent?.showReorder]);

  const tripColor = accentTheme.primary;

  const themedBack = (
    <Pressable
      onPress={() => router.back()}
      style={styles.backBtn}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Back to Plan">
      <MaterialIcons name="chevron-left" size={22} color={tripColor} />
      <Text style={[styles.backLabel, { color: tripColor }]}>Plan</Text>
    </Pressable>
  );

  const fail = (message: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert(message);
  };

  if (!itinerary || !intent) {
    return (
      <ScrollView
        style={orbitScreen.container}
        contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}>
        <Stack.Screen options={{ headerShown: false }} />
        {themedBack}
        <Text style={typography.title2}>Trip not found</Text>
        <Text style={[styles.emptyBody, { color: c.textMuted }]}>
          It may have been removed. Your other trips are still in Plan.
        </Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back to Plan
        </OrbitButton>
      </ScrollView>
    );
  }

  const current = intent.current;
  const mapsName = mapsSpokenName(preferredMapsApp);

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

  const favoriteLabel = itinerary.favorite
    ? 'Remove from preferred trips'
    : 'Save as preferred trip';

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        {themedBack}
        <Pressable
          onPress={() => void toggleItineraryFavorite(itinerary.id)}
          style={styles.starBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={favoriteLabel}
          accessibilityState={{ selected: Boolean(itinerary.favorite) }}>
          <MaterialIcons
            name={itinerary.favorite ? 'star' : 'star-border'}
            size={22}
            color={itinerary.favorite ? orbitColors.rankGold : c.textMuted}
          />
        </Pressable>
      </View>

      <View style={styles.header}>
        <PageEyebrow>{intent.subtitle}</PageEyebrow>
        <Text style={typography.title1} accessibilityRole="header">
          {itinerary.title}
        </Text>
        {intent.showSummary && itinerary.summary ? (
          <Text style={[styles.summary, { color: c.textMuted }]}>{itinerary.summary}</Text>
        ) : null}
        {itinerary.suggestedByPoppins ? (
          <Text style={[styles.poppinsCredit, { color: c.textSubtle }]}>Suggested by Poppins</Text>
        ) : null}
      </View>

      {intent.phase === 'empty' ? (
        <GlassCard>
          <Text style={[typography.title3, { color: c.text }]}>{intent.emptyTitle}</Text>
          <Text style={[styles.emptyBody, { color: c.textMuted }]}>{intent.emptyBody}</Text>
          <OrbitButton tone="secondary" onPress={() => router.back()}>
            Back to Plan
          </OrbitButton>
        </GlassCard>
      ) : null}

      {current ? (
        <GlassCard elevated style={styles.heroCard}>
          <Text style={[styles.heroName, { color: c.text }]}>{current.label}</Text>
          {stopPlaceLine(current) ? (
            <Text style={[styles.heroPlace, { color: c.textMuted }]}>{stopPlaceLine(current)}</Text>
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
        </GlassCard>
      ) : null}

      {intent.primaryCta === 'run_again' ? (
        <OrbitButton onPress={() => void onRunAgain()}>{intent.primaryCtaLabel}</OrbitButton>
      ) : null}

      {intent.showComingUp && !editingRoute ? (
        <GlassCard style={styles.sectionCard}>
          <Text style={[styles.sectionHeading, { color: c.textSubtle }]}>Coming up</Text>
          {intent.upcoming.map((stop) => (
            <UpcomingRow
              key={stop.id}
              stop={stop}
              muted={c.textMuted}
              text={c.text}
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
        </GlassCard>
      ) : null}

      {editingRoute && intent.showReorder ? (
        <GlassCard style={styles.sectionCard}>
          <Text style={[styles.sectionHeading, { color: c.textSubtle }]}>Route</Text>
          {intent.remaining.map((stop) => (
            <UpcomingRow
              key={stop.id}
              stop={stop}
              muted={c.textMuted}
              text={c.text}
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
        </GlassCard>
      ) : null}

      {intent.showCompletedRecap ? (
        <GlassCard style={styles.sectionCard}>
          <Text style={[styles.sectionHeading, { color: c.textSubtle }]}>Done</Text>
          {intent.completed.map((stop) => (
            <Text key={stop.id} style={[styles.doneLine, { color: c.textSubtle }]}>
              {stop.label}
            </Text>
          ))}
        </GlassCard>
      ) : null}
    </ScrollView>
  );
}

function UpcomingRow({
  stop,
  muted,
  text,
  editing,
  onDirections,
  onMakeNext,
  onMove,
}: {
  stop: ItineraryStop;
  muted: string;
  text: string;
  editing: boolean;
  onDirections: () => void;
  onMakeNext: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const place = stopPlaceLine(stop);
  const body = (
    <View style={styles.upcomingRow}>
      <Text style={styles.upcomingEmoji}>{STOP_EMOJI[stop.kind]}</Text>
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
    </View>
  );

  if (editing) {
    return body;
  }

  return (
    <ContextMenu
      onPress={onDirections}
      actions={[{ key: 'next', label: 'Go here next', icon: 'flag', onPress: onMakeNext }]}>
      {body}
    </ContextMenu>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    marginLeft: -4,
    minHeight: 44,
  },
  backLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  doneLine: {
    fontSize: 15,
    lineHeight: 22,
    textDecorationLine: 'line-through',
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  header: {
    gap: 6,
  },
  heroActions: {
    gap: space.sm,
    marginTop: space.md,
  },
  heroCard: {
    gap: 4,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '700',
  },
  heroPlace: {
    fontSize: 15,
    lineHeight: 20,
  },
  poppinsCredit: {
    fontSize: 13,
  },
  reorderCol: {
    alignItems: 'center',
  },
  sectionCard: {
    gap: space.sm,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  starBtn: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
  },
  textLink: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  textLinkLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  upcomingCopy: {
    flex: 1,
    gap: 2,
  },
  upcomingEmoji: {
    fontSize: 18,
  },
  upcomingName: {
    fontSize: 16,
    fontWeight: '600',
  },
  upcomingPlace: {
    fontSize: 13,
  },
  upcomingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 44,
    paddingVertical: 6,
  },
});
