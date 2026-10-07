import { resolveMajordomoDisplayName } from '@/lib/ai/majordomo-name';
import { useOrbitOptional } from '@/store/orbit-store';

/** Name of the character this member hears: personal override, else household default. */
export function useMajordomoName(): string {
  const orbit = useOrbitOptional();
  return resolveMajordomoDisplayName({
    householdProfileId: orbit?.household.majordomoProfileId,
    memberProfileId: orbit?.currentMember?.majordomoProfileId,
  });
}
