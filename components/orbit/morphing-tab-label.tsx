import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const SCRAMBLE = 'RanksRedeemWards★✦·';
const MORPH_MS = 720;
const STAGGER_MS = 38;

type MorphingTabLabelProps = {
  text: string;
  color: string;
  fontWeight?: '400' | '500' | '600' | '700' | '800';
  letterSpacing?: number;
  /** Stronger scramble / bounce when redeem XP is available. */
  energetic?: boolean;
};

function scrambleChar(seed: number) {
  return SCRAMBLE[Math.abs(seed) % SCRAMBLE.length] ?? '·';
}

function MorphGlyph({
  from,
  to,
  index,
  color,
  fontWeight,
  letterSpacing,
  energetic,
  generation,
}: {
  from: string;
  to: string;
  index: number;
  color: string;
  fontWeight: MorphingTabLabelProps['fontWeight'];
  letterSpacing: number;
  energetic: boolean;
  generation: number;
}) {
  const progress = useSharedValue(1);
  const midGlyph = useMemo(() => scrambleChar(index * 17 + to.charCodeAt(0) + generation), [
    generation,
    index,
    to,
  ]);

  useEffect(() => {
    if (from === to) {
      // Matching glyph — soft magical pulse
      progress.value = 0;
      progress.value = withDelay(
        index * (STAGGER_MS * 0.6),
        withSequence(
          withTiming(0.5, { duration: 180, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 280, easing: Easing.inOut(Easing.ease) })
        )
      );
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      index * STAGGER_MS,
      withTiming(1, {
        duration: energetic ? MORPH_MS : MORPH_MS * 0.85,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      })
    );
  }, [energetic, from, index, progress, to, generation]);

  const outgoingStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: from === to ? 0 : interpolate(p, [0, 0.45, 0.55], [1, 0.15, 0], 'clamp'),
      transform: [
        { translateY: interpolate(p, [0, 0.55], [0, energetic ? -5 : -3], 'clamp') },
        { scale: interpolate(p, [0, 0.55], [1, 0.8], 'clamp') },
        { rotateZ: `${interpolate(p, [0, 0.55], [0, energetic ? -8 : -4], 'clamp')}deg` },
      ],
    };
  });

  const midStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (from === to) return { opacity: 0 };
    return {
      opacity: interpolate(p, [0.25, 0.45, 0.65], [0, 1, 0], 'clamp'),
      transform: [
        { scale: interpolate(p, [0.25, 0.45, 0.65], [0.7, 1.15, 0.8], 'clamp') },
        { rotateZ: `${interpolate(p, [0.25, 0.65], [-8, 8], 'clamp')}deg` },
      ],
    };
  });

  const incomingStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (from === to) {
      return {
        opacity: 1,
        transform: [
          { scale: interpolate(p, [0, 0.5, 1], [1, energetic ? 1.18 : 1.08, 1], 'clamp') },
        ],
      };
    }
    return {
      opacity: interpolate(p, [0.45, 0.7, 1], [0, 0.85, 1], 'clamp'),
      transform: [
        { translateY: interpolate(p, [0.45, 1], [energetic ? 5 : 3, 0], 'clamp') },
        { scale: interpolate(p, [0.45, 0.8, 1], [0.75, energetic ? 1.1 : 1.04, 1], 'clamp') },
        { rotateZ: `${interpolate(p, [0.45, 1], [energetic ? 7 : 4, 0], 'clamp')}deg` },
      ],
    };
  });

  const textStyle = {
    color,
    fontSize: 10,
    fontWeight: fontWeight ?? '400',
    letterSpacing,
  } as const;

  return (
    <View style={styles.glyph}>
      <Animated.Text style={[styles.absolute, textStyle, outgoingStyle]}>{from || ' '}</Animated.Text>
      <Animated.Text style={[styles.absolute, textStyle, midStyle]}>{midGlyph}</Animated.Text>
      <Animated.Text style={[textStyle, incomingStyle]}>{to || ' '}</Animated.Text>
    </View>
  );
}

/**
 * Magical letter-morph for Rewards ↔ Ranks ↔ Redeem tab labels.
 * Glyphs transform (scramble mid-flight) instead of a hard cut.
 */
export function MorphingTabLabel({
  text,
  color,
  fontWeight = '400',
  letterSpacing = 0,
  energetic = false,
}: MorphingTabLabelProps) {
  const [from, setFrom] = useState(text);
  const [to, setTo] = useState(text);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (text === to) return;
    setFrom(to);
    setTo(text);
    setGeneration((g) => g + 1);
  }, [text, to]);

  const slots = useMemo(() => {
    const len = Math.max(from.length, to.length, 1);
    return Array.from({ length: len }, (_, i) => ({
      from: from[i] ?? '',
      to: to[i] ?? '',
      key: `${generation}-${i}`,
    }));
  }, [from, generation, to]);

  return (
    <View style={styles.row} accessibilityLabel={to}>
      {slots.map((slot, index) => (
        <MorphGlyph
          key={slot.key}
          from={slot.from}
          to={slot.to}
          index={index}
          color={color}
          fontWeight={fontWeight}
          letterSpacing={letterSpacing}
          energetic={energetic}
          generation={generation}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 13,
    justifyContent: 'center',
    overflow: 'visible',
  },
  glyph: {
    alignItems: 'center',
    height: 13,
    justifyContent: 'center',
    minWidth: 6.2,
    overflow: 'visible',
  },
  absolute: {
    position: 'absolute',
  },
});
