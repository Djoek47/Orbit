import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { orbitColors, radius } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const HOLD_MS = 900;

type RewardClaimPressProps = {
  accent?: string;
  mode?: 'instant' | 'request';
  disabled?: boolean;
  busy?: boolean;
  onClaim: () => void | Promise<void>;
};

/**
 * Compact hold-to-claim control.
 * Progress lives on a thin bottom bar — the button does not liquid-fill or exit-animate.
 * The parent reward card handles disappear-after-redeem.
 */
export function RewardClaimPress({
  accent = orbitColors.planPurple,
  mode = 'instant',
  disabled,
  busy,
  onClaim,
}: RewardClaimPressProps) {
  const { c } = useOrbitColors();
  const [holding, setHolding] = useState(false);
  const firedRef = useRef(false);
  const holdingRef = useRef(false);
  const progress = useSharedValue(0);
  const trackW = useSharedValue(72);

  const label = mode === 'instant' ? 'Hold' : 'Request';

  const resetVisual = () => {
    cancelAnimation(progress);
    progress.value = 0;
    setHolding(false);
    holdingRef.current = false;
    firedRef.current = false;
  };

  const clearHold = () => {
    if (firedRef.current) return;
    holdingRef.current = false;
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
    setHolding(false);
  };

  const fire = () => {
    if (firedRef.current || disabled || busy) return;
    if (!holdingRef.current) return;
    firedRef.current = true;
    progress.value = 1;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void Promise.resolve(onClaim()).finally(() => {
      resetVisual();
    });
  };

  const startHold = () => {
    if (disabled || busy) return;
    firedRef.current = false;
    holdingRef.current = true;
    setHolding(true);
    progress.value = 0;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(fire)();
    });
  };

  const onTrackLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    if (w > 0) trackW.value = w;
  };

  useEffect(() => () => resetVisual(), []);

  const barStyle = useAnimatedStyle(() => ({
    width: Math.max(0, progress.value * trackW.value),
  }));

  return (
    <Pressable
      disabled={disabled || busy}
      onPressIn={startHold}
      onPressOut={clearHold}
      style={[
        styles.control,
        {
          borderColor: `${accent}${disabled ? '33' : holding ? 'AA' : '55'}`,
          backgroundColor: `${accent}${disabled ? '10' : '14'}`,
        },
        (disabled || busy) && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={mode === 'instant' ? 'Hold to claim reward' : 'Hold to request reward'}
      accessibilityHint="Hold until the progress bar fills"
      accessibilityState={{ disabled: Boolean(disabled || busy) }}>
      <View style={styles.track} pointerEvents="none" onLayout={onTrackLayout}>
        <Animated.View style={[styles.bar, { backgroundColor: accent }, barStyle]} />
      </View>
      <View style={styles.content}>
        {busy ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Text style={[styles.label, { color: disabled ? c.textSubtle : accent }]}>
            {holding ? 'Hold…' : label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: 999,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 1,
  },
  control: {
    borderRadius: radius.control,
    borderWidth: 1,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  track: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: 0,
    height: 3,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
  },
});
