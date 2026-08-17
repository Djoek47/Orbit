import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { typography } from '@/constants/orbit-theme';
import { FontFamily } from '@/constants/typography';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

/** Distance (px) the large title collapses over — matches iOS nav-bar feel. */
export const LARGE_TITLE_COLLAPSE_DISTANCE = 80;

type LargeTitleHeaderProps = {
  title: string;
  scrollY: SharedValue<number>;
  /** `compact` starts ~24pt (Home greeting); `default` is 34pt large title. */
  size?: 'default' | 'compact';
};

/**
 * Scroll-driven large-title collapse — see
 * docs/design-system/03-motion-interaction.md §7 and §10.
 */
export function LargeTitleHeader({
  title,
  scrollY,
  size = 'default',
}: LargeTitleHeaderProps) {
  const { c } = useOrbitColors();
  const fromSize = size === 'compact' ? 24 : 34;
  const toSize = size === 'compact' ? 18 : 20;

  const animatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(scrollY.value, [0, LARGE_TITLE_COLLAPSE_DISTANCE], [0, 1], 'clamp');
    const fontSize = interpolate(progress, [0, 1], [fromSize, toSize]);
    const translateY = interpolate(progress, [0, 1], [0, -4]);
    return {
      fontSize,
      transform: [{ translateY }],
    };
  });

  return (
    <View style={styles.root}>
      <Animated.Text
        style={[typography.largeTitle, styles.title, { color: c.text, lineHeight: fromSize + 4 }, animatedStyle]}
        numberOfLines={2}>
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
    fontFamily: FontFamily.bold,
  },
});
