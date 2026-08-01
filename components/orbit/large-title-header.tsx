import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

/** Distance (px) the large title collapses over — matches iOS nav-bar feel. */
export const LARGE_TITLE_COLLAPSE_DISTANCE = 80;

/**
 * Scroll-driven large-title collapse — see
 * docs/design-system/03-motion-interaction.md §7 and §10.
 *
 * Usage: create a `scrollY = useSharedValue(0)` in the screen, drive it from
 * the ScrollView's `onScroll` (via `useAnimatedScrollHandler`), and render this
 * above the scroll content. The title shrinks from `largeTitle` (34) to
 * `headline` (17) and slides up as the user scrolls past
 * `LARGE_TITLE_COLLAPSE_DISTANCE`.
 */
export function LargeTitleHeader({ title, scrollY }: { title: string; scrollY: SharedValue<number> }) {
  const { c } = useOrbitColors();

  const animatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(scrollY.value, [0, LARGE_TITLE_COLLAPSE_DISTANCE], [0, 1], 'clamp');
    const fontSize = interpolate(progress, [0, 1], [34, 20]);
    const translateY = interpolate(progress, [0, 1], [0, -4]);
    return {
      fontSize,
      transform: [{ translateY }],
    };
  });

  return (
    <View style={styles.root}>
      <Animated.Text
        style={[typography.largeTitle, styles.title, { color: c.text }, animatedStyle]}
        numberOfLines={1}>
        {title}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: 4,
  },
  title: {
    fontWeight: '700',
  },
});
