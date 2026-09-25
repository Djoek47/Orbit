/**
 * Trophy evaluators — eight types, definitions are data.
 * Spec: docs/logic/choremaxx-trophies-part2-cursor-spec.md §3, §7
 */

import type {
  ChildStats,
  CompositeCondition,
  EvaluatorType,
  TrophyDefinition,
} from './types';

export type EvaluateResult = {
  unlocked: boolean;
  current: number;
  target: number;
};

export type ChangedEvaluation = {
  def: TrophyDefinition;
  result: EvaluateResult;
};

/** Population count of set bits (for masks / distinct-set cardinality). */
export function popcount(n: number): number {
  let x = n >>> 0;
  let count = 0;
  while (x) {
    x &= x - 1;
    count += 1;
  }
  return count;
}

function readNumber(stats: ChildStats, key: string): number {
  const value = (stats as unknown as Record<string, unknown>)[key];
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return 0;
}

/**
 * Build a static index of definitions by the counter they depend on.
 * Call once at boot; on a counter change, only re-eval indexed trophies.
 */
export function buildCounterIndex(defs: TrophyDefinition[]): Map<string, TrophyDefinition[]> {
  const index = new Map<string, TrophyDefinition[]>();

  const add = (counter: string, def: TrophyDefinition) => {
    const list = index.get(counter);
    if (list) {
      if (!list.some((d) => d.id === def.id)) list.push(def);
    } else {
      index.set(counter, [def]);
    }
  };

  for (const def of defs) {
    add(def.counter, def);

    if (def.evaluator === 'composite_and') {
      const conditions = (def.params?.conditions as CompositeCondition[] | undefined) ?? [];
      for (const cond of conditions) add(cond.counter, def);
    }

    if (def.evaluator === 'ratio_gte') {
      const base = def.params?.baseCounter;
      if (typeof base === 'string') add(base, def);
    }
  }

  return index;
}

function evaluateLeaf(
  evaluator: EvaluatorType,
  stats: ChildStats,
  counter: string,
  threshold: number,
  params?: Record<string, unknown>
): EvaluateResult {
  switch (evaluator) {
    case 'counter_gte': {
      const current = readNumber(stats, counter);
      return { unlocked: current >= threshold, current, target: threshold };
    }
    case 'max_value_gte': {
      const current = readNumber(stats, counter);
      return { unlocked: current >= threshold, current, target: threshold };
    }
    case 'set_size_gte': {
      const current = popcount(readNumber(stats, counter));
      return { unlocked: current >= threshold, current, target: threshold };
    }
    case 'bitmask_complete': {
      const value = readNumber(stats, counter) >>> 0;
      const required =
        typeof params?.requiredMask === 'number'
          ? params.requiredMask >>> 0
          : threshold >>> 0;
      const current = popcount(value & required);
      const target = popcount(required);
      return { unlocked: (value & required) === required, current, target };
    }
    case 'boolean_flag': {
      const current = readNumber(stats, counter) >= 1 ? 1 : 0;
      return { unlocked: current >= 1, current, target: 1 };
    }
    case 'ratio_gte': {
      const numerator = readNumber(stats, counter);
      const baseKey =
        typeof params?.baseCounter === 'string' ? params.baseCounter : undefined;
      const denominator = baseKey ? readNumber(stats, baseKey) : 0;
      const ratio = denominator > 0 ? numerator / denominator : 0;
      const current = Math.floor(ratio * 100);
      const target = Math.floor(threshold * 100);
      return { unlocked: ratio >= threshold, current, target };
    }
    case 'consecutive_gte': {
      const current = readNumber(stats, counter);
      return { unlocked: current >= threshold, current, target: threshold };
    }
    case 'composite_and':
      return { unlocked: false, current: 0, target: 1 };
    default: {
      const _exhaustive: never = evaluator;
      void _exhaustive;
      return { unlocked: false, current: 0, target: threshold };
    }
  }
}

/** Criterion only — does not consult awardedSet. */
function evaluateCriterion(def: TrophyDefinition, stats: ChildStats): EvaluateResult {
  if (def.evaluator === 'composite_and') {
    const conditions = (def.params?.conditions as CompositeCondition[] | undefined) ?? [];
    let satisfied = 0;
    for (const cond of conditions) {
      const leaf = evaluateLeaf(
        cond.evaluator,
        stats,
        cond.counter,
        cond.threshold,
        cond.params
      );
      if (leaf.unlocked) satisfied += 1;
    }
    const target = conditions.length;
    return {
      unlocked: target > 0 && satisfied === target,
      current: satisfied,
      target,
    };
  }

  return evaluateLeaf(def.evaluator, stats, def.counter, def.threshold, def.params);
}

/**
 * Evaluate one trophy against ChildStats.
 * - `unlocked` is true when the criterion is met OR the trophy was already awarded
 *   (awards are never revoked even if counters later drop).
 * - Use tryAwardTrophy + !awardedSet.has for idempotent inserts.
 */
export function evaluateTrophy(
  def: TrophyDefinition,
  stats: ChildStats,
  awardedSet: ReadonlySet<string>
): EvaluateResult {
  const criterion = evaluateCriterion(def, stats);
  if (awardedSet.has(def.id)) {
    return { ...criterion, unlocked: true };
  }
  return criterion;
}

/**
 * Re-evaluate only trophies whose declared counter (or composite/ratio deps)
 * is among `changedCounters`.
 */
export function evaluateChangedCounters(
  defs: TrophyDefinition[],
  changedCounters: string[],
  stats: ChildStats,
  awardedSet: ReadonlySet<string>,
  index?: Map<string, TrophyDefinition[]>
): ChangedEvaluation[] {
  const byCounter = index ?? buildCounterIndex(defs);
  const seen = new Set<string>();
  const candidates: TrophyDefinition[] = [];

  for (const key of changedCounters) {
    for (const def of byCounter.get(key) ?? []) {
      if (seen.has(def.id)) continue;
      seen.add(def.id);
      candidates.push(def);
    }
  }

  return candidates.map((def) => ({
    def,
    result: evaluateTrophy(def, stats, awardedSet),
  }));
}

/**
 * Trophy ids that meet criteria and are not yet in awardedSet
 * (safe to attempt INSERT … ON CONFLICT DO NOTHING).
 */
export function collectNewUnlocks(
  evaluations: ChangedEvaluation[],
  awardedSet: ReadonlySet<string>
): string[] {
  const unlocked: string[] = [];
  for (const { def, result } of evaluations) {
    if (result.unlocked && !awardedSet.has(def.id)) unlocked.push(def.id);
  }
  return unlocked;
}

/**
 * In-memory award helper modeling UNIQUE(childId, trophyId).
 * Returns true if inserted; false on conflict (idempotent).
 */
export function tryAwardTrophy(
  awards: Map<string, Set<string>>,
  childId: string,
  trophyId: string
): boolean {
  let held = awards.get(childId);
  if (!held) {
    held = new Set();
    awards.set(childId, held);
  }
  if (held.has(trophyId)) return false;
  held.add(trophyId);
  return true;
}
