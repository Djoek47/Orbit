/**
 * The paywall's life: stars that twinkle and drift, and the house mark floating in a halo.
 * Shared by every gate — the admin paywall and the paused screen on children's devices.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ChoremaxxIcon, ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { Moji } from '@/components/orbit/moji/moji';
import { useOrbit } from '@/store/orbit-store';

/** Four small stars that twinkle and drift — life without illustrations. */
export function Sparkles({ color }: { color: string }) {
  const spots = [
    { top: '14%', left: '12%', size: 14, delay: 0 },
    { top: '22%', left: '82%', size: 10, delay: 700 },
    { top: '34%', left: '20%', size: 9, delay: 1300 },
    { top: '30%', left: '70%', size: 16, delay: 400 },
  ] as const;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {spots.map((spot, i) => (
        <Star key={i} {...spot} color={color} />
      ))}
    </View>
  );
}

function Star({
  top,
  left,
  size,
  delay,
  color,
}: {
  top: `${number}%`;
  left: `${number}%`;
  size: number;
  delay: number;
  color: string;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + t.value * 0.65,
    transform: [{ translateY: -6 * t.value }, { scale: 0.8 + t.value * 0.35 }],
  }));
  return (
    <Animated.Text style={[{ position: 'absolute', top, left, fontSize: size, color }, style]}>✦</Animated.Text>
  );
}

/** The house mark, floating gently in a soft halo. */
export function FloatingMark() {
  const { accentTheme } = useOrbit();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: -10 * t.value }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + 0.3 * t.value, transform: [{ scale: 0.95 + 0.1 * t.value }] }));
  return (
    <View style={styles.markWrap}>
      <Animated.View style={[styles.halo, { backgroundColor: `${accentTheme.primary}33` }, halo]} />
      <Animated.View style={float}>
        <ChoremaxxLogo size="lg" variant="icon" />
      </Animated.View>
    </View>
  );
}


const baseStyles = {
  markWrap: { alignItems: 'center' as const, height: 150, justifyContent: 'center' as const },
  halo: { borderRadius: 80, height: 150, position: 'absolute' as const, width: 150 },
};

// ── Lighter paywall pieces (build 126) ─────────────────────────────────────────────────

/**
 * The page's moving background. Classic: soft blobs of the household colour drifting slowly.
 * Halloween: a night sky with a glowing moon, twinkling stars and a cobweb.
 */
export function LivingBackground({ color, secondary, halloween }: { color: string; secondary: string; halloween: boolean }) {
  const reduce = useReducedMotion();
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    a.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.sin) }), -1, true);
    b.value = withDelay(2500, withRepeat(withTiming(1, { duration: 17000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [a, b, reduce]);
  const blobA = useAnimatedStyle(() => ({ transform: [{ translateX: 50 * a.value }, { translateY: 70 * a.value }, { scale: 1 + 0.25 * a.value }] }));
  const blobB = useAnimatedStyle(() => ({ transform: [{ translateX: -60 * b.value }, { translateY: -40 * b.value }, { scale: 1 + 0.2 * b.value }] }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.55 + 0.35 * a.value }));

  if (halloween) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient colors={['#3B2470', '#1C1238', '#120B24']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <Sparkles color="#FFFFFF" />
        <Animated.View style={[styles.moonGlow, glow]} />
        <View style={styles.moon}>
          <View style={styles.moonBite} />
        </View>
        <Animated.View style={[styles.blob, { backgroundColor: color, top: '62%', left: -90, opacity: 0.14 }, blobA]} />
      </View>
    );
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.blob, { backgroundColor: color, top: -80, left: -90 }, blobA]} />
      <Animated.View style={[styles.blob, { backgroundColor: secondary, top: '42%', right: -110, width: 240, height: 240 }, blobB]} />
      <Animated.View style={[styles.blob, { backgroundColor: color, bottom: -90, left: 10, width: 180, height: 180, opacity: 0.12 }, blobA]} />
    </View>
  );
}

/** The app icon tile — house mark on a rounded square — breathing, and popping on demand. */
export function BrandTile({ size = 104, pop = 0 }: { size?: number; pop?: number }) {
  const { accentTheme } = useOrbit();
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  const p = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, t]);
  useEffect(() => {
    if (!pop) return;
    p.value = withSequence(withTiming(0.86, { duration: 120 }), withSpring(1, { damping: 5, stiffness: 220 }));
  }, [p, pop]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -5 * t.value }, { scale: p.value * (1 + 0.03 * t.value) }, { rotate: `${(1 - p.value) * -40}deg` }],
  }));
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.24,
          borderCurve: 'continuous',
          backgroundColor: accentTheme.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: accentTheme.primary,
          shadowOpacity: 0.45,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
        },
        style,
      ]}>
      <ChoremaxxIcon width={size * 0.66} height={size * 0.6} colors={{ roof: '#FFF5EE', body: '#FEDCC8', sparkle: '#FAC775', chore: '#fff', maxx: '#fff', wash: '#fff' }} />
    </Animated.View>
  );
}

