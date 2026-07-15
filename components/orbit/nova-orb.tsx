import { StyleSheet, View } from 'react-native';

import { orbitColors } from '@/constants/orbit-theme';

export function NovaOrb() {
  return (
    <View style={styles.orb}>
      <View style={styles.core} />
      <View style={styles.spark} />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 194, 255, 0.16)',
    borderColor: 'rgba(0, 194, 255, 0.42)',
    borderRadius: 80,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    boxShadow: `0 0 30px ${orbitColors.novaCyan}61`,
    width: 88,
  },
  core: {
    backgroundColor: orbitColors.novaCyan,
    borderRadius: 28,
    height: 52,
    opacity: 0.9,
    width: 52,
  },
  spark: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    height: 12,
    position: 'absolute',
    right: 22,
    top: 20,
    width: 12,
  },
});
