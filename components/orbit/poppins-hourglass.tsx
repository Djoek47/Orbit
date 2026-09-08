import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type PoppinsHourglassProps = {
  size?: number;
  color?: string;
  /** When true, sand drains/fills and the glass flips every 3s. */
  active?: boolean;
};

/** Poppins Activity brand mark — animated sandglass. */
export function PoppinsHourglass({
  size = 18,
  color = '#2DD4BF',
  active = false,
}: PoppinsHourglassProps) {
  const flip = useSharedValue(0);
  const sand = useSharedValue(1);
  const grain = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      flip.value = withTiming(0, { duration: 200 });
      sand.value = withTiming(1, { duration: 200 });
      grain.value = 0;
      return;
    }
    flip.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1350 }),
        withTiming(180, { duration: 300, easing: Easing.inOut(Easing.cubic) }),
        withTiming(180, { duration: 1350 }),
        withTiming(360, { duration: 300, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      false
    );
    sand.value = withRepeat(
      withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    grain.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.in(Easing.quad) }),
      -1,
      false
    );
  }, [active, flip, grain, sand]);

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${flip.value % 360}deg` }],
  }));

  const topSandProps = useAnimatedProps(() => ({
    opacity: 0.15 + sand.value * 0.45,
  }));
  const bottomSandProps = useAnimatedProps(() => ({
    opacity: 0.35 + (1 - sand.value) * 0.65,
  }));
  const grainProps = useAnimatedProps(() => ({
    opacity: active ? 0.2 + grain.value * 0.8 : 0,
    cy: 10 + grain.value * 5,
  }));

  return (
    <Animated.View style={[{ width: size, height: size * 1.2 }, rotateStyle]}>
      <Svg width={size} height={size * 1.2} viewBox="0 0 20 24" fill="none">
        <Rect x="2" y="0.5" width="16" height="2" rx="1" fill={color} opacity={0.9} />
        <Rect x="2" y="21.5" width="16" height="2" rx="1" fill={color} opacity={0.9} />
        <Path
          d="M3 2.5 L7 11 L3 19.5"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d="M17 2.5 L13 11 L17 19.5"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <AnimatedPath d="M5.5 4L10 9.5L14.5 4Z" fill={color} animatedProps={topSandProps} />
        <AnimatedPath
          d="M6.5 19.5L10 15.5L13.5 19.5Z"
          fill={color}
          animatedProps={bottomSandProps}
        />
        {active ? (
          <AnimatedCircle cx="10" r="0.8" fill={color} animatedProps={grainProps} />
        ) : null}
      </Svg>
    </Animated.View>
  );
}
