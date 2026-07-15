import { StyleSheet, View } from 'react-native';

import { orbitColors } from '@/constants/orbit-theme';

export type NovaOrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

type NovaOrbProps = {
  state?: NovaOrbState;
};

export function NovaOrb({ state = 'idle' }: NovaOrbProps) {
  const pulse = state === 'listening' || state === 'thinking' || state === 'speaking';

  return (
    <View style={[styles.orb, pulse && styles.orbActive, state === 'listening' && styles.orbListening]}>
      <View style={[styles.core, state === 'thinking' && styles.coreThinking]} />
      <View style={[styles.spark, state === 'speaking' && styles.sparkSpeaking]} />
    </View>
  );
}

const styles = StyleSheet.create({
  core: {
    backgroundColor: orbitColors.novaCyan,
    borderRadius: 28,
    height: 52,
    opacity: 0.9,
    width: 52,
  },
  coreThinking: {
    opacity: 0.65,
    transform: [{ scale: 0.92 }],
  },
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
  orbActive: {
    borderColor: 'rgba(0, 194, 255, 0.72)',
    boxShadow: `0 0 42px ${orbitColors.novaCyan}88`,
  },
  orbListening: {
    borderColor: 'rgba(41, 121, 255, 0.85)',
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
  sparkSpeaking: {
    backgroundColor: '#FDE68A',
  },
});
