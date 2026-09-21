/**
 * Tour state machine + AsyncStorage persistence — Work Order 9 D4.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { evaluateTourWhen, type TourConditionContext } from '@/lib/tour/tour-conditions';
import { chaptersForTour, getTourDefinition } from '@/lib/tour/tour-steps';
import {
  emptyTourState,
  tourStorageKey,
  type TourChapter,
  type TourId,
  type TourState,
  type TourStatus,
  type TourStep,
} from '@/lib/tour/tour-types';

export type ActiveTourPointer = {
  tourId: TourId;
  chapter: TourChapter;
  chapterIndex: number;
  step: TourStep;
  stepIndex: number;
  stepOrdinal: number;
  stepsInChapter: number;
};

function parseState(raw: string | null, tourId: TourId): TourState {
  if (!raw) return emptyTourState(tourId);
  try {
    const parsed = JSON.parse(raw) as Partial<TourState>;
    return {
      ...emptyTourState(tourId),
      ...parsed,
      tourId,
      completedChapters: Array.isArray(parsed.completedChapters) ? parsed.completedChapters : [],
      skippedChapters: Array.isArray(parsed.skippedChapters) ? parsed.skippedChapters : [],
    };
  } catch {
    return emptyTourState(tourId);
  }
}

export async function loadTourState(
  householdId: string,
  memberId: string,
  tourId: TourId
): Promise<TourState> {
  if (!householdId || !memberId) return emptyTourState(tourId);
  const raw = await AsyncStorage.getItem(tourStorageKey(householdId, memberId, tourId));
  return parseState(raw, tourId);
}

export async function saveTourState(
  householdId: string,
  memberId: string,
  state: TourState
): Promise<void> {
  if (!householdId || !memberId) return;
  const next = { ...state, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(
    tourStorageKey(householdId, memberId, next.tourId),
    JSON.stringify(next)
  );
}

export function filterChapterSteps(
  chapter: TourChapter,
  ctx: TourConditionContext
): TourStep[] {
  return chapter.steps.filter((s) => evaluateTourWhen(s.when, ctx));
}

export function resolveActivePointer(
  state: TourState,
  ctx: TourConditionContext
): ActiveTourPointer | null {
  if (state.status !== 'in_progress') return null;
  const chapters = chaptersForTour(state.tourId);
  let chapterIndex = chapters.findIndex((c) => c.id === state.chapterId);
  if (chapterIndex < 0) chapterIndex = 0;

  for (let ci = chapterIndex; ci < chapters.length; ci++) {
    const chapter = chapters[ci];
    if (state.skippedChapters.includes(chapter.id)) continue;
    if (state.completedChapters.includes(chapter.id) && ci > chapterIndex) continue;
    const steps = filterChapterSteps(chapter, ctx);
    if (!steps.length) continue;
    const rawIndex = ci === chapterIndex ? state.stepIndex ?? 0 : 0;
    const stepIndex = Math.min(Math.max(0, rawIndex), steps.length - 1);
    const step = steps[stepIndex];
    if (!step) continue;
    return {
      tourId: state.tourId,
      chapter,
      chapterIndex: ci,
      step,
      stepIndex,
      stepOrdinal: stepIndex + 1,
      stepsInChapter: steps.length,
    };
  }
  return null;
}

export function startTourState(tourId: TourId): TourState {
  const def = getTourDefinition(tourId);
  const first = def.chapters[0];
  return {
    ...emptyTourState(tourId),
    status: 'in_progress',
    chapterId: first?.id,
    stepIndex: 0,
    startedAt: new Date().toISOString(),
  };
}

export function offerTourState(tourId: TourId): TourState {
  return {
    ...emptyTourState(tourId),
    status: 'offered',
  };
}

export function skipTourState(prev: TourState): TourState {
  return {
    ...prev,
    status: 'skipped',
    chapterId: undefined,
    stepIndex: undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function completeTourState(prev: TourState): TourState {
  const chapters = chaptersForTour(prev.tourId);
  return {
    ...prev,
    status: 'completed',
    completedChapters: chapters.map((c) => c.id),
    chapterId: undefined,
    stepIndex: undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function advanceAfterStep(
  state: TourState,
  ctx: TourConditionContext,
  opts?: { skipStep?: boolean }
): TourState {
  const pointer = resolveActivePointer(state, ctx);
  if (!pointer) return completeTourState(state);

  const chapters = chaptersForTour(state.tourId);
  const steps = filterChapterSteps(pointer.chapter, ctx);
  const nextStepIndex = pointer.stepIndex + 1;

  if (!opts?.skipStep && nextStepIndex < steps.length) {
    return {
      ...state,
      chapterId: pointer.chapter.id,
      stepIndex: nextStepIndex,
      updatedAt: new Date().toISOString(),
    };
  }

  // Finish chapter → next chapter
  const completedChapters = state.completedChapters.includes(pointer.chapter.id)
    ? state.completedChapters
    : [...state.completedChapters, pointer.chapter.id];

  for (let ci = pointer.chapterIndex + 1; ci < chapters.length; ci++) {
    const chapter = chapters[ci];
    if (state.skippedChapters.includes(chapter.id)) continue;
    if (completedChapters.includes(chapter.id)) continue;
    const nextSteps = filterChapterSteps(chapter, ctx);
    if (!nextSteps.length) {
      completedChapters.push(chapter.id);
      continue;
    }
    return {
      ...state,
      completedChapters,
      chapterId: chapter.id,
      stepIndex: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  return completeTourState({ ...state, completedChapters });
}

export function skipChapterState(state: TourState, ctx: TourConditionContext): TourState {
  const pointer = resolveActivePointer(state, ctx);
  if (!pointer) return state;
  const skippedChapters = state.skippedChapters.includes(pointer.chapter.id)
    ? state.skippedChapters
    : [...state.skippedChapters, pointer.chapter.id];
  return advanceAfterStep(
    {
      ...state,
      skippedChapters,
      stepIndex: filterChapterSteps(pointer.chapter, ctx).length,
    },
    ctx,
    { skipStep: true }
  );
}

export function restartChapterState(tourId: TourId, chapterId: string): TourState {
  return {
    ...emptyTourState(tourId),
    status: 'in_progress',
    chapterId,
    stepIndex: 0,
    startedAt: new Date().toISOString(),
  };
}

export function setTourStatus(prev: TourState, status: TourStatus): TourState {
  return { ...prev, status, updatedAt: new Date().toISOString() };
}

/** Quiet Speak forced while Poppins tour action step is active. */
let forceQuiet = false;

export function setTourForcesQuiet(value: boolean): void {
  forceQuiet = value;
}

export function tourForcesQuietSpeak(): boolean {
  return forceQuiet;
}

type TourUiHooks = {
  setTasksDomain?: (domain: 'chores' | 'homework') => void;
};

let uiHooks: TourUiHooks = {};

export function registerTourUiHooks(hooks: TourUiHooks): () => void {
  uiHooks = { ...uiHooks, ...hooks };
  return () => {
    uiHooks = {};
  };
}

export function applyTourStepEnter(onEnter?: 'tasks.homework' | 'forceQuietSpeak'): void {
  if (onEnter === 'tasks.homework') {
    uiHooks.setTasksDomain?.('homework');
  }
  if (onEnter === 'forceQuietSpeak') {
    setTourForcesQuiet(true);
  }
}

export type ChecklistProgress = {
  hidden: boolean;
  completedSeen: boolean;
};

export async function loadChecklistFlags(
  householdId: string,
  memberId: string,
  tourId: TourId
): Promise<ChecklistProgress> {
  const state = await loadTourState(householdId, memberId, tourId);
  return {
    hidden: Boolean(state.checklistHidden),
    completedSeen: Boolean(state.checklistCompletedSeen),
  };
}
