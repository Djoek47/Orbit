/**
 * Halloween decorations. Every piece renders nothing unless the Halloween theme is on, so
 * they can sit permanently in layouts and buttons; turning the theme off removes them all.
 * None of them take touches.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { Moji } from '@/components/orbit/moji/moji';
import { HALLOWEEN_MONSTER, useSeasonal } from '@/lib/theme/seasonal';
import { useOrbitOptional } from '@/store/orbit-store';

export function useHalloween(): boolean {
  return useSeasonal().halloween;
}

/** Corner cobweb. `corner` picks which corner it hangs in. */
export function Cobweb({
  size = 70,
  corner = 'tl',
  opacity = 0.35,
  color = '#FFFFFF',
  style,
}: {
  size?: number;
  corner?: 'tl' | 'tr' | 'bl' | 'br';
  opacity?: number;
  color?: string;
  style?: ViewStyle;
}) {
  const rotate = { tl: '0deg', tr: '90deg', br: '180deg', bl: '270deg' }[corner];
  return (
    <View pointerEvents="none" style={[{ width: size, height: size, opacity, transform: [{ rotate }] }, style]}>
      <Svg width={size} height={size} viewBox="0 0 80 80" fill="none">
        <G stroke={color} strokeWidth={0.9}>
          <Path d="M0 0 L80 80 M0 0 L80 32 M0 0 L32 80 M0 0 L80 0 M0 0 L0 80" />
          <Path d="M22 0 Q15 15 0 22 M42 0 Q30 30 0 42 M62 0 Q44 44 0 62" />
        </G>
      </Svg>
    </View>
  );
}

/** A small spider hanging on a thread, bobbing. */
export function DanglingSpider({ thread = 22, size = 16, color = '#1A1030' }: { thread?: number; size?: number; color?: string }) {
  const y = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    y.value = withRepeat(withSequence(withTiming(6, { duration: 1500, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) })), -1);
    return () => cancelAnimation(y);
  }, [reduce, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.spider, style]}>
      <View style={{ width: 1, height: thread, backgroundColor: 'rgba(255,255,255,0.65)' }} />
      <Svg width={size} height={size} viewBox="0 0 18 16">
        <G stroke={color} strokeWidth={1.4}>
          <Path d="M3 4 L7 7 M1 9 L7 9 M3 14 L7 11 M15 4 L11 7 M17 9 L11 9 M15 14 L11 11" />
        </G>
        <Circle cx={9} cy={9} r={4.2} fill={color} />
        <Circle cx={7.6} cy={8.4} r={1} fill="#FFFFFF" />
        <Circle cx={10.4} cy={8.4} r={1} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

/** A bat that crosses the screen now and then. */
export function BatFlyby({ top = 120, every = 18000 }: { top?: number; every?: number }) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(-60);
  const flap = useSharedValue(1);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    x.value = withRepeat(
      withSequence(withTiming(-60, { duration: 0 }), withDelay(every, withTiming(width + 60, { duration: 4200, easing: Easing.inOut(Easing.quad) }))),
      -1
    );
    flap.value = withRepeat(withTiming(0.35, { duration: 160 }), -1, true);
    return () => {
      cancelAnimation(x);
      cancelAnimation(flap);
    };
  }, [every, flap, reduce, width, x]);
  const body = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: Math.sin(x.value / 40) * 8 }] }));
  const wings = useAnimatedStyle(() => ({ transform: [{ scaleY: flap.value }] }));
  if (reduce) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.bat, { top }, body]}>
      <Animated.View style={wings}>
        <Svg width={34} height={16} viewBox="0 0 40 18">
          <Path d="M20 6 C14 0 6 0 0 6 c5 0 7 3 8 6 c2-3 6-3 8 0 c1-2 2-4 4-6z M20 6 C26 0 34 0 40 6 c-5 0-7 3-8 6 c-2-3-6-3-8 0 c-1-2-2-4-4-6z" fill="#0D0820" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/** The little black kitten: blinks, swishes its tail, sometimes peeks. */
