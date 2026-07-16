import { KeyboardTypeOptions, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { orbitColors, orbitRadius, orbitSpacing } from '@/constants/orbit-theme';

type OrbitInputProps = {
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: KeyboardTypeOptions;
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  value: string;
};

export function OrbitInput({
  autoCapitalize = 'sentences',
  keyboardType = 'default',
  label,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  value,
}: OrbitInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={orbitColors.textSubtle}
        secureTextEntry={secureTextEntry}
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
