import { isVisible } from '@/lib/rules/visibility';
import type {
  Chapter,
  HouseRule,
  HouseRulesDoc,
  HouseRulesHouseholdView,
} from '@/lib/rules/types';

export type VisibleChapter = {
  chapter: Chapter;
  rules: Array<HouseRule & { displayNumber: string }>;
};

/**
 * Filter → group by chapter → order → compute display numbers.
 * Empty chapters are omitted entirely.
 */
export function visibleRules(
  doc: HouseRulesDoc,
  household: HouseRulesHouseholdView
): VisibleChapter[] {
  const filtered = doc.rules
    .filter((rule) => isVisible(rule.condition, household))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const byChapter = new Map<string, HouseRule[]>();
  for (const rule of filtered) {
    const list = byChapter.get(rule.chapter) ?? [];
    list.push(rule);
    byChapter.set(rule.chapter, list);
  }

  const result: VisibleChapter[] = [];
  for (const chapter of [...doc.chapters].sort((a, b) => a.order - b.order)) {
    const rules = byChapter.get(chapter.key);
    if (!rules?.length) continue;
    result.push({
      chapter,
      rules: rules.map((rule, index) => ({
        ...rule,
        displayNumber: `${chapter.order}.${index + 1}`,
      })),
    });
  }
  return result;
}

export function visibleRuleCount(groups: VisibleChapter[]): number {
  return groups.reduce((sum, g) => sum + g.rules.length, 0);
}

/** Substitute tokens in kid copy (e.g. {dailyDeadline}). */
export function substituteTokens(
  text: string,
  tokens: Record<string, string>
): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => tokens[key] ?? `{${key}}`);
}
