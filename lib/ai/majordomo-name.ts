/**
 * The assistant's name.
 *
 * There used to be characters — Steward, Intelligence, Wit — each with its own name, and copy
 * was written with "Poppins" in it and then swapped. There is one assistant now and it is
 * called Poppins, everywhere, for every household. What a household picked before survives
 * only as a voice (lib/ai/poppins-voices bridges it), never as a name.
 *
 * `resolveMajordomoDisplayName` and `speakAs` are kept so the call sites don't all have to
 * change at once; both now hand back the same name.
 */

/** The only name the assistant has. */
export const MAJORDOMO_COPY_NAME = 'Poppins';

export function resolveMajordomoDisplayName(_options?: {
  householdProfileId?: string | null;
  memberProfileId?: string | null;
}): string {
  return MAJORDOMO_COPY_NAME;
}

/**
 * Was: swap the default name for this household's character. Now a pass-through, because the
 * name never changes. Left in place so copy written as "Open Poppins" keeps working.
 */
export function speakAs(_name: string, copy: string): string {
  return copy;
}
