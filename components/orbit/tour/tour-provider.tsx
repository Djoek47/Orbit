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
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TourErrorBoundary } from '@/components/orbit/tour/tour-error-boundary';
import { TourDemoPanel } from '@/components/orbit/tour/tour-demo-panel';
import { TourOverlay } from '@/components/orbit/tour/tour-overlay';
import type { TourScrollHandle } from '@/components/orbit/tour/use-tour-scroll';
import { demoForStep, type TourDemoId } from '@/lib/tour/tour-demos';
import { planTourScroll, targetScrolls, tourScreenKey } from '@/lib/tour/tour-scroll';
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
  howToStepsToTourSteps,
  setAdHocTourHooks,
  type AdHocTourOptions,
} from '@/lib/tour/ad-hoc-tour';
import { isCoachDoItSpeech, isCoachStopSpeech } from '@/lib/poppins/how-to';
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
import type { TourId, TourRect, TourState, TourStep, TourTargetId } from '@/lib/tour/tour-types';
import { loadDeviceSession } from '@/lib/device/device-session';
import { loadOnboardingPrefs } from '@/lib/onboarding-prefs';
import { recoverStuckTourIfNeeded, markTourSessionHealthy } from '@/lib/tour/tour-crash-recovery';
import { hydrateTourEnabled, isTourEnabledSync } from '@/lib/tour/tour-enabled';
import { runHydrateTourPass } from '@/lib/tour/tour-hydrate';
import { useOrbitOptional } from '@/store/orbit-store';


