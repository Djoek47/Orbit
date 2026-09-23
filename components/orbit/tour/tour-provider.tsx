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
import { speakAs } from '@/lib/ai/majordomo-name';
import { useMajordomoName } from '@/lib/ai/use-majordomo-name';
import {
  buildTourPracticeTaskInput,
  householdHasOpenTourPractice,
  pickTourPracticeAssignee,
} from '@/lib/tour/tour-demo-task';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import { formatWelcomeCopy, getTourDefinition } from '@/lib/tour/tour-steps';
import {
  advanceAfterStep,
  applyTourStepEnter,
  bindTourStepAdvance,
  isTourActionStep,
  loadTourState,
  resolveActivePointer,
  restartChapterState,
  retreatBeforeStep,
  saveTourState,
  setTourForcesQuiet,
  shouldPauseTour,
  completeTourState,
  skipChapterState,
  skipTourState,
  startTourState,
  tourCanRetreat,
  tourRouteMatches,
  type ActiveTourPointer,
} from '@/lib/tour/tour-store';
import type { TourId, TourRect, TourState, TourTargetId } from '@/lib/tour/tour-types';
import { loadDeviceSession } from '@/lib/device/device-session';
import { loadOnboardingPrefs } from '@/lib/onboarding-prefs';
import { recoverStuckTourIfNeeded, markTourSessionHealthy } from '@/lib/tour/tour-crash-recovery';
import { hydrateTourEnabled, isTourEnabledSync } from '@/lib/tour/tour-enabled';
import { runHydrateTourPass } from '@/lib/tour/tour-hydrate';
import { useOrbitOptional } from '@/store/orbit-store';

type ScrollFn = ((y: number) => void) | null;

