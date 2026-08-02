import { KeyboardTypeOptions, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { radius, space } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

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
  const { c, isDark } = useOrbitColors();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textSubtle}
        secureTextEntry={secureTextEntry}
        style={[
          styles.input,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.92)',
            borderColor: c.border,
            color: c.text,
          },
        ]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: space.xs,
  },
  input: {
    borderRadius: radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: space.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
