/**
 * "Halloween is here" — the seasonal card that turns the theme on. Shows on Home until it's
 * answered, and stays in Activity for the whole season as the on/off button.
 */
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import { HalloweenKitten } from '@/components/orbit/seasonal/halloween-decor';
import {
  daysUntilHalloween,
  dismissHalloweenCard,
  HALLOWEEN_MONSTER,
  setHalloween,
  useSeasonal,
} from '@/lib/theme/seasonal';
import { useOrbitOptional } from '@/store/orbit-store';

export function HalloweenCard({ placement }: { placement: 'home' | 'activity' }) {
  const season = useSeasonal();
  const orbit = useOrbitOptional();
  if (!season.available) return null;
  if (placement === 'home' && season.answered) return null;

  const palette = orbit?.accentTheme.id ?? 'coral';
  const monster = HALLOWEEN_MONSTER[palette];
  const days = daysUntilHalloween();
  const accent = orbit?.accentTheme.primary ?? '#FF9A2E';
  const on = season.halloween;

  const turn = (next: boolean) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    void setHalloween(next);
  };

  return (
    <Animated.View entering={FadeInDown.springify()} style={styles.card}>
      <View style={styles.kitten}>
        <HalloweenKitten size={72} />
      </View>
      <View style={styles.head}>
        <Animated.View entering={ZoomIn.delay(150).springify()}>
          <Moji name={monster.moji} size={34} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{on ? 'Halloween is on' : 'Halloween is here'}</Text>
          <Text style={styles.sub}>
            {days === 0 ? 'Tonight’s the night' : days === 1 ? '1 day to go' : `${days} days to go`}
          </Text>
        </View>
      </View>
      <Text style={styles.body}>
        {on
          ? `Bats, cobwebs and a little ${monster.name} all over the app. It leaves on its own on November 1.`
          : `Try the spooky theme: bats, cobwebs and a little ${monster.name} for your color. Turn it off any time.`}
      </Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => turn(!on)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.pill, { backgroundColor: on ? 'rgba(255,255,255,0.14)' : accent, transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
          <Text style={styles.pillText}>{on ? 'Turn it off' : 'Turn it on'}</Text>
        </Pressable>
        {!on && placement === 'home' ? (
          <Pressable
            onPress={() => void dismissHalloweenCard()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.pill, styles.alt, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
            <Text style={styles.pillText}>Not now</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#3A2470',
    borderCurve: 'continuous',
    borderRadius: 22,
    gap: 10,
    overflow: 'hidden',
    padding: 16,
  },
  kitten: { bottom: -6, position: 'absolute', right: -2 },
  head: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  title: { color: '#F5EEFF', fontSize: 20, fontWeight: '700' },
  sub: { color: '#D6CBEF', fontSize: 13 },
  body: { color: '#E4DAF8', fontSize: 15, lineHeight: 20, paddingRight: 56 },
  row: { flexDirection: 'row', gap: 8 },
  pill: { borderRadius: 999, minHeight: 40, justifyContent: 'center', paddingHorizontal: 16 },
  alt: { backgroundColor: 'rgba(255,255,255,0.14)' },
  pillText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
