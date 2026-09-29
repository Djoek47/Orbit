import * as Haptics from 'expo-haptics';

export type OrbitHaptic = 'light' | 'medium' | 'none';

export function triggerOrbitHaptic(kind: OrbitHaptic = 'light') {
  if (kind === 'none') return;
  void Haptics.impactAsync(
    kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
  );
}
