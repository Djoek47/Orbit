import { getMajordomoProfile, resolveMajordomoProfileId } from '@/lib/ai/majordomo-profiles';

/** Product default. User-facing copy is written with this name, then swapped. */
export const MAJORDOMO_COPY_NAME = 'Poppins';

export function resolveMajordomoDisplayName(options: {
  householdProfileId?: string | null;
  memberProfileId?: string | null;
}): string {
  return getMajordomoProfile(resolveMajordomoProfileId(options)).displayName;
}

/**
 * Replace the default character name in a sentence.
 * "Open Poppins" with Steward becomes "Open Steward".
 */
export function speakAs(name: string, copy: string): string {
  const speaker = name.trim() || MAJORDOMO_COPY_NAME;
  if (speaker === MAJORDOMO_COPY_NAME) return copy;
  return copy.split(MAJORDOMO_COPY_NAME).join(speaker);
}
