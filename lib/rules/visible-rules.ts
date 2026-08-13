import { isVisible } from '@/lib/rules/visibility';
import type {
  Chapter,
  HouseRule,
  HouseRulesDoc,
  HouseRulesHouseholdView,
  PhaseBlock,
  PhaseKey,
  PhaseTone,
} from '@/lib/rules/types';
import { PHASE_KEYS } from '@/lib/rules/types';

export type NumberedRule = HouseRule & { displayNumber: string };

export type VisibleChapter = {
  chapter: Chapter;
  rules: NumberedRule[];
};

export type PhaseStop = {
  phase: PhaseKey;
  gutter: string;
  kicker: string | null;
  tone: PhaseTone;
  block: PhaseBlock;
  rules: NumberedRule[];
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

/**
 * Flatten visible rules into Track phase stops.
 * Multi-rule stops merge; empty phases are skipped.
 * Order / gutter / kicker / tone / block come from JSON `phases`.
 */
export function rulesByPhase(doc: HouseRulesDoc, groups: VisibleChapter[]): PhaseStop[] {
  const flat = groups.flatMap((g) => g.rules);
  const byPhase = new Map<PhaseKey, NumberedRule[]>();
  for (const rule of flat) {
    const list = byPhase.get(rule.phase) ?? [];
    list.push(rule);
    byPhase.set(rule.phase, list);
  }

  const ordered = [...PHASE_KEYS].sort(
    (a, b) => doc.phases[a].order - doc.phases[b].order
  );
  const stops: PhaseStop[] = [];
  for (const phase of ordered) {
    const rules = byPhase.get(phase);
    if (!rules?.length) continue;
    const meta = doc.phases[phase];
    stops.push({
      phase,
      gutter: meta.gutter,
      kicker: meta.kicker,
      tone: meta.tone,
      block: meta.block,
      rules: [...rules].sort((a, b) => a.order - b.order),
    });
  }
  return stops;
}
