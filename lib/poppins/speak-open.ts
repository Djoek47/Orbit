/**
 * Glue: session continuity + house memory + opening policy for Speak.
 * Opening policy itself stays pure in opening-policy.ts.
 */

import { buildPoppinsDeskBrief } from '@/lib/ai/household-context';
import {
  emptyHouseMemory,
  formatMemoryHint,
  hasMetHousehold,
  loadHouseMemory,
  markFirstHeard,
  markSituationSpoken,
  saveHouseMemory,
  setActiveHouseMemory,
  type HouseMemory,
} from '@/lib/poppins/house-memory';
import {
  continuityListenPrompt,
  isContinuityFresh,
  loadIuiContinuity,
  type IuiContinuity,
} from '@/lib/poppins/iui-continuity';
import { decideOpening, type OpeningDecision } from '@/lib/poppins/opening-policy';
import type { HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

export type SpeakOpenPrep = {
  continuity: IuiContinuity | null;
  memory: HouseMemory;
  opening: OpeningDecision;
  memoryHint: string;
  listenPrompt?: string;
  seedTurns?: IuiContinuity['turns'];
};

export async function hydrateHouseMemory(householdId: string | null | undefined): Promise<HouseMemory | null> {
  const id = householdId?.trim();
  if (!id) {
    setActiveHouseMemory(null);
    return null;
  }
  const memory = (await loadHouseMemory(id)) ?? emptyHouseMemory(id);
  setActiveHouseMemory(memory);
  return memory;
}

export async function prepareSpeakOpen(
  household: HouseholdSnapshot,
  metrics: OrbitMetrics
): Promise<SpeakOpenPrep> {
  const continuity = await loadIuiContinuity(household.id);
  const memory = (await loadHouseMemory(household.id)) ?? emptyHouseMemory(household.id);
  setActiveHouseMemory(memory);
  const desk = buildPoppinsDeskBrief(household, metrics);
  const opening = decideOpening({
    continuity,
    householdId: household.id,
    hasMetHousehold: hasMetHousehold(memory),
    lastSituationAt: memory.lastSituationAt,
    desk,
  });
  const resume = Boolean(
    continuity && isContinuityFresh(continuity) && continuity.householdId === household.id
  );
  return {
    continuity,
    memory,
    opening,
    memoryHint: formatMemoryHint(memory),
    listenPrompt: resume ? continuityListenPrompt(continuity!) : undefined,
    seedTurns: resume ? continuity!.turns : undefined,
  };
}

export async function commitSpeakOpen(
  memory: HouseMemory,
  opening: OpeningDecision
): Promise<HouseMemory> {
  let next = memory;
  if (opening.mode === 'presence' || opening.mode === 'situation') {
    next = markFirstHeard(next);
  }
  if (opening.mode === 'situation') {
    next = markSituationSpoken(next);
  }
  if (next !== memory) {
    setActiveHouseMemory(next);
    await saveHouseMemory(next);
  }
  return next;
}
