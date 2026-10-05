/**
 * Recorded GPT conversational lines for the How it works demo.
 *
 * Generate with: OPENAI_API_KEY=sk-... node scripts/generate-how-it-works-audio.mjs
 * Until clips are committed, the player stays silent on voice (cards + captions still run).
 * Never use device Speech for this demo.
 */

/**
 * Beat id → bundled audio module. Filled by the generator, e.g.
 *
 *   'task-ask': require('@/assets/how-it-works/task-ask.m4a'),
 */
const RECORDINGS: Record<string, number> = {};

/** True once any line has been recorded — the player picks its path from this. */
export function hasRecordedDemoAudio(): boolean {
  return Object.keys(RECORDINGS).length > 0;
}

/** The recording for a beat, or null when that line has no clip yet. */
export function recordedDemoAudio(beatId: string): number | null {
  return RECORDINGS[beatId] ?? null;
}

/** Which beats are still missing a recording — used by tests when wiring audio. */
export function missingDemoRecordings(beatIds: string[]): string[] {
  if (!hasRecordedDemoAudio()) return beatIds;
  return beatIds.filter((id) => RECORDINGS[id] == null);
}
