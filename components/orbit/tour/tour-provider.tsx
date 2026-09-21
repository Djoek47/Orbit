/**
 * TourProvider — mounts above the navigator; drives navigation, wait, overlay.
 * Work Order 9 D3–D5.
 */

import * as Haptics from 'expo-haptics';
import { router, useNavigationContainerRef, usePathname } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Keyboard,
  View,
} from 'react-native';

import { TourErrorBoundary } from '@/components/orbit/tour/tour-error-boundary';
import { TourOverlay } from '@/components/orbit/tour/tour-overlay';
import { TourWelcome } from '@/components/orbit/tour/tour-welcome';
import { trackAnalytics } from '@/lib/analytics';
import {
  isUpgradeHousehold,
  ownerName,
  resolveTourId,
  showAllowance,
  showRanks,
  showRewards,
  type TourConditionContext,
} from '@/lib/tour/tour-conditions';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import { formatWelcomeCopy, getTourDefinition } from '@/lib/tour/tour-steps';
import {
  advanceAfterStep,
  applyTourStepEnter,
  bindTourStepAdvance,
  isTourActionStep,
  loadTourState,
  offerTourState,
  resolveActivePointer,
  restartChapterState,
  saveTourState,
  setTourForcesQuiet,
  shouldPauseTour,
  skipChapterState,
  skipTourState,
  startTourState,
  type ActiveTourPointer,
} from '@/lib/tour/tour-store';
import type { TourId, TourRect, TourState, TourTargetId } from '@/lib/tour/tour-types';
import { loadDeviceSession } from '@/lib/device/device-session';
import { loadOnboardingPrefs } from '@/lib/onboarding-prefs';
import { useOrbitOptional } from '@/store/orbit-store';

type ScrollFn = ((y: number) => void) | null;

type TourRegistry = {
  activeTargetId: TourTargetId | null;
  registerTarget: (id: TourTargetId, rect: TourRect) => void;
  unregisterTarget: (id: TourTargetId) => void;
  registerScroll: (fn: ScrollFn) => void;
  startTour: (tourId?: TourId) => void;
  startChapter: (tourId: TourId, chapterId: string) => void;
  showChecklist: () => void;
  hideChecklist: () => void;
  checklistVisible: boolean;
  tourState: TourState | null;
  /** True when an in_progress tour is waiting for the user to continue on Home. */
  awaitingContinue: boolean;
  continueTour: () => void;
};

const TourRegistryContext = createContext<TourRegistry | null>(null);

export function useTourRegistry(): TourRegistry | null {
  return useContext(TourRegistryContext);
}

export function useTourControls(): TourRegistry | null {
  return useContext(TourRegistryContext);
}

const JOINED_FLAG = 'orbit.tour.joinedAdult.v1';

async function readJoinedFlag(householdId: string, memberId: string): Promise<boolean> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const v = await AsyncStorage.getItem(`${JOINED_FLAG}.${householdId}.${memberId}`);
    return v === '1';
  } catch {
    return false;
  }
}

export async function markJoinedAdultTour(householdId: string, memberId: string): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(`${JOINED_FLAG}.${householdId}.${memberId}`, '1');
  } catch {
    /* ignore */
  }
}

