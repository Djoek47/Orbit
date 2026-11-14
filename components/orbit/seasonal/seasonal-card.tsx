/**
 * "Halloween / Thanksgiving / Christmas is here" — the seasonal card that turns the theme on.
 * Shows on Home until it's answered, and stays in Activity for the whole season as the on/off
 * button. Renders nothing out of season.
 */
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import { HalloweenKitten } from '@/components/orbit/seasonal/halloween-decor';
import { Holly, MapleLeafShape } from '@/components/orbit/seasonal/season-decor';
import {
  daysUntil,
  dismissSeasonCard,
  SEASON_MASCOT,
  SEASON_SURFACE,
  setSeason,
  useSeasonal,
  type SeasonId,
} from '@/lib/theme/seasonal';
import { useOrbitOptional } from '@/store/orbit-store';

const COPY: Record<
  SeasonId,
  { name: string; bigDay: string; on: (m: string) => string; off: (m: string) => string }
> = {
  halloween: {
    name: 'Halloween',
    bigDay: 'Tonight’s the night',
    on: (m) => `Bats, cobwebs and a little ${m} all over the app. It leaves on its own on November 1.`,
    off: (m) => `Try the spooky theme: bats, cobwebs and a little ${m} for your color. Turn it off any time.`,
  },
  thanksgiving: {
    name: 'Thanksgiving',
    bigDay: 'Happy Thanksgiving',
    on: (m) =>
      `Harvest colors, falling leaves and a ${m} all over the app. It leaves on its own the Monday after Thanksgiving.`,
    off: (m) => `Try the harvest theme: warm colors, falling leaves and a ${m} for your color. Turn it off any time.`,
  },
  christmas: {
    name: 'Christmas',
    bigDay: 'Merry Christmas',
    on: (m) => `Snow, twinkling lights and a ${m} all over the app. It leaves on its own on January 7.`,
    off: (m) => `Try the winter theme: snow, twinkling lights and a ${m} for your color. Turn it off any time.`,
  },
};

export function SeasonCard({ placement }: { placement: 'home' | 'activity' }) {
  const state = useSeasonal();
  const orbit = useOrbitOptional();
  const season = state.season;
  if (!season) return null;
  if (placement === 'home' && state.answered) return null;

  const palette = orbit?.accentTheme.id ?? 'coral';
  const mascot = SEASON_MASCOT[season][palette];
  const copy = COPY[season];
  const surface = SEASON_SURFACE[season];
  const days = daysUntil(season);
  const accent = orbit?.accentTheme.primary ?? surface.cardEdge;
  const on = state.active === season;
  const after = season === 'christmas' && new Date().getMonth() === 0;

  const turn = (next: boolean) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    void setSeason(season, next);
  };

  return (
    <Animated.View entering={FadeInDown.springify()} style={[styles.card, { backgroundColor: surface.card }]}>
      <View style={styles.corner}>
        {season === 'halloween' ? (
          <HalloweenKitten size={72} />
        ) : season === 'christmas' ? (
          <Holly size={56} />
        ) : (
          <View style={{ transform: [{ rotate: '-18deg' }] }}>
            <MapleLeafShape size={52} color="#E8703F" />
          </View>
        )}
      </View>
      <View style={styles.head}>
        <Animated.View entering={ZoomIn.delay(150).springify()}>
          <Moji name={mascot.moji} size={34} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: surface.text }]}>
            {on ? `${copy.name} is on` : `${copy.name} is here`}
          </Text>
          <Text style={[styles.sub, { color: surface.cardSub }]}>
            {after
              ? 'Happy New Year'
              : days === 0
                ? copy.bigDay
                : days === 1
                  ? '1 day to go'
                  : `${days} days to go`}
          </Text>
        </View>
      </View>
      <Text style={[styles.body, { color: surface.cardBody }]}>
        {on ? copy.on(mascot.name) : copy.off(mascot.name)}
      </Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => turn(!on)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.pill,
            { backgroundColor: on ? 'rgba(255,255,255,0.14)' : accent, transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}>
          <Text style={styles.pillText}>{on ? 'Turn it off' : 'Turn it on'}</Text>
        </Pressable>
        {!on && placement === 'home' ? (
          <Pressable
            onPress={() => void dismissSeasonCard(season)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.pill, styles.alt, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
            <Text style={styles.pillText}>Not now</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

/** @deprecated The card now covers every season. */
export const HalloweenCard = SeasonCard;

const styles = StyleSheet.create({
  card: {
    borderCurve: 'continuous',
    borderRadius: 22,
    gap: 10,
    overflow: 'hidden',
    padding: 16,
  },
  corner: { bottom: -6, position: 'absolute', right: -2 },
  head: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 13 },
  body: { fontSize: 15, lineHeight: 20, paddingRight: 56 },
  row: { flexDirection: 'row', gap: 8 },
  pill: { borderRadius: 999, minHeight: 40, justifyContent: 'center', paddingHorizontal: 16 },
  alt: { backgroundColor: 'rgba(255,255,255,0.14)' },
  pillText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
