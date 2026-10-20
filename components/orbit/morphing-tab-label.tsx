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

import { fontFamilyForWeight } from '@/constants/typography';

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
  energetic,
  generation,
  slotMin,
}: {
  from: string;
  to: string;
  index: number;
  color: string;
  fontWeight: MorphingTabLabelProps['fontWeight'];
  energetic: boolean;
  generation: number;
  /** Narrower slots for long words during morph only. */
  slotMin: number;
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
    fontFamily: fontFamilyForWeight(fontWeight ?? '400'),
    // Per-glyph letterSpacing stacks with slot padding and makes "ll"/"lo" look gappy.
    letterSpacing: 0,
  } as const;

  const empty = !from && !to;
  const widthStyle = useAnimatedStyle(() => {
    // Collapse padded / trailing empties so shorter labels (Ranks) stay centered.
    if (empty) return { width: 0, minWidth: 0, opacity: 0 };
    if (!to && from) {
      return {
        width: interpolate(progress.value, [0, 0.55, 1], [slotMin, slotMin / 2, 0], 'clamp'),
        minWidth: 0,
        overflow: 'hidden' as const,
      };
    }
    if (!from && to) {
      return {
        width: interpolate(progress.value, [0, 0.45, 1], [0, slotMin * 0.65, slotMin], 'clamp'),
        minWidth: 0,
      };
    }
    // During morph only — natural width + tiny pad (never a fixed minWidth for "l").
    return { minWidth: 0, paddingHorizontal: slotMin >= 5 ? 0.35 : 0.15 };
  });

  return (
    <Animated.View style={[styles.glyph, widthStyle]}>
      <Animated.Text style={[styles.absolute, textStyle, outgoingStyle]}>{from || ' '}</Animated.Text>
      <Animated.Text style={[styles.absolute, textStyle, midStyle]}>{midGlyph}</Animated.Text>
      <Animated.Text style={[textStyle, incomingStyle]}>{to || ' '}</Animated.Text>
    </Animated.View>
  );
}

function SettledLabel({
  text,
  color,
  fontWeight,
  letterSpacing,
}: {
  text: string;
  color: string;
  fontWeight: MorphingTabLabelProps['fontWeight'];
  letterSpacing: number;
}) {
  return (
    <View style={styles.row} accessibilityLabel={text}>
      <Animated.Text
        style={{
          color,
          fontSize: 10,
          fontFamily: fontFamilyForWeight(fontWeight ?? '400'),
          // Long tab words: never add positive tracking (Coral +0.15 widened "ll"/"lo").
          letterSpacing: text.length >= 8 ? Math.min(letterSpacing, 0) : letterSpacing,
          fontWeight,
        }}>
        {text}
      </Animated.Text>
    </View>
  );
}

/**
 * Magical letter-morph for Rewards ↔ Ranks ↔ Redeem tab labels.
 * Glyphs transform (scramble mid-flight) instead of a hard cut.
 * Long labels (Allowance) settle as one Text node so font kerning stays natural.
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

  // After the morph finishes, sync from→to so long labels can use natural kerning.
  useEffect(() => {
    if (from === to) return;
    const settleMs = (energetic ? MORPH_MS : MORPH_MS * 0.85) + STAGGER_MS * Math.max(from.length, to.length) + 60;
    const id = setTimeout(() => {
      setFrom(to);
    }, settleMs);
    return () => clearTimeout(id);
  }, [energetic, from, generation, to]);

  const len = Math.max(from.length, to.length, 1);
  // A tab is about 70pt wide. Long words need tight morph slots or "ll"/"lo" look spaced.
  const slotMin = len >= 10 ? 3.1 : len >= 9 ? 3.4 : len >= 7 ? 4.8 : 6.2;

  const slots = useMemo(() => {
    // Center-pad the shorter word so morph slots stay balanced under the icon.
    const fromPad = Math.floor((len - from.length) / 2);
    const toPad = Math.floor((len - to.length) / 2);
    return Array.from({ length: len }, (_, i) => ({
      from: from[i - fromPad] ?? '',
      to: to[i - toPad] ?? '',
      key: `${generation}-${i}`,
    }));
  }, [from, generation, len, to]);

  // Settled long label → one Text node (fixes Allowance "ll"/"lo" slot gaps).
  if (from === to && to.length >= 8) {
    return (
      <SettledLabel text={to} color={color} fontWeight={fontWeight} letterSpacing={letterSpacing} />
    );
  }

  return (
    <View style={[styles.row, len >= 8 && styles.rowTight]} accessibilityLabel={to}>
      {slots.map((slot, index) => (
        <MorphGlyph
          key={slot.key}
          from={slot.from}
          to={slot.to}
          index={index}
          color={color}
          fontWeight={fontWeight}
          energetic={energetic}
          generation={generation}
          slotMin={slotMin}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    height: 13,
    justifyContent: 'center',
    overflow: 'visible',
    width: '100%',
  },
  rowTight: {
    columnGap: 0,
  },
  glyph: {
    alignItems: 'center',
    height: 13,
    justifyContent: 'center',
    overflow: 'visible',
  },
  absolute: {
    position: 'absolute',
  },
});
