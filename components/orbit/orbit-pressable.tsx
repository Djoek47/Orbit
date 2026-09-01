import { useCallback, useRef } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { orbitControl } from '@/constants/orbit-theme';
import { type OrbitHaptic, triggerOrbitHaptic } from '@/lib/ui/orbit-press-haptic';

type OrbitPressableProps = Omit<PressableProps, 'onPress'> & {
  onPress?: () => void;
  haptic?: OrbitHaptic;
  loading?: boolean;
  minTouchSize?: number;
  style?: StyleProp<ViewStyle>;
};

const DEFAULT_HIT_SLOP = 8;

/**
 * Pressable with pressed opacity, optional haptic, and double-tap guard for async actions.
 */
export function OrbitPressable({
  children,
  disabled,
  haptic = 'light',
  loading = false,
  minTouchSize = orbitControl.minTouchTarget,
  onPress,
  hitSlop = DEFAULT_HIT_SLOP,
  style,
  accessibilityRole = 'button',
  ...rest
}: OrbitPressableProps) {
  const lockedRef = useRef(false);
  const inactive = Boolean(disabled || loading);

  const handlePress = useCallback(() => {
    if (inactive || lockedRef.current || !onPress) return;
    lockedRef.current = true;
    triggerOrbitHaptic(haptic);
    try {
      onPress();
    } finally {
      requestAnimationFrame(() => {
        lockedRef.current = false;
      });
    }
  }, [haptic, inactive, onPress]);

  return (
    <Pressable
      {...rest}
      accessibilityRole={accessibilityRole}
      disabled={inactive}
      hitSlop={hitSlop}
      onPress={handlePress}
      style={({ pressed }) => [
        { minHeight: minTouchSize, minWidth: minTouchSize },
        typeof style === 'function' ? style({ pressed }) : style,
        pressed && !inactive && { opacity: 0.82 },
        inactive && { opacity: 0.5 },
      ]}>
      {children}
    </Pressable>
  );
}