export function TourProvider({ children }: PropsWithChildren) {
  const orbit = useOrbitOptional();
  const pathname = usePathname();
  const navRef = useNavigationContainerRef();
  const household = orbit?.household;
  const currentMember = orbit?.currentMember;
  const analyticsContext = {
    householdId: household?.id,
    userId: currentMember?.userId ?? currentMember?.id,
  };

  const [tourState, setTourState] = useState<TourState | null>(null);
  const [tourId, setTourId] = useState<TourId>('admin');
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  /** Overlay only runs after an explicit start/continue this session — never auto-resume. */
  const [sessionActive, setSessionActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [hostKind, setHostKind] = useState<'sidekick' | 'shared-tablet' | null>(null);
  const [checklistForced, setChecklistForced] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const targetsRef = useRef(new Map<TourTargetId, TourRect>());
  const scrollRef = useRef<ScrollFn>(null);
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<View>(null);
  const hydratedKey = useRef<string | null>(null);
  const pointerRef = useRef<ActiveTourPointer | null>(null);
  const watchdogStreakRef = useRef(0);
  const analyticsContextRef = useRef(analyticsContext);
  analyticsContextRef.current = analyticsContext;

  const conditionCtx: TourConditionContext = useMemo(() => {
    const first = household?.tasks?.[0];
    const segmentCount =
      (showRewards(household!) ? 1 : 0) +
      (showAllowance(household!) ? 1 : 0) +
      (showRanks(household!) ? 1 : 0);
    return {
      household: household ?? ({ members: [], tasks: [], rewards: [] } as never),
      currentMember,
      hostKind,
      firstTaskNeedsProof: Boolean(first?.proofRequired),
      rewardSegmentCount: household ? segmentCount : 0,
    };
  }, [household, currentMember, hostKind]);

  const persist = useCallback(
    async (next: TourState) => {
      if (!household?.id || !currentMember?.id) return;
      setTourState(next);
      await saveTourState(household.id, currentMember.id, next);
    },
    [household?.id, currentMember?.id]
  );

  // Hydrate per member
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!household?.id || !currentMember?.id) return;
      const session = await loadDeviceSession();
      const joined = await readJoinedFlag(household.id, currentMember.id);
      const prefs = await loadOnboardingPrefs();
      const resolved = resolveTourId({
        household,
        currentMember,
        hostKind: session.hostKind ?? null,
        joinedViaInvite: joined,
      });
      // Family iPad face-picker tour is separate and short; sidekick still gets their tour after.
      const activeId: TourId =
        session.hostKind === 'shared-tablet' && session.needsProfilePick
          ? 'family_ipad'
          : resolved;

      const key = `${household.id}:${currentMember.id}:${activeId}`;
      if (hydratedKey.current === key) return;
      hydratedKey.current = key;

      if (!cancelled) {
        setHostKind(session.hostKind ?? null);
        setTourId(activeId);
      }

      let state = await loadTourState(household.id, currentMember.id, activeId);
      if (state.status === 'not_started') {
        const upgrade = isUpgradeHousehold(household, {
          onboardingCompletedAt: prefs?.completedAt,
        });
        if (upgrade) {
          state = offerTourState(activeId);
          await saveTourState(household.id, currentMember.id, state);
          void trackAnalytics('tour.offered', { tourId: activeId, reason: 'upgrade' }, analyticsContext);
        } else {
          // New household — show welcome on Home.
          if (!cancelled) setWelcomeOpen(true);
          void trackAnalytics('tour.offered', { tourId: activeId, reason: 'new' }, analyticsContext);
        }
      } else if (state.status === 'offered') {
        // Upgrade card handled on Home; do not auto-open welcome.
      } else if (state.status === 'in_progress') {
        // Never auto-resume — Home shows "Continue the tour".
        if (!cancelled) setSessionActive(false);
      }

      if (!cancelled) setTourState(state);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [household, currentMember?.id, analyticsContext]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const activeStep =
    tourState && tourState.status === 'in_progress' && !welcomeOpen && sessionActive
      ? resolveActivePointer(tourState, conditionCtx)
      : null;
  const actionStep = isTourActionStep(activeStep?.step);
  const actionStepRef = useRef(actionStep);
  actionStepRef.current = actionStep;

  const pointer = activeStep && !paused ? activeStep : null;
  pointerRef.current = pointer;

  // Pause when IUI live / keyboard — except during an action step (that is the action).
  useEffect(() => {
    const sync = () => {
      const live = poppinsUiOrchestrator.getState().live;
      setPaused(
        shouldPauseTour({
          actionStep: actionStepRef.current,
          stageLive: live,
          keyboardVisible: Keyboard.isVisible(),
        })
      );
    };
    const unsub = poppinsUiOrchestrator.subscribe(sync);
    const show = Keyboard.addListener('keyboardDidShow', sync);
    const hide = Keyboard.addListener('keyboardDidHide', sync);
    return () => {
      unsub();
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (actionStep) setPaused(false);
  }, [actionStep]);

  // Force Quiet during Poppins action step
  useEffect(() => {
    const force = pointer?.step.onEnter === 'forceQuietSpeak';
    setTourForcesQuiet(Boolean(force));
    return () => setTourForcesQuiet(false);
  }, [pointer?.step.id, pointer?.step.onEnter]);

  // Navigate + wait for target — only when the navigator is ready.
  useEffect(() => {
    if (!pointer) {
      setTargetRect(null);
      return;
    }

    try {
      void trackAnalytics(
        'tour.step_viewed',
        {
          tourId: pointer.tourId,
          chapterId: pointer.chapter.id,
          stepIndex: pointer.stepIndex,
        },
        analyticsContextRef.current
      );

      if (!reduceMotion) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      }

      applyTourStepEnter(pointer.step.onEnter);

      const route = pointer.step.route;
      const onRoute =
        pathname === route ||
        pathname?.endsWith(route.replace('/(tabs)', '')) ||
        (route === '/(tabs)' &&
          (pathname === '/' || pathname === '/index' || pathname?.includes('(tabs)')));

      if (!onRoute) {
        if (!navRef.isReady()) {
          return;
        }
        try {
          router.navigate(route as never);
        } catch (error) {
          console.warn('tour.navigate', error);
          void trackAnalytics(
            'tour.navigate_failed',
            { route, message: error instanceof Error ? error.message : String(error) },
            analyticsContextRef.current
          );
        }
      }

      if (pointer.step.centered) {
        setTargetRect({ x: 24, y: 160, width: 280, height: 48 });
        return;
      }

      if (pointer.step.ensureVisible && scrollRef.current) {
        const existing = targetsRef.current.get(pointer.step.targetId);
        if (existing) scrollRef.current(existing.y);
      }

      if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
      const started = Date.now();
      const poll = () => {
        try {
          const rect = targetsRef.current.get(pointer.step.targetId);
          if (rect && rect.width > 0) {
            setTargetRect(rect);
            const node = findNodeHandle(cardRef.current);
            if (node) {
              AccessibilityInfo.setAccessibilityFocus(node);
            }
            return;
          }
          if (Date.now() - started > 1500) {
            void trackAnalytics(
              'tour.step_skipped_missing_target',
              {
                tourId: pointer.tourId,
                chapterId: pointer.chapter.id,
                targetId: pointer.step.targetId,
              },
              analyticsContextRef.current
            );
            if (tourState) {
              const next = advanceAfterStep(tourState, conditionCtx, { skipStep: true });
              void persist(next);
            }
            return;
          }
          waitTimerRef.current = setTimeout(poll, 80);
        } catch (error) {
          console.warn('tour.waitTarget', error);
        }
      };
      waitTimerRef.current = setTimeout(poll, 60);
    } catch (error) {
      console.warn('tour.stepEffect', error);
    }

    return () => {
      if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointer?.step.id, pathname, paused, sessionActive]);

  // Listen for event advances from tour state so a pause cannot drop the event.
  useEffect(() => {
    if (!tourState) return;
    return bindTourStepAdvance({
      state: tourState,
      ctx: conditionCtx,
      onAdvance: (next) => {
        void persist(next);
      },
    });
  }, [tourState, conditionCtx, persist]);

  // Action steps advance once the user leaves the current route (they tapped the target).
  useEffect(() => {
    if (!pointer || !tourState) return;
    if (pointer.step.advance.kind !== 'action') return;
    const stepRoute = pointer.step.route;
    const stillOnStep =
      pathname === stepRoute ||
      (stepRoute === '/(tabs)' && (pathname === '/' || pathname?.includes('index'))) ||
      pathname?.includes(stepRoute.replace('/(tabs)', '').replace(/^\//, ''));
    // Only advance when we have moved away from the step's home route.
    if (stillOnStep && pathname?.includes(stepRoute.split('/').pop() ?? '___')) return;
    if (pathname === stepRoute) return;
    // Special-case: assign button lives on tasks; tapping opens /assign-task.
    if (
      pointer.step.targetId === 'tasks.assignButton' &&
      (pathname?.includes('assign-task') || pathname?.includes('assign-homework'))
    ) {
      void persist(advanceAfterStep(tourState, conditionCtx));
      return;
    }
    if (pointer.step.targetId === 'selectProfile.faces' && !pathname?.includes('select-profile')) {
      void persist(advanceAfterStep(tourState, conditionCtx));
    }
  }, [pathname, pointer?.step.id, tourState, conditionCtx, persist]);

  const registerTarget = useCallback((id: TourTargetId, rect: TourRect) => {
    targetsRef.current.set(id, rect);
    if (pointerRef.current?.step.targetId === id) {
      setTargetRect(rect);
    }
  }, []);

  const unregisterTarget = useCallback((id: TourTargetId) => {
    targetsRef.current.delete(id);
  }, []);

  const registerScroll = useCallback((fn: ScrollFn) => {
    scrollRef.current = fn;
  }, []);

  const dismissModalsThen = useCallback(async (run: () => void) => {
    try {
      if (router.canDismiss()) {
        router.dismissAll();
      }
    } catch (error) {
      console.warn('tour.dismissAll', error);
    }
    // Wait until the root navigator is ready and tabs can receive focus.
    for (let i = 0; i < 30; i++) {
      if (navRef.isReady()) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!navRef.isReady()) {
      console.warn('tour.start aborted — navigator not ready');
      return;
    }
    try {
      router.navigate('/(tabs)' as never);
    } catch (error) {
      console.warn('tour.navigate tabs', error);
    }
    await new Promise((r) => setTimeout(r, 120));
    run();
  }, [navRef]);

  const startTour = useCallback(
    (id?: TourId) => {
      const tid = id ?? tourId;
      void dismissModalsThen(() => {
        const next = startTourState(tid);
        setTourId(tid);
        setWelcomeOpen(false);
        setSessionActive(true);
        watchdogStreakRef.current = 0;
        void persist(next);
        void trackAnalytics('tour.started', { tourId: tid }, analyticsContextRef.current);
      });
    },
    [tourId, persist, dismissModalsThen]
  );

  const startChapter = useCallback(
    (id: TourId, chapterId: string) => {
      void dismissModalsThen(() => {
        const next = restartChapterState(id, chapterId);
        setTourId(id);
        setWelcomeOpen(false);
        setSessionActive(true);
        watchdogStreakRef.current = 0;
        void persist(next);
        void trackAnalytics(
          'tour.started',
          { tourId: id, chapterId },
          analyticsContextRef.current
        );
      });
    },
    [persist, dismissModalsThen]
  );

  const continueTour = useCallback(() => {
    setSessionActive(true);
    watchdogStreakRef.current = 0;
  }, []);

  const handleNext = useCallback(() => {
    if (!tourState) return;
    const ptr = pointerRef.current;
    if (ptr?.step.primaryAction === 'open_settings') {
      void persist(skipTourState(tourState));
      setSessionActive(false);
      setWelcomeOpen(false);
      try {
        if (navRef.isReady()) router.push('/settings' as never);
      } catch (error) {
        console.warn('tour.open_settings', error);
      }
      return;
    }
    watchdogStreakRef.current = 0;
    const next = advanceAfterStep(tourState, conditionCtx);
    if (next.status === 'completed') {
      setSessionActive(false);
      const started = tourState.startedAt ? Date.parse(tourState.startedAt) : Date.now();
      void trackAnalytics(
        'tour.completed',
        { tourId: tourState.tourId, durationMs: Date.now() - started },
        analyticsContextRef.current
      );
    }
    void persist(next);
  }, [tourState, conditionCtx, persist, navRef]);

  const handleSkipChapter = useCallback(() => {
    if (!tourState) return;
    void trackAnalytics(
      'tour.chapter_skipped',
      { tourId: tourState.tourId, chapterId: tourState.chapterId },
      analyticsContext
    );
    void persist(skipChapterState(tourState, conditionCtx));
  }, [tourState, conditionCtx, persist, analyticsContext]);

  const handleSkipStep = useCallback(() => {
    if (!tourState) return;
    void persist(advanceAfterStep(tourState, conditionCtx, { skipStep: true }));
  }, [tourState, conditionCtx, persist]);

  const handleClose = useCallback(() => {
    if (!tourState) return;
    void trackAnalytics(
      'tour.dismissed',
      { tourId: tourState.tourId, atChapter: tourState.chapterId },
      analyticsContextRef.current
    );
    void persist(skipTourState(tourState));
    setWelcomeOpen(false);
    setSessionActive(false);
  }, [tourState, persist]);

  const handleTourCrash = useCallback(() => {
    if (!tourState) {
      setWelcomeOpen(false);
      setSessionActive(false);
      return;
    }
    void persist(skipTourState(tourState));
    setWelcomeOpen(false);
    setSessionActive(false);
  }, [persist, tourState]);

  const handleWatchdogSkip = useCallback(() => {
    if (!tourState) return;
    watchdogStreakRef.current += 1;
    if (watchdogStreakRef.current >= 2) {
      void trackAnalytics(
        'tour.aborted_invisible_card',
        { tourId: tourState.tourId, chapterId: tourState.chapterId },
        analyticsContextRef.current
      );
      void persist(skipTourState(tourState));
      setSessionActive(false);
      return;
    }
    void persist(advanceAfterStep(tourState, conditionCtx, { skipStep: true }));
  }, [tourState, conditionCtx, persist]);

  const handleCardReady = useCallback(() => {
    watchdogStreakRef.current = 0;
  }, []);

  const handleWelcomeSkip = useCallback(() => {
    const base = tourState ?? startTourState(tourId);
    void persist(skipTourState(base));
    setWelcomeOpen(false);
    void trackAnalytics('tour.dismissed', { tourId, atChapter: 'welcome' }, analyticsContext);
  }, [tourState, tourId, persist, analyticsContext]);

  const showChecklist = useCallback(() => {
    if (!tourState) return;
    setChecklistForced(true);
    void persist({ ...tourState, checklistHidden: false });
  }, [tourState, persist]);

  const hideChecklist = useCallback(() => {
    if (!tourState) return;
    setChecklistForced(false);
    void persist({ ...tourState, checklistHidden: true });
  }, [tourState, persist]);

  const def = getTourDefinition(tourId);
  const welcomeTitle = formatWelcomeCopy(def.welcomeTitle, {
    householdName: household?.householdName ?? household?.greetingName,
    name: currentMember?.name?.split(' ')[0],
    ownerName: household ? ownerName(household) : undefined,
  });
  const welcomeBody = formatWelcomeCopy(def.welcomeBody, {
    householdName: household?.householdName,
    name: currentMember?.name?.split(' ')[0],
    ownerName: household ? ownerName(household) : undefined,
  });

  const checklistVisible =
    checklistForced ||
    Boolean(
      tourState &&
        (tourState.status === 'completed' || tourState.status === 'skipped') &&
        !tourState.checklistHidden &&
        orbit?.permissions.canManageHousehold
    );

  const isAction =
    pointer?.step.advance.kind === 'action' ||
    pointer?.step.advance.kind === 'event';
  const isLast =
    Boolean(pointer) &&
    pointer!.chapter.id === getTourDefinition(pointer!.tourId).chapters.slice(-1)[0]?.id &&
    pointer!.stepIndex === pointer!.stepsInChapter - 1;

  const awaitingContinue =
    Boolean(tourState?.status === 'in_progress') && !sessionActive && !welcomeOpen;

  const registry = useMemo<TourRegistry>(
    () => ({
      activeTargetId: pointer?.step.targetId ?? null,
      registerTarget,
      unregisterTarget,
      registerScroll,
      startTour,
      startChapter,
      showChecklist,
      hideChecklist,
      checklistVisible,
      tourState,
      awaitingContinue,
      continueTour,
    }),
    [
      pointer?.step.targetId,
      registerTarget,
      unregisterTarget,
      registerScroll,
      startTour,
      startChapter,
      showChecklist,
      hideChecklist,
      checklistVisible,
      tourState,
      awaitingContinue,
      continueTour,
    ]
  );

  // Finish step uses a centered target — synthesize a rect if missing
  useEffect(() => {
    if (pointer?.step.targetId === 'tour.finish' && !targetsRef.current.has('tour.finish')) {
      registerTarget('tour.finish', { x: 40, y: 180, width: 300, height: 40 });
    }
  }, [pointer?.step.targetId, registerTarget]);

  return (
    <TourRegistryContext.Provider value={registry}>
      {children}
      <TourErrorBoundary onCrash={handleTourCrash}>
        <TourWelcome
          visible={welcomeOpen && Boolean(household?.id && currentMember?.id)}
          title={welcomeTitle}
          body={welcomeBody}
          primaryLabel={def.welcomePrimary}
          secondaryLabel={def.welcomeSecondary}
          onStart={() => startTour(tourId)}
          onSkip={handleWelcomeSkip}
        />
        {pointer && !paused ? (
          <TourOverlay
            target={pointer.step.centered ? null : targetRect}
            chapterName={pointer.chapter.name}
            title={pointer.step.title}
            body={pointer.step.body}
            stepLabel={`${pointer.stepOrdinal} of ${pointer.stepsInChapter}`}
            stepIndex={pointer.stepIndex}
            stepsInChapter={pointer.stepsInChapter}
            isAction={isAction}
            isLast={isLast}
            centered={Boolean(pointer.step.centered)}
            primaryLabel={pointer.step.primaryLabel}
            cardRef={cardRef}
            onNext={handleNext}
            onSkipChapter={handleSkipChapter}
            onSkipStep={handleSkipStep}
            onClose={handleClose}
            onWatchdogSkip={handleWatchdogSkip}
            onCardReady={handleCardReady}
          />
        ) : null}
      </TourErrorBoundary>
    </TourRegistryContext.Provider>
  );
}