export function HalloweenKitten({ size = 64, style }: { size?: number; style?: ViewStyle }) {
  const tail = useSharedValue(0);
  const [blink, setBlink] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    tail.value = withRepeat(withSequence(withTiming(-22, { duration: 800 }), withTiming(0, { duration: 800 })), -1);
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 160);
    }, 3800);
    return () => {
      cancelAnimation(tail);
      clearInterval(id);
    };
  }, [reduce, tail]);
  const tailStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tail.value}deg` }] }));
  const h = (size * 60) / 70;
  return (
    <View pointerEvents="none" style={[{ width: size, height: h }, style]} accessibilityElementsHidden>
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: `${(46 / 70) * 100}% ${(50 / 60) * 100}%` }, tailStyle]}>
        <Svg width={size} height={h} viewBox="0 0 70 60">
          <Path d="M46 50 q18-4 16-22 q-1-6-5-5" stroke="#15101F" strokeWidth={5} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>
      <Svg width={size} height={h} viewBox="0 0 70 60">
        <Ellipse cx={34} cy={48} rx={15} ry={11} fill="#15101F" />
        <Path d="M18 22 L20 8 L28 17 Z M44 22 L42 8 L34 17 Z" fill="#15101F" />
        <Path d="M21 18 l1-6 4 4z M41 18 l-1-6 -4 4z" fill="#FF8FB4" opacity={0.6} />
        <Circle cx={31} cy={28} r={14} fill="#15101F" />
        {blink ? (
          <>
            <Rect x={21} y={27.4} width={8} height={1.4} rx={0.7} fill="#FFD84D" />
            <Rect x={33} y={27.4} width={8} height={1.4} rx={0.7} fill="#FFD84D" />
          </>
        ) : (
          <>
            <Ellipse cx={25} cy={28} rx={4.4} ry={5} fill="#FFD84D" />
            <Ellipse cx={37} cy={28} rx={4.4} ry={5} fill="#FFD84D" />
            <Ellipse cx={25.6} cy={28.5} rx={1.5} ry={3.6} fill="#15101F" />
            <Ellipse cx={37.6} cy={28.5} rx={1.5} ry={3.6} fill="#15101F" />
          </>
        )}
        <Path d="M29.5 34 l1.5 1.4 1.5-1.4" stroke="#FF8FB4" strokeWidth={1.3} fill="none" />
      </Svg>
    </View>
  );
}

/** This color's monster, floating gently. */
export function SeasonMonster({ size = 56, style }: { size?: number; style?: ViewStyle }) {
  const orbit = useOrbitOptional();
  const monster = HALLOWEEN_MONSTER[orbit?.accentTheme.id ?? 'coral'];
  const y = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    y.value = withRepeat(withSequence(withTiming(-6, { duration: 1700, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.sin) })), -1);
    return () => cancelAnimation(y);
  }, [reduce, y]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { rotate: `${y.value * 0.6}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[float, style]} accessibilityLabel={`Halloween ${monster.name}`}>
      <Moji name={monster.moji} size={size} />
    </Animated.View>
  );
}

/**
 * Screen-level dressing for the main tabs: a web in the top corner, a spider dangling from
 * it, and a bat that flies across now and then.
 */
export function HalloweenScreenDecor({ topInset = 0 }: { topInset?: number }) {
  if (!useHalloween()) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Cobweb corner="tr" size={86} style={{ position: 'absolute', right: 0, top: topInset }} />
      <View style={{ position: 'absolute', right: 30, top: topInset + 18 }}>
        <DanglingSpider thread={30} />
      </View>
      <BatFlyby top={topInset + 90} />
    </View>
  );
}

/** Tiny web + spider for a primary button's corner. */
export function ButtonSpookies() {
  if (!useHalloween()) return null;
  return (
    <>
      <Cobweb corner="tl" size={26} opacity={0.45} style={{ position: 'absolute', left: 0, top: 0 }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: 16, top: -18 }}>
        <DanglingSpider thread={12} size={12} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  spider: { alignItems: 'center' },
  bat: { left: 0, position: 'absolute' },
});
