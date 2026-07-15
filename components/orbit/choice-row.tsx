import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { orbitColors, orbitRadius, orbitSpacing } from '@/constants/orbit-theme';

type ChoiceRowProps<T extends string> = {
  label: string;
  onChange: (value: T) => void;
  options: T[];
  value: T;
};

export function ChoiceRow<T extends string>({ label, onChange, options, value }: ChoiceRowProps<T>) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              style={[styles.chip, selected && styles.selected]}>
              <Text style={[styles.chipText, selected && styles.selectedText]}>{option}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    paddingHorizontal: orbitSpacing.md,
    paddingVertical: orbitSpacing.sm,
  },
  chipText: {
    color: orbitColors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  label: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    gap: orbitSpacing.sm,
    paddingBottom: orbitSpacing.xs,
  },
  selected: {
    backgroundColor: 'rgba(0, 194, 255, 0.16)',
    borderColor: orbitColors.novaCyan,
  },
  selectedText: {
    color: orbitColors.text,
  },
});
