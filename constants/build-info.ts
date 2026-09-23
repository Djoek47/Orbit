import Constants from 'expo-constants';

type Extra = {
  gitCommitHash?: string;
  gitBranch?: string;
  buildInfoLabel?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Injected tip marker so Expo Go / TestFlight can prove which commit is running. */
export const BUILD_INFO = {
  branch: extra.gitBranch ?? 'cursor/make-v23',
  commit: extra.gitCommitHash ?? 'unknown',
  label: extra.buildInfoLabel ?? `make-v23 · ${extra.gitCommitHash ?? 'unknown'}`,
} as const;