/** A one-shot burst of little shapes from a point — sparkles, or bats and candy on Halloween. */
export function Burst({ trigger, halloween, color }: { trigger: number; halloween: boolean; color: string }) {
  if (!trigger) return null;
  return (
    <View pointerEvents="none" style={styles.burst} key={trigger}>
      {Array.from({ length: 12 }, (_, i) => (
        <BurstBit key={i} index={i} halloween={halloween} color={color} />
      ))}
    </View>
  );
}

const BURST_MOJI = ['bat', 'candyCorn', 'pumpkin', 'ghost'] as const;

function BurstBit({ index, halloween, color }: { index: number; halloween: boolean; color: string }) {
  const k = useSharedValue(0);
  const angle = (index / 12) * Math.PI * 2 + (index % 2) * 0.3;
  const dist = 70 + (index % 3) * 30;
  useEffect(() => {
    k.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [k]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - k.value,
    transform: [
      { translateX: Math.cos(angle) * dist * k.value },
      { translateY: Math.sin(angle) * dist * k.value - 40 * k.value },
      { scale: 0.5 + 0.7 * k.value },
      { rotate: `${k.value * (index % 2 ? 160 : -160)}deg` },
    ],
  }));
  return (
    <Animated.View style={[styles.bit, style]}>
      {halloween ? (
        <Moji name={BURST_MOJI[index % BURST_MOJI.length]!} size={20} />
      ) : (
        <Animated.Text style={{ color: index % 3 ? color : '#FAC775', fontSize: 18 }}>✦</Animated.Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ...baseStyles,
  blob: { borderRadius: 999, height: 280, opacity: 0.3, position: 'absolute', width: 280 },
  moon: { backgroundColor: '#FFE7A8', borderRadius: 30, height: 56, overflow: 'hidden', position: 'absolute', right: 34, top: 96, width: 56 },
  moonBite: { backgroundColor: '#2E1C58', borderRadius: 30, height: 56, left: 14, position: 'absolute', top: -8, width: 56 },
  moonGlow: { backgroundColor: '#FFE7A8', borderRadius: 60, height: 120, opacity: 0.25, position: 'absolute', right: 2, top: 64, width: 120 },
  burst: { alignItems: 'center', height: 0, justifyContent: 'center', left: '50%', position: 'absolute', top: 0, width: 0 },
  bit: { position: 'absolute' },
});

/**
 * Status and error messages on the payment pages: a soft card with a little Moji, not red
 * text. Errors give a small shake so the eye finds them; success pops in.
 */
export function PaywallMessage({
  tone,
  message,
  dark,
}: {
  tone: 'error' | 'success' | 'info';
  message: string;
  dark: boolean;
}) {
  const x = useSharedValue(0);
  useEffect(() => {
    if (tone !== 'error') return;
    x.value = withSequence(
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(-5, { duration: 60 }),
      withTiming(5, { duration: 60 }),
      withSpring(0)
    );
  }, [message, tone, x]);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const palette = {
    error: { bg: dark ? 'rgba(248,113,113,0.14)' : '#FDECEC', edge: 'rgba(229,72,77,0.35)', text: dark ? '#FFD4D4' : '#9B2C2C', moji: 'bandage' as const, title: 'That didn’t go through' },
    success: { bg: dark ? 'rgba(52,211,153,0.14)' : '#E8F8F0', edge: 'rgba(52,211,153,0.4)', text: dark ? '#C9F5E2' : '#1F6B4A', moji: 'check' as const, title: 'All set' },
    info: { bg: dark ? 'rgba(255,255,255,0.08)' : '#F4F1EE', edge: 'rgba(127,119,221,0.3)', text: dark ? '#E9E2FA' : '#4A3F38', moji: 'bell' as const, title: '' },
  }[tone];
  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        {
          alignItems: 'center',
          backgroundColor: palette.bg,
          borderColor: palette.edge,
          borderCurve: 'continuous',
          borderRadius: 16,
          borderWidth: 1,
          flexDirection: 'row',
          gap: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
        },
        shake,
      ]}>
      <Moji name={palette.moji} size={24} />
      <View style={{ flex: 1, gap: 1 }}>
        {palette.title ? (
          <Animated.Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>{palette.title}</Animated.Text>
        ) : null}
        <Animated.Text style={{ color: palette.text, fontSize: 13, lineHeight: 18 }}>{message}</Animated.Text>
      </View>
    </Animated.View>
  );
}
