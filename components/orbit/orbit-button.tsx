import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { orbitColors, orbitRadius, orbitSpacing } from '@/constants/orbit-theme';

type OrbitButtonProps = PropsWithChildren<{
  disabled?: boolean;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
}>;

export function OrbitButton({
  children,
  disabled = false,
  onPress,
  tone = 'primary',
  style,
}: OrbitButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[tone],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: orbitRadius.md,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: orbitSpacing.lg,
    paddingVertical: orbitSpacing.md,
  },
  danger: {
    backgroundColor: orbitColors.danger,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    color: orbitColors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
  primary: {
    backgroundColor: orbitColors.orbitBlue,
  },
  secondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: orbitColors.border,
    borderWidth: 1,
  },
});
