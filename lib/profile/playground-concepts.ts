/**
 * What we hand Apple Image Playground as text concepts.
 *
 * Never a person's name. Playground refuses to draw from names it reads as real people
 * (Nero → the Roman emperor → the sheet fails with failureReason "Other"), and with
 * personalization on it may try to match a name to someone in Photos. "Jack" happening
 * to work is luck. So the member's name — and any name the person typed into the
 * description — is left out; the description ("dragon, flying, green scales") is what
 * draws the character.
 */

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type PlaygroundConcepts = {
  /** Text concepts for the sheet, in order. */
  text: string[];
  /** Names that were typed into the description and taken out (for a one-line note). */
  removedNames: string[];
};

export function playgroundConcepts(
  description: string | undefined,
  namesToAvoid: (string | null | undefined)[] = []
): PlaygroundConcepts {
  // Whole names and each part of them ("Nero Mugabo" → "Nero Mugabo", "Nero", "Mugabo").
  const names = new Set<string>();
  for (const raw of namesToAvoid) {
    const name = raw?.trim();
    if (!name) continue;
    names.add(name);
    for (const part of name.split(/\s+/)) if (part.length >= 2) names.add(part);
  }
  const patterns = [...names]
    .sort((a, b) => b.length - a.length)
    .map((name) => ({ name, re: new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?:'s|’s)?(?![\\p{L}\\p{N}])`, 'giu') }));

  const removed = new Set<string>();
  const parts = (description ?? '')
    .split(/[,\n]/)
    .map((part) => {
      let out = part;
      for (const { name, re } of patterns) {
        if (re.test(out)) {
          removed.add(name.split(/\s+/)[0]!);
          out = out.replace(re, ' ');
        }
        re.lastIndex = 0;
      }
      return out.replace(/\s+/g, ' ').trim();
    })
    .filter((part) => part.length > 0)
    .slice(0, 6);

  return { text: [...parts, 'friendly character', 'profile picture'], removedNames: [...removed] };
}
