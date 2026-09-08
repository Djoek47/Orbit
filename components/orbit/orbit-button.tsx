import { PropsWithChildren, useCallback, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { orbitColors, orbitControl, radius, space, typography } from '@/constants/orbit-theme';
import { type OrbitHaptic, triggerOrbitHaptic } from '@/lib/ui/orbit-press-haptic';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

type OrbitButtonProps = PropsWithChildren<{
  disabled?: boolean;
  loading?: boolean;
  haptic?: OrbitHaptic;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
}>;

const HIT_SLOP = 6;

/** Make CTA: gradient primary with ink label; secondary glass. Uses accent theme when available. */
export function OrbitButton({
  children,
  disabled = false,
  loading = false,
  haptic = 'light',
  onPress,
  tone = 'primary',
  style,
}: OrbitButtonProps) {
  const orbit = useOrbitOptional();
  const { c } = useOrbitColors();
  const primary = orbit?.accentTheme.primary ?? '#38BDF8';
  const secondary = orbit?.accentTheme.secondary ?? '#0EA5E9';
  const lockedRef = useRef(false);
  const inactive = disabled || loading;

  const handlePress = useCallback(() => {
    if (inactive || lockedRef.current) return;
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

  const label =
    loading && typeof children === 'string' ? (
      <ActivityIndicator color={tone === 'primary' ? orbitColors.ink : c.text} />
    ) : (
      <Text
        style={[
          typography.buttonLabel,
          tone === 'secondary' ? [styles.secondaryLabel, { color: c.text }] : styles.primaryLabel,
          inactive && tone === 'primary' && styles.primaryLabelDisabled,
        ]}>
        {children}
      </Text>
    );

  if (tone === 'primary') {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={inactive}
        hitSlop={HIT_SLOP}
        onPress={handlePress}
        style={({ pressed }) => [pressed && !inactive && styles.pressed, style]}>
        <LinearGradient
          colors={inactive ? [`${primary}66`, `${secondary}55`] : [primary, secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}>
          {loading ? (
            <ActivityIndicator color={orbitColors.ink} />
          ) : (
            <Text
              style={[
                typography.buttonLabel,
                styles.primaryLabel,
                inactive && styles.primaryLabelDisabled,
              ]}>
              {children}
            </Text>
          )}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      hitSlop={HIT_SLOP}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        tone === 'danger' ? styles.danger : styles.secondary,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
        style,
      ]}>
      {label}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    justifyContent: 'center',
    minHeight: orbitControl.buttonHeight,
    paddingHorizontal: space.xl,
    paddingVertical: 14,
  },
  danger: {
    backgroundColor: orbitColors.danger,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  primaryLabel: {
    color: orbitColors.ink,
  },
  primaryLabelDisabled: {
    opacity: 0.92,
  },
  secondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: orbitColors.border,
    borderWidth: 1,
  },
  secondaryLabel: {},
});
