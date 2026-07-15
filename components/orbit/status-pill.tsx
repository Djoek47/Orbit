import { StyleSheet, Text, View } from 'react-native';

import { orbitColors, orbitRadius } from '@/constants/orbit-theme';

type StatusPillProps = {
  label: string;
  tone?: 'blue' | 'cyan' | 'green' | 'amber' | 'red';
};

const toneColors = {
  blue: orbitColors.orbitBlue,
  cyan: orbitColors.novaCyan,
  green: orbitColors.success,
  amber: orbitColors.warning,
  red: orbitColors.danger,
};

export function StatusPill({ label, tone = 'blue' }: StatusPillProps) {
  const color = toneColors[tone];

  return (
    <View style={[styles.pill, { borderColor: `${color}66`, backgroundColor: `${color}1F` }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: orbitRadius.sm,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
