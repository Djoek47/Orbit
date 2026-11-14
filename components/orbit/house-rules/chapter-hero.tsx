/**
 * The top of a House Rules chapter: the chapter's colour, its Moji bobbing gently, and the
 * one figure the chapter is about (Deadlines → "7:00 PM · due").
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import type { ChapterStat } from '@/components/orbit/house-rules/chapter-theme';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export function ChapterHero({ color, moji, stat }: { color: string; moji: MojiName; stat: ChapterStat }) {
  const { c } = useOrbitColors();
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.set(withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    ));
  }, [bob]);

  const bobStyle = useAnimatedStyle(() => ({
    // A slow breath, not a bounce.
    transform: [{ translateY: -2.5 * bob.value }, { rotate: `${(bob.value - 0.5) * 3}deg` }],
  }));

  const long = stat.value.length > 7;

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)}>
      <LinearGradient
        colors={[`${color}40`, `${color}10`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { borderColor: `${color}55` }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={[styles.value, { color: c.text, fontSize: long ? 26 : 42, lineHeight: long ? 32 : 46 }]}
            numberOfLines={2}
            adjustsFontSizeToFit>
            {stat.value}
          </Text>
          <Text style={[styles.caption, { color }]}>{stat.caption}</Text>
        </View>
        <Animated.View style={[styles.mojiWrap, { backgroundColor: `${color}26` }, bobStyle]}>
          <Moji name={moji} size={44} />
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  value: { fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 14, fontWeight: '800', letterSpacing: 0.1 },
  mojiWrap: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
