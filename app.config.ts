/**
 * Expo config — injects the git commit at build / Metro start so Help can show it.
 * EAS sets EAS_BUILD_GIT_COMMIT_HASH on cloud builds.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const appJson = require('./app.json') as { expo: ExpoConfig };

function resolveGitCommit(): string {
  const fromEas = process.env.EAS_BUILD_GIT_COMMIT_HASH?.trim();
  if (fromEas) return fromEas.slice(0, 7);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync } = require('node:child_process') as typeof import('node:child_process');
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim().slice(0, 7);
  } catch {
    return 'unknown';
  }
}

function resolveGitBranch(): string {
  const fromEas = process.env.EAS_BUILD_GIT_REF?.trim();
  if (fromEas) return fromEas.replace(/^refs\/heads\//, '');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync } = require('node:child_process') as typeof import('node:child_process');
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = appJson.expo;
  const commit = resolveGitCommit();
  const branch = resolveGitBranch();
  return {
    ...base,
    ...config,
    extra: {
      ...(base.extra ?? {}),
      ...(config.extra ?? {}),
      gitCommitHash: commit,
      gitBranch: branch,
      buildInfoLabel: `${branch} · ${commit}`,
    },
  };
};
