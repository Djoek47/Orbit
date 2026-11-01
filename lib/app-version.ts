import Constants from 'expo-constants';

import { CHOREMAXX_VERSION } from '@/constants/choremaxx-brand';

/** Native marketing version + build number when available (TestFlight shows 1.3.0 (61)). */
export function resolveAppVersionLabel(): string {
  const version =
    Constants.expoConfig?.version ??
    Constants.nativeApplicationVersion ??
    CHOREMAXX_VERSION;
  const build = Constants.nativeBuildVersion;
  if (build && String(build) !== String(version)) {
    return `${version} (${build})`;
  }
  return version;
}
