/**
 * Trophy names shown to people — never the EXAMPLE: seed prefix.
 */

export function displayTrophyName(raw: string): string {
  return raw.replace(/^\s*EXAMPLE:\s*/i, '').trim();
}

export function stripExampleCopy(text: string): string {
  return text
    .replace(/\bEXAMPLE:\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function copyContainsExample(text: string): boolean {
  return /\bEXAMPLE\b/i.test(text);
}
