import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { radius, space } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text } from '@/components/orbit/app-text';

type ChoiceRowProps<T extends string> = {
  label: string;
  onChange: (value: T) => void;
  options: T[];
  value: T;
};

export function ChoiceRow<T extends string>({ label, onChange, options, value }: ChoiceRowProps<T>) {
  const { c, isDark, glass, glassBorder } = useOrbitColors();

  return (
    <>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected
                    ? isDark
                      ? 'rgba(0, 194, 255, 0.16)'
                      : `${c.poppinsCyan}22`
                    : glass(0.06),
                  borderColor: selected ? c.poppinsCyan : glassBorder(0.12),
                },
              ]}>
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? c.text : c.textSoft },
                ]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    gap: space.sm,
    paddingBottom: space.xs,
  },
});
