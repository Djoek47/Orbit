import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { orbitColors, orbitControl, orbitRadius, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbitOptional } from '@/store/orbit-store';

type OrbitButtonProps = PropsWithChildren<{
  disabled?: boolean;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
}>;

/** Make CTA: gradient primary with ink label; secondary glass. Uses accent theme when available. */
export function OrbitButton({
  children,
  disabled = false,
  onPress,
  tone = 'primary',
  style,
}: OrbitButtonProps) {
  const orbit = useOrbitOptional();
  const primary = orbit?.accentTheme.primary ?? '#38BDF8';
  const secondary = orbit?.accentTheme.secondary ?? '#0EA5E9';

  if (tone === 'primary' && !disabled) {
    return (
      <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [pressed && styles.pressed, style]}>
        <LinearGradient
          colors={[primary, secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}>
          <Text style={[orbitTypography.buttonLabel, styles.primaryLabel]}>{children}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'danger' ? styles.danger : styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <Text
        style={[
          orbitTypography.buttonLabel,
          tone === 'secondary' ? styles.secondaryLabel : styles.primaryLabel,
        ]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: orbitRadius.lg,
    justifyContent: 'center',
    minHeight: orbitControl.buttonHeight,
    paddingHorizontal: orbitSpacing.lg,
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
  secondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: orbitColors.border,
    borderWidth: 1,
  },
  secondaryLabel: {
    color: orbitColors.text,
  },
});
