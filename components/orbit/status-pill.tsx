import { StyleSheet, View } from 'react-native';

import { orbitColors, radius } from '@/constants/orbit-theme';
import { AppText as Text } from '@/components/orbit/app-text';

type StatusPillProps = {
  label: string;
  tone?: 'blue' | 'cyan' | 'green' | 'amber' | 'red';
};

const toneColors = {
  blue: orbitColors.orbitBlue,
  cyan: orbitColors.poppinsCyan,
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
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
