import { StyleSheet, Text, View } from 'react-native';

import { orbitColors, orbitTypography } from '@/constants/orbit-theme';

type MomentumRingProps = {
  score: number;
};

export function MomentumRing({ score }: MomentumRingProps) {
  return (
    <View style={styles.outer}>
      <View style={styles.inner}>
        <Text style={orbitTypography.metric}>{score}</Text>
        <Text style={styles.label}>Momentum</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    aspectRatio: 1,
    borderColor: orbitColors.novaCyan,
    borderRadius: 120,
    borderRightColor: orbitColors.orbitBlue,
    borderTopColor: orbitColors.success,
    borderWidth: 10,
    justifyContent: 'center',
    width: 144,
  },
  inner: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 100,
    height: 104,
    justifyContent: 'center',
    width: 104,
  },
  label: {
    color: orbitColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
