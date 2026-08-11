import { isVisible } from '@/lib/rules/visibility';
import type {
  Chapter,
  HouseRule,
  HouseRulesDoc,
  HouseRulesHouseholdView,
  PhaseKey,
} from '@/lib/rules/types';
import { PHASE_KEYS } from '@/lib/rules/types';

export type NumberedRule = HouseRule & { displayNumber: string };

export type VisibleChapter = {
  chapter: Chapter;
  rules: NumberedRule[];
};

export type PhaseStop = {
  phase: PhaseKey;
  label: string;
  rules: NumberedRule[];
};

/** Adult Track phase labels (spec / HTML). */
export const PHASE_LABELS: Record<PhaseKey, string> = {
  assigned: 'Assigned',
  nudge: 'Nudge',
  deadline: 'Deadline',
  lateCredit: 'Late Credit',
  expired: 'Expired',
  counted: 'Counted',
  weekly: 'Weekly',
  crownWeek: 'Crown · Week',
  crownMonth: 'Crown · Month',
  anytime: 'Anytime',
};

/** Kid-friendly phase when labels. */
export const PHASE_LABELS_KID: Record<PhaseKey, string> = {
  assigned: 'You get it',
  nudge: 'Reminder',
  deadline: 'Due',
  lateCredit: 'Still counts',
  expired: 'Too late',
  counted: 'It counts',
  weekly: 'This week',
  crownWeek: 'Week crown',
  crownMonth: 'Month crown',
  anytime: 'Anytime',
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
 * Order follows PHASE_KEYS.
 */
export function rulesByPhase(
  groups: VisibleChapter[],
  voice: 'adult' | 'kid' = 'adult'
): PhaseStop[] {
  const flat = groups.flatMap((g) => g.rules);
  const byPhase = new Map<PhaseKey, NumberedRule[]>();
  for (const rule of flat) {
    const list = byPhase.get(rule.phase) ?? [];
    list.push(rule);
    byPhase.set(rule.phase, list);
  }

  const labels = voice === 'kid' ? PHASE_LABELS_KID : PHASE_LABELS;
  const stops: PhaseStop[] = [];
  for (const phase of PHASE_KEYS) {
    const rules = byPhase.get(phase);
    if (!rules?.length) continue;
    stops.push({
      phase,
      label: labels[phase],
      rules: [...rules].sort((a, b) => a.order - b.order),
    });
  }
  return stops;
}
