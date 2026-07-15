import { KeyboardTypeOptions, StyleSheet, Text, TextInput, View } from 'react-native';

import { orbitColors, orbitRadius, orbitSpacing } from '@/constants/orbit-theme';

type OrbitInputProps = {
  keyboardType?: KeyboardTypeOptions;
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
};

export function OrbitInput({
  keyboardType = 'default',
  label,
  onChangeText,
  placeholder,
  value,
}: OrbitInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={orbitColors.textSubtle}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: orbitSpacing.xs,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    color: orbitColors.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: orbitSpacing.md,
  },
  label: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});
