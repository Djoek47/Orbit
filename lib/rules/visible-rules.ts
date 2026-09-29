import { isVisible } from '@/lib/rules/visibility';
import type {
  Chapter,
  HouseRule,
  HouseRulesDoc,
  HouseRulesHouseholdView,
} from '@/lib/rules/types';

export type VisibleChapter = {
  chapter: Chapter;
  rules: HouseRule[];
};

/**
 * Filter → group by chapter → order.
 * Empty chapters are omitted entirely.
 * Mirror of the HTML reference `visibleRules` + `groupByChapter`.
 */
export function visibleRules(
  doc: HouseRulesDoc,
  household: HouseRulesHouseholdView
): VisibleChapter[] {
  const filtered = doc.rules
    .filter((rule) => isVisible(rule.condition, household))
    .sort(
      (a, b) =>
        chapterOrder(doc, chapterIdOf(a)) - chapterOrder(doc, chapterIdOf(b)) ||
        a.order - b.order
    );

  const out: VisibleChapter[] = [];
  for (const rule of filtered) {
    const chapterKey = chapterIdOf(rule);
    const last = out[out.length - 1];
    if (last && last.chapter.key === chapterKey) {
      last.rules.push(rule);
      continue;
    }
    const chapter = doc.chapters.find((c) => (c.id ?? c.key) === chapterKey);
    if (!chapter) throw new Error(`Unknown chapter: ${chapterKey}`);
    out.push({ chapter, rules: [rule] });
  }
  return out;
}

function chapterIdOf(rule: HouseRule): string {
  return rule.chapterId ?? rule.chapter;
}

function chapterOrder(doc: HouseRulesDoc, key: string): number {
  const chapter = doc.chapters.find((c) => (c.id ?? c.key) === key);
  if (!chapter) throw new Error(`Unknown chapter: ${key}`);
  return chapter.order;
}

export function visibleRuleCount(groups: VisibleChapter[]): number {
  return groups.reduce((sum, g) => sum + g.rules.length, 0);
}
