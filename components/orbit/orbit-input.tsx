import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { KeyboardTypeOptions, Pressable, StyleSheet, TextInputProps, View } from 'react-native';

import { radius, space } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';

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
  // Password fields get a Show / Hide button: seeing what you typed is an accessibility need.
  const [revealed, setRevealed] = useState(false);
  const hidden = secureTextEntry && !revealed;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textSubtle}
        secureTextEntry={hidden}
        autoCorrect={secureTextEntry ? false : undefined}
        style={[
          styles.input,
          secureTextEntry ? styles.inputWithToggle : null,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.92)',
            borderColor: c.border,
            color: c.text,
          },
        ]}
        value={value}
      />
      {secureTextEntry ? (
        <Pressable
          onPress={() => setRevealed((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          style={styles.toggle}>
          <MaterialIcons name={revealed ? 'visibility-off' : 'visibility'} size={22} color={c.textMuted} />
        </Pressable>
      ) : null}
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
  inputWithToggle: { paddingRight: 52 },
  toggle: {
    alignItems: 'center',
    bottom: 0,
    height: 52,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    width: 48,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
