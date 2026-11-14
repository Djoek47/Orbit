/**
 * What a finished task looks like for the second after you tap it.
 *
 *   ┌──────────────────────────────────────────┐
 *   │ ◉→ ripple    ╱╱ light sweeps across ╱╱    │  ← ~700ms, then gone
 *   │ ░░ green bloom fades up and away ░░       │
 *   └──────────────────────────────────────────┘
 *
 * The old version faded a flat green sheet over the whole row and left it there, which
 * read as lag. This is a bloom that arrives fast and clears itself, so the row settles
 * back to its calm done state. Everything runs on the UI thread — no re-renders.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const GREEN = '#34D399';

/** Long enough to read, short enough that the row never feels stuck. */
export const BURST_MS = 720;

type Props = {
  /** Flips to true the moment the task is completed. */
  play: boolean;
  /** Row width, so the sweep knows how far to travel. */
  width: number;
  /** Matches the card's corner so nothing leaks past it. */
  radius?: number;
  /** Respect the system setting — a plain fade instead of the sweep. */
  reduceMotion?: boolean;
};

export function CompleteBurst({ play, width, radius = 16, reduceMotion }: Props) {
  const bloom = useSharedValue(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (!play) {
      bloom.set(withTiming(0, { duration: 180 }));
      return;
    }
    // In fast, out slow: arrives like a confirmation, leaves without being asked.
    bloom.set(0);
    bloom.set(
      withSequence(
        withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
        withDelay(140, withTiming(0, { duration: BURST_MS - 280, easing: Easing.in(Easing.quad) }))
      )
    );
    if (reduceMotion) return;
    sweep.set(0);
    sweep.set(withTiming(1, { duration: 620, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
  }, [play, reduceMotion, bloom, sweep]);

  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloom.value * 0.3 }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: sweep.value > 0 && sweep.value < 1 ? 1 : 0,
    transform: [{ translateX: -width * 0.6 + sweep.value * (width * 1.6) }],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: GREEN, borderRadius: radius }, bloomStyle]}
      />
      {reduceMotion ? null : (
        <Animated.View
          pointerEvents="none"
          style={[styles.sweepWrap, { borderRadius: radius }, sweepStyle]}>
          <LinearGradient
            colors={['rgba(52,211,153,0)', 'rgba(255,255,255,0.35)', 'rgba(52,211,153,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.sweep, { width: width * 0.45 }]}
          />
        </Animated.View>
      )}
    </>
  );
}

/** The ring that ripples out of the checkbox as it ticks. */
export function CompleteRipple({ play, color = GREEN }: { play: boolean; color?: string }) {
  const ring = useSharedValue(0);

  useEffect(() => {
    if (!play) return;
    ring.set(0);
    ring.set(withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }));
  }, [play, ring]);

  const style = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : (1 - ring.value) * 0.55,
    transform: [{ scale: 1 + ring.value * 1.6 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.ring, { borderColor: color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  sweepWrap: { bottom: 0, left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0 },
  sweep: { height: '100%', transform: [{ skewX: '-18deg' }] },
  ring: { borderRadius: 999, borderWidth: 2 },
});
