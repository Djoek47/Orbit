import type { WithSpringConfig } from 'react-native-reanimated';

/**
 * Shared spring timing tokens — see `docs/design-system/03-motion-interaction.md` §1.
 * Springs (not linear durations) because iOS motion is physically based. Use
 * `withTiming` only for simple opacity/color fades that don't move position/scale.
 */
export const motion = {
  /** ~150ms feel — button press feedback, toggles, chip selection. */
  snappy: { damping: 20, stiffness: 300, mass: 0.8 } satisfies WithSpringConfig,
  /** ~300ms feel — card state changes, sheet content, list insert/remove. */
  smooth: { damping: 18, stiffness: 180, mass: 1 } satisfies WithSpringConfig,
  /** ~600ms feel — momentum ring fill, XP/badge reveal, Nova orb, onboarding hero. */
  settle: { damping: 22, stiffness: 90, mass: 1.2 } satisfies WithSpringConfig,
} as const;

/** Matching plain-duration values for `withTiming`/`Animated` fallbacks. */
export const motionDuration = {
  snappy: 150,
  smooth: 300,
  settle: 600,
} as const;