type TourRegistry = {
  activeTargetId: TourTargetId | null;
  /** Step id even while the overlay is paused over Assign. */
  activeStepId: string | null;
  /** True while the first-run tour session is running. */
  sessionActive: boolean;
  registerTarget: (id: TourTargetId, rect: TourRect) => void;
  unregisterTarget: (id: TourTargetId) => void;
  /** Each tab registers the ScrollView the tour may move, under its own screen key. */
  registerScroll: (screenKey: string, handle: TourScrollHandle | null) => void;
  startTour: (tourId?: TourId) => void;
  startChapter: (tourId: TourId, chapterId: string) => void;
  /** WO12 §D3 — walk-through from a how-to, reusing the same overlay. */
  startAdHocTour: (opts: AdHocTourOptions) => void;
  stopAdHocTour: () => void;
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

const MAIN_TAB_PATHS = new Set(['/', '/tasks', '/plan', '/calendar', '/rewards', '/poppins', '/groceries']);

/** Main app screens (the tabs), where the first-run welcome may appear. */
export function isMainAppPath(pathname: string | null | undefined): boolean {
  return MAIN_TAB_PATHS.has(pathname ?? '');
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** How long an animated scroll takes to settle before the card is placed. */
const SCROLL_SETTLE_MS = 460;
/** How long a step waits for its target after arriving on the screen. */
const TARGET_WAIT_MS = 2600;

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
  /** A demonstration playing in the tour's own panel (never a route). */
  const [demo, setDemo] = useState<TourDemoId | null>(null);
  /** The step has arrived, scrolled and measured — only now does the card show. */
  const [stepReady, setStepReady] = useState(false);
  const { height: screenH } = useWindowDimensions();
  const safeInsets = useSafeAreaInsets();
  const [adHoc, setAdHoc] = useState<{
    steps: TourStep[];
    index: number;
    returnRoute: string;
    canDoItForYou: boolean;
    onDoItForMe?: () => void;
    title?: string;
  } | null>(null);

  const targetsRef = useRef(new Map<TourTargetId, TourRect>());
  const scrollHandles = useRef(new Map<string, TourScrollHandle>());
  /** When each target last reported — a rect from before the step began may be another screen's. */
  const targetSeenAt = useRef(new Map<TourTargetId, number>());
  const stepStartedAt = useRef(0);
  /** While the page scrolls into place the card waits, instead of chasing the target. */
  const settlingRef = useRef(false);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<View>(null);
  const hydratedKey = useRef<string | null>(null);
  const inFlightKey = useRef<string | null>(null);
  const pointerRef = useRef<ActiveTourPointer | null>(null);
  const watchdogStreakRef = useRef(0);
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

  const adHocPointer: ActiveTourPointer | null = useMemo(() => {
    if (!adHoc || !adHoc.steps.length) return null;
    const step = adHoc.steps[Math.min(adHoc.index, adHoc.steps.length - 1)];
    if (!step) return null;
    return {
      tourId: 'admin',
      chapter: {
        id: 'adhoc',
        name: adHoc.title ? `Step` : 'Walkthrough',
        steps: adHoc.steps,
      },
      chapterIndex: 0,
      step,
      stepIndex: Math.min(adHoc.index, adHoc.steps.length - 1),
      stepOrdinal: Math.min(adHoc.index, adHoc.steps.length - 1) + 1,
      stepsInChapter: adHoc.steps.length,
    };
  }, [adHoc]);

  const activeStep =
    adHocPointer ??
    (tourState && tourState.status === 'in_progress' && !welcomeOpen && sessionActive
      ? resolveActivePointer(tourState, conditionCtx)
      : null);
  const actionStep = isTourActionStep(activeStep?.step);
  const actionStepRef = useRef(actionStep);
  actionStepRef.current = actionStep;
  const activeStepIdRef = useRef(activeStep?.step.id);
  activeStepIdRef.current = activeStep?.step.id;

  // While a demonstration plays, no step is active: nothing navigates, nothing measures.
  const pointer = activeStep && !demo && (!paused || Boolean(adHoc)) ? activeStep : null;
  pointerRef.current = pointer;
  const isAdHoc = Boolean(adHoc);

  // Pause when the Poppins stage is live or the keyboard is up — except during a step that asks
  // for exactly that (typing a grocery, saying something).
  useEffect(() => {
    const sync = () => {
      const live = poppinsUiOrchestrator.getState().live;
      // A live stage used to pause a plain "read this" step, which hid the card and left the
      // person with no way on. A step that only wants to be read asks the stage to stand down.
      if (live && !actionStepRef.current && activeStepIdRef.current?.startsWith('poppins.')) {
        poppinsUiOrchestrator.pause();
        setPaused(false);
        return;
      }
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
  }, [activeStep?.step.id]);

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

  const onStepRoute = pointer ? tourRouteMatches(pathname, pointer.step.route) : false;

  // 1 · Navigation. The only place the tour moves between screens, and only when the step
  // changes — never on a pathname change, which is what used to yank people back and stack a
  // second copy of the app over whatever had just opened. Anything presented is closed first.
  useEffect(() => {
    if (!pointer) return;
    stepStartedAt.current = Date.now();
    void trackAnalytics(
      'tour.step_viewed',
      { tourId: pointer.tourId, chapterId: pointer.chapter.id, stepIndex: pointer.stepIndex },
      analyticsContextRef.current
    );
    if (!reduceMotion) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    const route = pointer.step.route;
    if (tourRouteMatches(pathnameRef.current, route)) return;
    let cancelled = false;
    void (async () => {
      for (let i = 0; i < 30 && !navRef.isReady(); i += 1) await sleep(50);
      if (cancelled || !navRef.isReady()) return;
      try {
        if (router.canDismiss()) {
          router.dismissAll();
          await sleep(380);
        }
      } catch (error) {
        console.warn('tour.dismissAll', error);
      }
      if (cancelled || tourRouteMatches(pathnameRef.current, route)) return;
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
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointer?.step.id]);

  // 2 · Arrive. Once the step's screen is showing: switch the screen to the right section, wait
  // for the target, scroll it to the middle of the free space, let the scroll settle, measure
  // again — and only then show the card. Leaving the screen (a sheet opened from the target)
  // hides the card; coming back brings it back. Nothing here navigates.
  useEffect(() => {
    setStepReady(false);
    setTargetRect(null);
    settlingRef.current = false;
    if (!pointer || !onStepRoute) return;
    const step = pointer.step;
    applyTourStepEnter(step.onEnter);
    if (step.id === 'tasks.hold') void ensureTourPracticeTask();
    if (step.centered) {
      setStepReady(true);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let scrolled = false;
    const arrivedAt = Date.now();
    const fresh = () => {
      const rect = targetsRef.current.get(step.targetId);
      const seen = targetSeenAt.current.get(step.targetId) ?? 0;
      return rect && rect.width > 0 && seen >= arrivedAt ? rect : null;
    };
    const poll = () => {
      if (cancelled) return;
      // Screens mount lazily: say which section to show again until the target is there.
      applyTourStepEnter(step.onEnter);
      const rect = fresh();
      if (rect) {
        if (!scrolled && targetScrolls(step.targetId)) {
          scrolled = true;
          const handle = scrollHandles.current.get(tourScreenKey(step.route));
          const next = handle
            ? planTourScroll({
                target: rect,
                offset: handle.getOffset(),
                screenH,
                insets: { top: safeInsets.top, bottom: safeInsets.bottom },
              })
            : null;
          if (handle && next != null) {
            settlingRef.current = true;
            handle.scrollTo(next);
            timer = setTimeout(() => {
              settlingRef.current = false;
              poll();
            }, reduceMotion ? 120 : SCROLL_SETTLE_MS);
            return;
          }
        }
        setTargetRect(rect);
        setStepReady(true);
        const node = findNodeHandle(cardRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
        return;
      }
      if (Date.now() - arrivedAt > TARGET_WAIT_MS) {
        void trackAnalytics(
          'tour.step_skipped_missing_target',
          { tourId: pointer.tourId, chapterId: pointer.chapter.id, targetId: step.targetId },
          analyticsContextRef.current
        );
        if (adHoc) {
          setAdHoc((prev) => {
            if (!prev) return null;
            const nextIndex = prev.index + 1;
            return nextIndex >= prev.steps.length ? null : { ...prev, index: nextIndex };
          });
        } else if (tourStateRef.current) {
          void persist(advanceAfterStep(tourStateRef.current, conditionCtx, { skipStep: true }));
        }
        return;
      }
      timer = setTimeout(poll, 80);
    };
    // A beat for the section switch to render before the first measure.
    timer = setTimeout(poll, 120);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      settlingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointer?.step.id, onStepRoute]);

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
    if (!activeStep) return;
    if (!adHoc && (!tourState || !sessionActive)) return;
    if (activeStep.step.advance.kind !== 'action') return;
    const stepRoute = activeStep.step.route;
    const stillOnStep =
      pathname === stepRoute ||
      (stepRoute === '/(tabs)' && (pathname === '/' || pathname?.includes('index'))) ||
      pathname?.includes(stepRoute.replace('/(tabs)', '').replace(/^\//, ''));
    // Only advance when we have moved away from the step's home route.
    if (stillOnStep && pathname?.includes(stepRoute.split('/').pop() ?? '___')) return;
    if (pathname === stepRoute) return;
    if (adHoc) {
      setAdHoc((prev) => {
        if (!prev) return null;
        const nextIndex = prev.index + 1;
        if (nextIndex >= prev.steps.length) return null;
        return { ...prev, index: nextIndex };
      });
      return;
    }
    if (!tourState) return;
    if (
      activeStep.step.targetId === 'selectProfile.faces' &&
      !pathname?.includes('select-profile')
    ) {
      void persist(advanceAfterStep(tourState, conditionCtx));
    }
  }, [pathname, activeStep?.step.id, tourState, conditionCtx, persist, sessionActive, adHoc]);

  const registerTarget = useCallback((id: TourTargetId, rect: TourRect) => {
    targetsRef.current.set(id, rect);
    targetSeenAt.current.set(id, Date.now());
    if (pointerRef.current?.step.targetId !== id) return;
    // Mid-scroll the card waits; it is placed once the page has settled.
    if (settlingRef.current) return;
    // This runs every frame while a step is pointing at something. Only publish a real
    // move: a fresh object each frame re-rendered the screen, and a screen that sets
    // navigation options while rendering then looped until React gave up
    // ("Maximum update depth exceeded").
    setTargetRect((current) => {
      if (
        current &&
        Math.abs(current.x - rect.x) < 0.5 &&
        Math.abs(current.y - rect.y) < 0.5 &&
        Math.abs(current.width - rect.width) < 0.5 &&
        Math.abs(current.height - rect.height) < 0.5
      ) {
        return current;
      }
      return rect;
    });
  }, []);

  const unregisterTarget = useCallback((id: TourTargetId) => {
    targetsRef.current.delete(id);
  }, []);

  const registerScroll = useCallback((screenKey: string, handle: TourScrollHandle | null) => {
    if (handle) scrollHandles.current.set(screenKey, handle);
    else scrollHandles.current.delete(screenKey);
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
      setAdHoc(null);
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

  const stopAdHocTour = useCallback(() => {
    const route = adHoc?.returnRoute ?? '/(tabs)/poppins';
    setAdHoc(null);
    setSessionActive(false);
    try {
      if (navRef.isReady()) router.navigate(route as never);
    } catch (error) {
      console.warn('tour.adhoc.return', error);
    }
  }, [adHoc?.returnRoute, navRef]);

  const advanceAdHoc = useCallback(() => {
    setAdHoc((prev) => {
      if (!prev) return null;
      const nextIndex = prev.index + 1;
      if (nextIndex >= prev.steps.length) {
        const route = prev.returnRoute;
        queueMicrotask(() => {
          try {
            if (navRef.isReady()) router.navigate(route as never);
          } catch {
            /* ignore */
          }
        });
        return null;
      }
      return { ...prev, index: nextIndex };
    });
  }, [navRef]);

  const startAdHocTour = useCallback(
    (opts: AdHocTourOptions) => {
      const steps = howToStepsToTourSteps(opts.steps, opts.title);
      if (!steps.length) return;
      setWelcomeOpen(false);
      setSessionActive(true);
      watchdogStreakRef.current = 0;
      setAdHoc({
        steps,
        index: 0,
        returnRoute: opts.returnRoute ?? '/(tabs)/poppins',
        canDoItForYou: opts.canDoItForYou === true,
        onDoItForMe: opts.onDoItForMe,
        title: opts.title,
      });
      const first = steps[0];
      if (first?.route && navRef.isReady()) {
        try {
          router.navigate(first.route as never);
        } catch (error) {
          console.warn('tour.adhoc.navigate', error);
        }
      }
    },
    [navRef]
  );

  const handleAdHocDoIt = useCallback(() => {
    const cb = adHoc?.onDoItForMe;
    if (cb) {
      cb();
      stopAdHocTour();
      return;
    }
    advanceAdHoc();
  }, [adHoc?.onDoItForMe, advanceAdHoc, stopAdHocTour]);

  useEffect(() => {
    setAdHocTourHooks({
      startAdHocTour,
      stopAdHocTour,
      isAdHocActive: () => Boolean(adHoc),
      handleSpeech: (text) => {
        if (!adHoc) return false;
        if (isCoachStopSpeech(text)) {
          stopAdHocTour();
          return true;
        }
        if (isCoachDoItSpeech(text)) {
          handleAdHocDoIt();
          return true;
        }
        return false;
      },
    });
    return () => setAdHocTourHooks(null);
  }, [adHoc, startAdHocTour, stopAdHocTour, handleAdHocDoIt]);

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
    if (adHoc) {
      advanceAdHoc();
      return;
    }
    if (!tourState) return;
    const ptr = pointerRef.current;
    // A demonstration plays in the tour's own panel. The tour stays on this step until the
    // panel closes (closeDemo), so nothing navigates while it plays.
    const demoId = demoForStep(ptr?.step);
    if (demoId) {
      setDemo(demoId);
      return;
    }
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
  }, [adHoc, advanceAdHoc, tourState, conditionCtx, persist, navRef]);

  /** The demo closed: carry on to the step after the one that opened it. */
  const closeDemo = useCallback(() => {
    setDemo(null);
    const latest = tourStateRef.current;
    if (!latest) return;
    const next = advanceAfterStep(latest, conditionCtx);
    if (next.status === 'completed') setSessionActive(false);
    void persist(next);
  }, [conditionCtx, persist]);

  const handleSkipChapter = useCallback(() => {
    if (adHoc) {
      stopAdHocTour();
      return;
    }
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
  }, [adHoc, stopAdHocTour, tourState, conditionCtx, persist, analyticsContext, ensureTourPracticeTask]);

  const handleSkipStep = useCallback(() => {
    if (adHoc) {
      advanceAdHoc();
      return;
    }
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
  }, [adHoc, advanceAdHoc, tourState, conditionCtx, persist, ensureTourPracticeTask]);

  const handleClose = useCallback(() => {
    setDemo(null);
    if (adHoc) {
      stopAdHocTour();
      return;
    }
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
  }, [adHoc, stopAdHocTour, tourState, persist]);

  const handleTourCrash = useCallback(() => {
    if (adHoc) {
      setAdHoc(null);
      setSessionActive(false);
      return;
    }
    if (!tourState) {
      setWelcomeOpen(false);
      setSessionActive(false);
      return;
    }
    void persist(skipTourState(tourState));
    setWelcomeOpen(false);
    setSessionActive(false);
  }, [adHoc, persist, tourState]);

  const handleWatchdogSkip = useCallback(() => {
    if (adHoc) {
      advanceAdHoc();
      return;
    }
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
  }, [adHoc, advanceAdHoc, tourState, conditionCtx, persist]);

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

  const advanceKind = pointer?.step.advance.kind;
  /** Only tap-the-spotlight steps lock the rest of the screen. */
  const lockCutout = advanceKind === 'action';
  /** Event steps still use the action skip label, but keep the UI interactive. */
  const isAction = advanceKind === 'action' || advanceKind === 'event';
  const isLast = isAdHoc
    ? Boolean(pointer && pointer.stepIndex >= pointer.stepsInChapter - 1)
    : Boolean(pointer) &&
      pointer!.chapter.id === getTourDefinition(pointer!.tourId).chapters.slice(-1)[0]?.id &&
      pointer!.stepIndex === pointer!.stepsInChapter - 1;

  const awaitingContinue =
    Boolean(tourState?.status === 'in_progress') && !sessionActive && !welcomeOpen && !adHoc;

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
      startAdHocTour,
      stopAdHocTour,
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
      startAdHocTour,
      stopAdHocTour,
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

  // flex:1 host so inline TourOverlay absoluteFill covers the navigator and
  // info-step pans reach the ScrollView underneath (no FullWindowOverlay).
  // Ad-hoc teaching tours stay visible even when the first-run tour is off.
  const cardPointer = pointer && stepReady ? pointer : null;
  return (
    <TourRegistryContext.Provider value={registry}>
      <View style={{ flex: 1 }} collapsable={false}>
        {children}
        {tourEnabled || isAdHoc ? (
          <TourErrorBoundary onCrash={handleTourCrash}>
            {tourEnabled ? (
              <TourWelcome
                // Only once they're in the app itself. The household exists partway through
                // setup (invites, places…); opening there stacked two screens' words.
                visible={
                  welcomeOpen &&
                  Boolean(household?.id && currentMember?.id) &&
                  isMainAppPath(pathname)
                }
                title={welcomeTitle}
                body={welcomeBody}
                primaryLabel={def.welcomePrimary}
                secondaryLabel={def.welcomeSecondary}
                onStart={() => startTour(tourId)}
                onSkip={handleWelcomeSkip}
              />
            ) : null}
            {cardPointer && (!paused || isAdHoc) ? (
              <TourOverlay
                target={cardPointer.step.centered ? null : targetRect}
                chapterName={
                  isAdHoc
                    ? `Step ${cardPointer.stepOrdinal} of ${cardPointer.stepsInChapter}`
                    : speakAs(majordomoName, cardPointer.chapter.name)
                }
                title={speakAs(majordomoName, cardPointer.step.title)}
                body={speakAs(majordomoName, cardPointer.step.body)}
                stepLabel={
                  isAdHoc
                    ? `Step ${cardPointer.stepOrdinal} of ${cardPointer.stepsInChapter}`
                    : `${cardPointer.stepOrdinal} of ${cardPointer.stepsInChapter}`
                }
                stepIndex={cardPointer.stepIndex}
                stepsInChapter={cardPointer.stepsInChapter}
                isAction={isAction}
                lockCutout={lockCutout}
                interactiveTarget={isAction}
                isLast={isLast}
                centered={Boolean(cardPointer.step.centered)}
                primaryLabel={cardPointer.step.primaryLabel}
                adHoc={isAdHoc}
                canDoItForYou={adHoc?.canDoItForYou === true}
                onDoItForMe={isAdHoc ? handleAdHocDoIt : undefined}
                closeLabel={isAdHoc ? 'Stop the tour' : undefined}
                cardRef={cardRef}
                onNext={handleNext}
                onBack={canGoBack && !isAdHoc ? handleBack : undefined}
                onSkipChapter={handleSkipChapter}
                onSkipStep={handleSkipStep}
                onClose={handleClose}
                onWatchdogSkip={handleWatchdogSkip}
                onCardReady={handleCardReady}
              />
            ) : null}
            {demo ? (
              <TourDemoPanel demo={demo} reduceMotion={reduceMotion} onClose={closeDemo} />
            ) : null}
          </TourErrorBoundary>
        ) : null}
      </View>
    </TourRegistryContext.Provider>
  );
}
