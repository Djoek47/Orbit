/**
 * Recorded lines for the How it works demo.
 *
 * The phone's own speech is free and works offline, but it reads punctuation poorly and sounds
 * robotic. When real recordings are bundled, the player uses them instead — same script, same
 * timings, just a voice worth listening to.
 *
 * To add them: drop the files in assets/how-it-works (see the README there) and list them
 * below. Metro only bundles what is `require`d, so this list is the wiring. While the list is
 * empty the demo speaks on the phone, exactly as before.
 */

/**
 * Beat id → bundled audio module. Fill in as recordings land, e.g.
 *
 *   'chore-1': require('@/assets/how-it-works/chore-1.m4a'),
 */
const RECORDINGS: Record<string, number> = {};

/** True once any line has been recorded — the player picks its path from this. */
export function hasRecordedDemoAudio(): boolean {
  return Object.keys(RECORDINGS).length > 0;
}

/** The recording for a beat, or null to fall back to the phone's own voice. */
export function recordedDemoAudio(beatId: string): number | null {
  return RECORDINGS[beatId] ?? null;
}

/** Which beats are still missing a recording — used by the test, and handy when adding them. */
export function missingDemoRecordings(beatIds: string[]): string[] {
  if (!hasRecordedDemoAudio()) return [];
  return beatIds.filter((id) => RECORDINGS[id] == null);
}
