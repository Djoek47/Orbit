/**
 * In-memory ChildStats + EXAMPLE trophy awards for completion wiring.
 * Persists awards/stats per child in AsyncStorage for Expo Go continuity.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  applyCompletionDelta,
  emptyChildStats,
  type CompletionDeltaEvent,
} from '@/lib/trophies/child-stats';
import {
  collectNewUnlocks,
  evaluateChangedCounters,
  tryAwardTrophy,
} from '@/lib/trophies/evaluators';
import { EXAMPLE_TROPHY_DEFINITIONS } from '@/lib/trophies/seed-examples';
import type { ChildStats } from '@/lib/trophies/types';

const STATS_KEY = '@orbit/child_stats.v1';
const AWARDS_KEY = '@orbit/trophy_awards.v1';

const statsByChild = new Map<string, ChildStats>();
const awardsByChild = new Map<string, Set<string>>();

async function loadPersisted(householdId: string, childId: string) {
  const mapKey = `${householdId}:${childId}`;
  if (statsByChild.has(mapKey)) return;
  try {
    const [statsRaw, awardsRaw] = await Promise.all([
      AsyncStorage.getItem(`${STATS_KEY}:${mapKey}`),
      AsyncStorage.getItem(`${AWARDS_KEY}:${mapKey}`),
    ]);
    if (statsRaw) {
      statsByChild.set(mapKey, JSON.parse(statsRaw) as ChildStats);
    }
    if (awardsRaw) {
      const ids = JSON.parse(awardsRaw) as string[];
      awardsByChild.set(mapKey, new Set(Array.isArray(ids) ? ids : []));
    }
  } catch {
    // keep empty
  }
}

async function persist(householdId: string, childId: string) {
  const mapKey = `${householdId}:${childId}`;
  const stats = statsByChild.get(mapKey);
  const awards = awardsByChild.get(mapKey);
  try {
    if (stats) {
      await AsyncStorage.setItem(`${STATS_KEY}:${mapKey}`, JSON.stringify(stats));
    }
    if (awards) {
      await AsyncStorage.setItem(`${AWARDS_KEY}:${mapKey}`, JSON.stringify([...awards]));
    }
  } catch (error) {
    console.warn('persistChildTrophyState failed', error);
  }
}

function ensure(householdId: string, childId: string) {
  const mapKey = `${householdId}:${childId}`;
  if (!statsByChild.has(mapKey)) {
    statsByChild.set(mapKey, emptyChildStats(childId));
  }
  if (!awardsByChild.has(mapKey)) {
    awardsByChild.set(mapKey, new Set());
  }
  return mapKey;
}

export type TrophyUnlock = {
  id: string;
  name: string;
  description: string;
};

/**
 * Apply completion delta + evaluate EXAMPLE trophies.
 * Returns newly unlocked trophies (for toast / gallery).
 */
export async function recordCompletionForTrophies(input: {
  householdId: string;
  childId: string;
  event: CompletionDeltaEvent;
}): Promise<TrophyUnlock[]> {
  const { householdId, childId, event } = input;
  await loadPersisted(householdId, childId);
  const mapKey = ensure(householdId, childId);
  const prev = statsByChild.get(mapKey)!;
  const next = applyCompletionDelta(prev, event);
  statsByChild.set(mapKey, next);

  const awarded = awardsByChild.get(mapKey)!;
  const changed = [
    'tasksCompletedTotal',
    'xpTotal',
    'xpDayMax',
    'tasksMorning',
    'tasksAfternoon',
    'tasksEvening',
    'tasksPreDawn',
    'tasksOnDueDay',
    'domainsTouchedMask',
  ];
  const evaluations = evaluateChangedCounters(
    EXAMPLE_TROPHY_DEFINITIONS,
    changed,
    next,
    awarded
  );
  const newIds = collectNewUnlocks(evaluations, awarded);
  const unlocks: TrophyUnlock[] = [];
  for (const id of newIds) {
    if (tryAwardTrophy(awardsByChild, mapKey, id)) {
      const def = EXAMPLE_TROPHY_DEFINITIONS.find((item) => item.id === id);
      if (def) {
        unlocks.push({ id: def.id, name: def.name, description: def.description });
      }
    }
  }

  await persist(householdId, childId);
  return unlocks;
}

export async function listAwardedTrophyIds(
  householdId: string,
  childId: string
): Promise<string[]> {
  await loadPersisted(householdId, childId);
  const mapKey = ensure(householdId, childId);
  return [...(awardsByChild.get(mapKey) ?? [])];
}

export async function getChildStats(
  householdId: string,
  childId: string
): Promise<ChildStats> {
  await loadPersisted(householdId, childId);
  const mapKey = ensure(householdId, childId);
  return { ...(statsByChild.get(mapKey) ?? emptyChildStats(childId)) };
}
