import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { orbitColors, orbitRadius } from '@/constants/orbit-theme';

const HOLD_MS = 900;
const EXIT_MS = 420;

type RewardClaimPressProps = {
  accent?: string;
  mode?: 'instant' | 'request';
  disabled?: boolean;
  busy?: boolean;
  onClaim: () => void | Promise<void>;
};

/**
 * Hold-to-claim — theme liquid glass fills the whole button, then a cool exit.
 * Instant = spend XP now · request = queue parent approval.
 */
export function RewardClaimPress({
  accent = orbitColors.planPurple,
  mode = 'instant',
  disabled,
  busy,
  onClaim,
}: RewardClaimPressProps) {
  const [holding, setHolding] = useState(false);
  const [exiting, setExiting] = useState(false);
  const firedRef = useRef(false);
  const holdingRef = useRef(false);

  const fill = useSharedValue(0);
  const glow = useSharedValue(0);
  const shellOpacity = useSharedValue(1);
  const shellScale = useSharedValue(1);
  const burst = useSharedValue(0);
  const buttonH = useSharedValue(56);

  const label = mode === 'instant' ? 'Hold' : 'Request';
  const accentDeep = shadeHex(accent, -32);
  const accentHot = shadeHex(accent, 22);

  const onLayout = (event: LayoutChangeEvent) => {
    const h = event.nativeEvent.layout.height;
    if (h > 0) buttonH.value = h;
  };

  const resetVisual = () => {
    cancelAnimation(fill);
    cancelAnimation(glow);
    cancelAnimation(shellOpacity);
    cancelAnimation(shellScale);
    cancelAnimation(burst);
    fill.value = 0;
    glow.value = 0;
    shellOpacity.value = 1;
    shellScale.value = 1;
    burst.value = 0;
    setHolding(false);
    setExiting(false);
    holdingRef.current = false;
    firedRef.current = false;
  };

  const clearHold = () => {
    if (firedRef.current || exiting) return;
    holdingRef.current = false;
    cancelAnimation(fill);
    cancelAnimation(glow);
    fill.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
    glow.value = withTiming(0, { duration: 200 });
    setHolding(false);
  };

  const afterExit = () => {
    void Promise.resolve(onClaim()).finally(() => {
      resetVisual();
    });
  };

  const playExit = () => {
    setExiting(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    burst.value = withSequence(
      withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) })
    );
    shellScale.value = withSequence(
      withTiming(1.08, { duration: 110, easing: Easing.out(Easing.cubic) }),
      withTiming(0.68, { duration: EXIT_MS - 110, easing: Easing.in(Easing.cubic) })
    );
    shellOpacity.value = withDelay(
      70,
      withTiming(0, { duration: EXIT_MS - 70, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(afterExit)();
      })
    );
  };

  const fire = () => {
    if (firedRef.current || disabled || busy) return;
    if (!holdingRef.current) return;
    firedRef.current = true;
    fill.value = 1;
    glow.value = 1;
    playExit();
  };

  const startHold = () => {
    if (disabled || busy || exiting) return;
    firedRef.current = false;
    holdingRef.current = true;
    setHolding(true);
    setExiting(false);
    shellOpacity.value = 1;
    shellScale.value = 1;
    burst.value = 0;
    fill.value = 0;
    glow.value = 0;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    fill.value = withTiming(1, { duration: HOLD_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(fire)();
    });
    glow.value = withTiming(1, { duration: HOLD_MS, easing: Easing.out(Easing.quad) });
  };

  useEffect(() => () => resetVisual(), []);

  // Bottom-up liquid fill using measured height
  const fillStyle = useAnimatedStyle(() => ({
    height: Math.max(0, fill.value * buttonH.value),
    opacity: 0.55 + fill.value * 0.45,
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + glow.value * 0.55,
    transform: [{ translateX: -12 + fill.value * 28 }],
  }));

  const shellStyle = useAnimatedStyle(() => ({
    opacity: shellOpacity.value,
    transform: [{ scale: shellScale.value }],
  }));

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value * 0.95,
    transform: [{ scale: 0.8 + burst.value * 0.45 }],
  }));

  const labelColor =
    holding || exiting ? '#F8FAFF' : disabled ? orbitColors.textSubtle : accent;

  return (
    <Animated.View style={[styles.shell, shellStyle]}>
      <Pressable
        disabled={disabled || busy || exiting}
        onPressIn={startHold}
        onPressOut={clearHold}
        onLayout={onLayout}
        style={[
          styles.control,
          {
            borderColor: `${accent}${disabled ? '33' : holding || exiting ? 'CC' : '66'}`,
            backgroundColor: `${accent}${disabled ? '10' : '16'}`,
          },
          (disabled || busy) && styles.disabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={mode === 'instant' ? 'Hold to claim reward' : 'Hold to request reward'}
        accessibilityHint="Hold until the button fills with color"
        accessibilityState={{ disabled: Boolean(disabled || busy || exiting) }}>
        <Animated.View pointerEvents="none" style={[styles.fillWrap, fillStyle]}>
          <LinearGradient
            colors={[`${accentDeep}FF`, `${accent}F2`, `${accentHot}D9`]}
            locations={[0, 0.45, 1]}
            start={{ x: 0.1, y: 1 }}
            end={{ x: 0.9, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Frosted glass highlight on the rising surface */}
          <LinearGradient
            colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.12)', 'transparent']}
            locations={[0, 0.35, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.glassCap}
          />
          <Animated.View style={[styles.sheen, sheenStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.burst, burstStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', `${accentHot}BB`, `${accent}FF`]}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={styles.content}>
          {busy ? (
            <ActivityIndicator size="small" color={holding || exiting ? '#F8FAFF' : accent} />
          ) : (
            <Text style={[styles.label, { color: labelColor }]}>
              {exiting ? (mode === 'instant' ? 'Claimed' : 'Sent') : holding ? 'Hold…' : label}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function shadeHex(hex: string, amount: number): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;
  const num = Number.parseInt(raw, 16);
  if (Number.isNaN(num)) return hex;
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((num >> 16) & 255) + amount);
  const g = clamp(((num >> 8) & 255) + amount);
  const b = clamp((num & 255) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const styles = StyleSheet.create({
  burst: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: orbitRadius.lg,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 2,
  },
  control: {
    borderRadius: orbitRadius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
  fillWrap: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
  },
  glassCap: {
    height: 22,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  sheen: {
    height: 16,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 4,
  },
  shell: {
    borderRadius: orbitRadius.lg,
  },
});