type TourRegistry = {
  activeTargetId: TourTargetId | null;
  /** Step id even while the overlay is paused over Assign. */
  activeStepId: string | null;
  /** True while the first-run tour session is running. */
  sessionActive: boolean;
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
  /** Hide Continue / offer cards for good. Replay stays in Settings. */
  dismissTourPrompt: () => void;
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
  const majordomoName = useMajordomoName();
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
  const [tourEnabled, setTourEnabled] = useState(isTourEnabledSync());
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
  const inFlightKey = useRef<string | null>(null);
  const pointerRef = useRef<ActiveTourPointer | null>(null);
  const watchdogStreakRef = useRef(0);
  /** Saw Assign while on tasks.form — used to seed if they back out without creating. */
  const assignFormSeenRef = useRef(false);
  const tourStateRef = useRef<TourState | null>(null);
  const analyticsContextRef = useRef(analyticsContext);
  analyticsContextRef.current = analyticsContext;
  tourStateRef.current = tourState;

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
      const householdId = household.id;
      const memberId = currentMember.id;
      // Lock before any await so a second effect cannot start recover().
      const memberKey = `${householdId}:${memberId}`;
      if (
        inFlightKey.current === memberKey ||
        inFlightKey.current?.startsWith(`${memberKey}:`)
      ) {
        return;
      }
      inFlightKey.current = memberKey;
      let key = memberKey;
      try {
        const session = await loadDeviceSession();
        const joined = await readJoinedFlag(householdId, memberId);
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

        key = `${memberKey}:${activeId}`;
        if (hydratedKey.current === key) return;
        inFlightKey.current = key;

        if (!cancelled) {
          setHostKind(session.hostKind ?? null);
          setTourId(activeId);
        }

        const enabled = await hydrateTourEnabled();
        if (!cancelled) setTourEnabled(enabled);
        if (!enabled) {
          if (!cancelled) {
            setTourState(null);
            setWelcomeOpen(false);
            setSessionActive(false);
            hydratedKey.current = key;
          }
          return;
        }

        const result = await runHydrateTourPass({
          key,
          flight: {
            begin: (k) => (inFlightKey.current === k ? {} : false),
            end: () => undefined,
            isInFlight: (k) => inFlightKey.current === k,
          },
          cancelled: () => cancelled,
          recover: () => recoverStuckTourIfNeeded(householdId, memberId),
          loadState: () => loadTourState(householdId, memberId, activeId),
          saveState: (state) => saveTourState(householdId, memberId, state),
          trackOffered: (reason) => {
            void trackAnalytics(
              'tour.offered',
              { tourId: activeId, reason },
              analyticsContextRef.current
            );
          },
          isUpgrade: isUpgradeHousehold(household, {
            onboardingCompletedAt: prefs?.completedAt,
          }),
          tourId: activeId,
        });

        if (cancelled || result.skippedInFlight) return;

        if (result.recovered) {
          void trackAnalytics(
            'tour.recovered_stuck',
            { reason: result.reason },
            analyticsContextRef.current
          );
        }

        if (!result.state) return;

        if (result.openWelcome) {
          setWelcomeOpen(true);
        } else if (result.state.status === 'in_progress') {
          // Never auto-resume — Home shows "Continue the tour".
          setSessionActive(false);
        }

        setTourState(result.state);
        hydratedKey.current = key;
      } finally {
        if (inFlightKey.current === memberKey || inFlightKey.current === key) {
          inFlightKey.current = null;
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [household, currentMember?.id]);

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

  // Assign form step: never show the coach card on the sheet — the presets are the guide.
  const overlayPointer =
    pointer && pointer.step.id !== 'tasks.form' ? pointer : null;

  // Pause when IUI live / keyboard — except during an action step (that is the action).
  // Always pause on Assign / Create modals so the coach card never sits on the form.
  useEffect(() => {
    const onAssignModal =
      Boolean(pathname?.includes('assign-task')) ||
      Boolean(pathname?.includes('assign-homework')) ||
      Boolean(pathname?.includes('create-task'));

    const sync = () => {
      if (onAssignModal) {
        setPaused(true);
        return;
      }
      const live = poppinsUiOrchestrator.getState().live;
      setPaused(
        shouldPauseTour({
          actionStep: actionStepRef.current,
          stageLive: live,
          keyboardVisible: Keyboard.isVisible(),
        })
      );
    };
    sync();
    const unsub = poppinsUiOrchestrator.subscribe(sync);
    const show = Keyboard.addListener('keyboardDidShow', sync);
    const hide = Keyboard.addListener('keyboardDidHide', sync);
    return () => {
      unsub();
      show.remove();
      hide.remove();
    };
  }, [pathname]);

  useEffect(() => {
    const onAssignModal =
      Boolean(pathname?.includes('assign-task')) ||
      Boolean(pathname?.includes('assign-homework')) ||
      Boolean(pathname?.includes('create-task'));
    // Never clear pause while Assign is open — even for event/action steps.
    if (onAssignModal) {
      setPaused(true);
      return;
    }
    if (actionStep) setPaused(false);
  }, [actionStep, pathname]);

  // Reset dismiss-seed latch when leaving the form step.
  useEffect(() => {
    if (activeStep?.step.id !== 'tasks.form') {
      assignFormSeenRef.current = false;
    }
  }, [activeStep?.step.id]);

  // Open Assign for the form step even when the coach card is hidden/paused.
  useEffect(() => {
    if (!sessionActive || !activeStep) return;
    if (activeStep.step.id !== 'tasks.form') return;
    const onAssign =
      Boolean(pathname?.includes('assign-task')) ||
      Boolean(pathname?.includes('assign-homework'));
    if (onAssign || !navRef.isReady()) return;
    try {
      router.push('/assign-task' as never);
    } catch (error) {
      console.warn('tour.openAssign', error);
    }
  }, [activeStep?.step.id, pathname, sessionActive, navRef]);

  // Force Quiet during Poppins action step
  useEffect(() => {
    const force = pointer?.step.onEnter === 'forceQuietSpeak';
    setTourForcesQuiet(Boolean(force));
    return () => setTourForcesQuiet(false);
  }, [pointer?.step.id, pointer?.step.onEnter]);

  const ensureTourPracticeTask = useCallback(async () => {
    if (!orbit?.createTask || !household) return;
    if (householdHasOpenTourPractice(household.tasks ?? [])) return;
    // Prefer a Sidekick so Press-and-hold later matches a real kid chore.
    const assignee = pickTourPracticeAssignee(household.members ?? []);
    if (!assignee) return;
    const input = buildTourPracticeTaskInput(household, assignee);
    if (!input) return;
    try {
      await orbit.createTask(input);
    } catch (error) {
      console.warn('tour.practiceTask', error);
    }
  }, [orbit, household]);

  // Navigate + wait for target — only when the navigator is ready.
  useEffect(() => {
    if (!pointer) {
      setTargetRect(null);
      return;
    }
    setTargetRect(null);

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

      if (pointer.step.id === 'tasks.form') {
        const onAssign =
          pathname?.includes('assign-task') || pathname?.includes('assign-homework');
        if (!onAssign && navRef.isReady()) {
          try {
            router.push('/assign-task' as never);
          } catch (error) {
            console.warn('tour.openAssign', error);
          }
        }
      }

      if (pointer.step.id === 'tasks.hold') {
        void ensureTourPracticeTask();
      }

      const route = pointer.step.route;
      let navigated = tourRouteMatches(pathname, route);
      const goToStep = () => {
        if (navigated || !navRef.isReady()) return;
        try {
          router.navigate(route as never);
          navigated = true;
        } catch (error) {
          console.warn('tour.navigate', error);
          void trackAnalytics(
            'tour.navigate_failed',
            { route, message: error instanceof Error ? error.message : String(error) },
            analyticsContextRef.current
          );
        }
      };

      goToStep();

      if (pointer.step.centered) {
        setTargetRect({ x: 24, y: 160, width: 280, height: 48 });
        return;
      }

      if (pointer.step.ensureVisible && scrollRef.current) {
        const existing = targetsRef.current.get(pointer.step.targetId);
        if (existing) scrollRef.current(existing.y);
      }

      if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
      let deadline = Date.now() + 1800;
      const poll = () => {
        try {
          const wasNavigated = navigated;
          goToStep();
          if (!wasNavigated && navigated) deadline = Date.now() + 1400;
          const rect = targetsRef.current.get(pointer.step.targetId);
          if (rect && rect.width > 0) {
            if (pointer.step.ensureVisible && scrollRef.current) {
              scrollRef.current(rect.y);
            }
            setTargetRect(rect);
            const node = findNodeHandle(cardRef.current);
            if (node) {
              AccessibilityInfo.setAccessibilityFocus(node);
            }
            return;
          }
          if (Date.now() > deadline) {
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

  // Action steps advance from activeStep (not the visible pointer). Pausing the
  // overlay on Assign would otherwise null the pointer and stall the chapter.
  useEffect(() => {
    if (!activeStep || !tourState || !sessionActive) return;
    if (activeStep.step.advance.kind !== 'action') return;
    const stepRoute = activeStep.step.route;
    if (pathname === stepRoute) return;
    // Special-case: assign button lives on tasks; tapping opens /assign-task.
    if (
      activeStep.step.targetId === 'tasks.assignButton' &&
      (pathname?.includes('assign-task') || pathname?.includes('assign-homework'))
    ) {
      void persist(advanceAfterStep(tourState, conditionCtx));
      return;
    }
    if (
      activeStep.step.targetId === 'selectProfile.faces' &&
      !pathname?.includes('select-profile')
    ) {
      void persist(advanceAfterStep(tourState, conditionCtx));
    }
  }, [pathname, activeStep?.step.id, tourState, conditionCtx, persist, sessionActive]);

  // Left Assign without creating — seed a practice chore; task_created advances the form step.
  useEffect(() => {
    if (!activeStep || !sessionActive) return;
    if (activeStep.step.id !== 'tasks.form') return;
    const onAssign =
      Boolean(pathname?.includes('assign-task')) ||
      Boolean(pathname?.includes('assign-homework')) ||
      Boolean(pathname?.includes('create-task'));
    if (onAssign) {
      assignFormSeenRef.current = true;
      return;
    }
    if (!assignFormSeenRef.current) return;
    assignFormSeenRef.current = false;
    const timer = setTimeout(() => {
      const latest = tourStateRef.current;
      if (!latest) return;
      // Real Assign already moved us on via task_created.
      if (resolveActivePointer(latest, conditionCtx)?.step.id !== 'tasks.form') return;
      void ensureTourPracticeTask();
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname, activeStep?.step.id, conditionCtx, sessionActive, ensureTourPracticeTask]);

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

  const dismissTourPrompt = useCallback(() => {
    if (!tourState) return;
    setWelcomeOpen(false);
    setSessionActive(false);
    void persist({ ...skipTourState(tourState), checklistHidden: true });
    void trackAnalytics(
      'tour.dismissed',
      { tourId: tourState.tourId, atChapter: tourState.chapterId ?? 'continue' },
      analyticsContextRef.current
    );
  }, [persist, tourState]);

  const handleBack = useCallback(() => {
    if (!tourState) return;
    watchdogStreakRef.current = 0;
    void persist(retreatBeforeStep(tourState, conditionCtx));
  }, [tourState, conditionCtx, persist]);

  const handleNext = useCallback(() => {
    if (!tourState) return;
    const ptr = pointerRef.current;
    if (ptr?.step.primaryAction === 'open_settings') {
      void persist(completeTourState(tourState));
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
    void (async () => {
      if (tourState.chapterId === 'tasks') {
        await ensureTourPracticeTask();
      }
      void persist(skipChapterState(tourState, conditionCtx));
    })();
  }, [tourState, conditionCtx, persist, analyticsContext, ensureTourPracticeTask]);

  const handleSkipStep = useCallback(() => {
    if (!tourState) return;
    const ptr = resolveActivePointer(tourState, conditionCtx);
    void (async () => {
      if (ptr?.step.id === 'tasks.form') {
        // Seeding emits task_created, which advances the form step — do not skip twice.
        await ensureTourPracticeTask();
        return;
      }
      if (ptr?.step.id === 'tasks.assign') {
        await ensureTourPracticeTask();
      }
      void persist(advanceAfterStep(tourState, conditionCtx, { skipStep: true }));
    })();
  }, [tourState, conditionCtx, persist, ensureTourPracticeTask]);

  const handleClose = useCallback(() => {
    setWelcomeOpen(false);
    setSessionActive(false);
    if (!tourState) return;
    void trackAnalytics(
      'tour.dismissed',
      { tourId: tourState.tourId, atChapter: tourState.chapterId },
      analyticsContextRef.current
    );
    // Exit is for good: no Continue card, and no Getting Started leftover.
    void persist({ ...skipTourState(tourState), checklistHidden: true });
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
    void markTourSessionHealthy();
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
        tourState.status === 'skipped' &&
        !tourState.checklistHidden &&
        orbit?.permissions.canManageHousehold
    );

  const canGoBack = Boolean(tourState && tourCanRetreat(tourState, conditionCtx));

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
      activeStepId: activeStep?.step.id ?? null,
      sessionActive,
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
      dismissTourPrompt,
    }),
    [
      pointer?.step.targetId,
      activeStep?.step.id,
      sessionActive,
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
      dismissTourPrompt,
    ]
  );

  // Finish step uses a centered target — synthesize a rect if missing
  useEffect(() => {
    if (pointer?.step.targetId === 'tour.finish' && !targetsRef.current.has('tour.finish')) {
      registerTarget('tour.finish', { x: 40, y: 180, width: 300, height: 40 });
    }
  }, [pointer?.step.targetId, registerTarget]);

  if (!tourEnabled) {
    return (
      <TourRegistryContext.Provider value={registry}>
        {children}
      </TourRegistryContext.Provider>
    );
  }

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
        {overlayPointer && !paused ? (
          <TourOverlay
            target={overlayPointer.step.centered ? null : targetRect}
            chapterName={speakAs(majordomoName, overlayPointer.chapter.name)}
            title={speakAs(majordomoName, overlayPointer.step.title)}
            body={speakAs(majordomoName, overlayPointer.step.body)}
            stepLabel={`${overlayPointer.stepOrdinal} of ${overlayPointer.stepsInChapter}`}
            stepIndex={overlayPointer.stepIndex}
            stepsInChapter={overlayPointer.stepsInChapter}
            isAction={isAction}
            isLast={isLast}
            centered={Boolean(overlayPointer.step.centered)}
            primaryLabel={overlayPointer.step.primaryLabel}
            cardRef={cardRef}
            onNext={handleNext}
            onBack={canGoBack ? handleBack : undefined}
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
