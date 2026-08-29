/**
 * Diacritic-insensitive House Rules search for Ask Poppins.
 */
import type { HouseRule } from '@/lib/rules/types';
import type { VisibleChapter } from '@/lib/rules/visible-rules';

export type SearchableRule = HouseRule & {
  displayNumber?: string;
  chapterLabel?: string;
};

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Match query against question / clause / headline / chapter label.
 * Empty query returns [].
 */
export function searchHouseRules(
  groups: VisibleChapter[],
  query: string,
  voice: 'admin' | 'sidekick'
): SearchableRule[] {
  const q = fold(query);
  if (!q) return [];

  const hits: SearchableRule[] = [];
  for (const { chapter, rules } of groups) {
    const chapterLabel = voice === 'sidekick' ? chapter.sidekickLabel : chapter.adminLabel;
    for (const rule of rules) {
      const hay =
        voice === 'sidekick'
          ? [rule.sidekick.body, rule.sidekick.headline, chapterLabel]
          : [rule.admin.clause, rule.admin.headline, chapterLabel];
      if (hay.some((part) => fold(part).includes(q))) {
        hits.push({ ...rule, chapterLabel });
      }
    }
  }
  return hits;
}
