/**
 * Everything the Poppins tab does, without any layout.
 *
 * The screen used to be one 2,000-line component where capture, the live session, the turn
 * pipeline and the layout were tangled together. This hook owns the behaviour; the screen
 * only arranges what it returns. Transport code (quiet capture, the realtime session) is
 * ported unchanged — it worked. What changed:
 *
 *  - Max plans an act only from the FINAL transcript, never from partial deltas.
 *  - Every spoken or typed utterance begins a turn (turn-ownership.ts), and model plans
 *    arrive as `source: 'model'`, so one request can never become two acts.
 *  - Pending confirmations go to the stage's confirm card only — the second, modal sheet
 *    is gone — and a pending act the person's own words already staged is closed with the
 *    model instead of being asked twice.
 *  - Switching Base ↔ Max clears errors and any stale chain from the other tier.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { TOKENS_PER_DAY, TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import { stageAccent } from '@/constants/iui-stage';
import { POPPINS_PAUSED_COPY } from '@/lib/ai/credits';
import {
  buildActEvent,
  notifyActUndone,
  personalActTokens,
  summarizeActUsage,
} from '@/lib/ai/act-events';
import { getMajordomoProfile, resolveMajordomoProfileId } from '@/lib/ai/majordomo-profiles';
import { filterDuplicateUiActions } from '@/lib/poppins/act-ledger';
import { driveAiuic, hearAndDrive } from '@/lib/poppins/aiuic';
import { resolveBaseUtterance } from '@/lib/poppins/base-utterance';
import { parseCompoundHouseholdIntent } from '@/lib/poppins/clause-segment';
import { preferLocalOnPlanMismatch } from '@/lib/poppins/context-precedence';
import {
  isContinuityFresh,
  loadIuiContinuity,
  openActSnapshot,
  rememberTurn,
  saveIuiContinuity,
  snapshotFromDrive,
  type IuiContinuity,
} from '@/lib/poppins/iui-continuity';
import { copyIuiVoiceError } from '@/lib/poppins/iui-voice-error';
import { drainPreviewFill, turnActCost } from '@/lib/poppins/orb-levels';
import {
  DEFAULT_POPPINS_INTERACTION_PREFS,
  prefsForTier,
  savePoppinsInteractionPrefs,
  subscribePoppinsPrefs,
  type PoppinsInteractionPrefs,
} from '@/lib/poppins/poppins-prefs';
import {
  getSessionActMode,
  setSessionActMode,
  setSessionSelfName,
} from '@/lib/poppins/session-act-mode';
import { commitSpeakOpen, hydrateHouseMemory, prepareSpeakOpen } from '@/lib/poppins/speak-open';
import { stageHeaderLabel } from '@/lib/poppins/stage-header';
import { poppinsUiOrchestrator, usePoppinsUiDrive } from '@/lib/poppins/ui-orchestrator';
import { HOLD_MS_DEFAULT, HOLD_MS_KID } from '@/lib/poppins/ui-scenes';
import { canShowPoppinsTab } from '@/lib/sidekick/permissions';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { greetingWord } from '@/lib/time/greeting';
import { tourForcesQuietSpeak } from '@/lib/tour/tour-store';
import {
  isPoppinsNativeVoiceAvailable,
  PoppinsVoiceSession,
  waitForPendingVoiceNativeSettle,
  type PoppinsVoiceVisualState,
} from '@/lib/voice/poppins-voice-session';
import {
  createQuietCapture,
  QUIET_FAILURE_MESSAGES,
  type QuietCapture,
} from '@/lib/voice/quiet-capture';
import { persistVoiceFailure } from '@/lib/voice/quiet-failures';
import { micUiForPrefs, quietCaptureAvailable, speakTransportForPrefs } from '@/lib/voice/speak-transport';
import {
  applyLiveCaptionTurn,
  captionWindow,
  type LiveCaption,
} from '@/lib/voice/transcript-merge';
import type { HouseholdTask } from '@/types/orbit';
import { useOrbit } from '@/store/orbit-store';

export type PoppinsVisualState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success';
export type CaptureMode = 'hold' | 'tap10';
export type TurnInputSource = 'typed' | 'dictated';
export type NothingHeard = null | 'no_audio' | 'too_short' | 'transcribe_failed' | 'empty_transcript';

const VOICE_FAILURE_CAUSES: ReadonlySet<string> = new Set([
  'ai_off',
  'signed_out',
  'whisper_failed',
  'budget_tripped',
]);

const TAP10_MS = 10_000;

/** Server tools whose confirmations the stage's HOLD already answers. */
const HOLD_WRITE_TOOLS = new Set([
  'create_task_draft',
  'assign_task',
  'create_task',
  'add_grocery',
  'complete_task',
  'create_calendar_event',
  'create_itinerary',
  'update_task',
  'claim_reward',
]);

export function usePoppinsController() {
  const { c, isDark } = useOrbitColors();
  const {
    appendPoppinsTurn,
    askPoppins,
    household,
    currentMember,
    permissions,
    actEvents,
    poppinsConversation,
    recordPoppinsUsage,
    recordActEvent,
    metrics,
    orbitPalette,
    deleteTask,
    deleteEvent,
    updateTask,
    removeGroceryItem,
    removeSavedPlace,
    rejectAllowance,
    addMissingGrocery,
  } = useOrbit();

  const majordomo = useMemo(() => {
    const id = resolveMajordomoProfileId({
      householdProfileId: household.majordomoProfileId,
      memberProfileId: currentMember?.majordomoProfileId,
    });
    return getMajordomoProfile(id);
  }, [currentMember?.majordomoProfileId, household.majordomoProfileId]);

  const nativeVoice = isPoppinsNativeVoiceAvailable();
  const [topUpBalance, setTopUpBalance] = useState(0);
  const [interactionPrefs, setInteractionPrefs] = useState<PoppinsInteractionPrefs>(
    DEFAULT_POPPINS_INTERACTION_PREFS
  );
  const quietRef = useRef<QuietCapture | null>(null);
  const quietStoppingRef = useRef(false);
  const [quietListening, setQuietListening] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>(null);
  const captureModeRef = useRef<CaptureMode | null>(null);
  const longPressArmedRef = useRef(false);
  const tapTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tapSecondsLeft, setTapSecondsLeft] = useState<number | null>(null);
  const [capSecondsLeft, setCapSecondsLeft] = useState<number | null>(null);
  const [holdTip, setHoldTip] = useState<string | null>(null);
  const [waveLevelDb, setWaveLevelDb] = useState<number | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  /** Absolute user-turn ordinal → how it was entered (session only). */
  const sourceByUserOrdinal = useRef(new Map<number, TurnInputSource>());
  const [sourceEpoch, setSourceEpoch] = useState(0);
  const [nothingHeard, setNothingHeard] = useState<NothingHeard>(null);

  const micUi = useMemo(
    () =>
      micUiForPrefs(tourForcesQuietSpeak() ? false : interactionPrefs.speakBack, {
        quiet: quietCaptureAvailable(),
        realtime: nativeVoice,
      }),
    [interactionPrefs.speakBack, nativeVoice]
  );

  useEffect(() => {
    setSessionSelfName(currentMember?.name);
  }, [currentMember?.name]);

  useEffect(() => {
    return subscribePoppinsPrefs(household.id, (prefs) => {
      setInteractionPrefs(prefs);
    });
  }, [household.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { loadTokenGrants, topUpBalanceFromGrants } = await import('@/lib/billing/token-grants');
      const grants = await loadTokenGrants(household.id);
      if (!cancelled) setTopUpBalance(topUpBalanceFromGrants(grants));
    })();
    return () => {
      cancelled = true;
    };
  }, [household.id, actEvents]);

  const aiSummary = useMemo(
    () =>
      summarizeActUsage(
        actEvents,
        household.members.map((member) => ({ id: member.id, name: member.name })),
        { topUpBalance }
      ),
    [actEvents, household.members, topUpBalance]
  );

  useEffect(() => {
    poppinsUiOrchestrator.setUndoHandler(async (beat, reverse) => {
      if (reverse) {
        const { reverseIuiCommit } = await import('@/lib/poppins/iui-reverse');
        await reverseIuiCommit(reverse, {
          deleteTask,
          deleteEvent,
          removeGroceryItem,
          updateTask,
          removeSavedPlace,
          rejectAllowance,
          addMissingGrocery,
        });
      }
      await notifyActUndone(beat.id, beat.payload.write, beat.payload.actMode);
    });
    return () => {
      poppinsUiOrchestrator.setUndoHandler(null);
    };
  }, [
    deleteTask,
    deleteEvent,
    updateTask,
    removeGroceryItem,
    removeSavedPlace,
    rejectAllowance,
    addMissingGrocery,
  ]);

  const [threadOpen, setThreadOpen] = useState(() => micUi.preferKeyboard);
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [listening, setListening] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [voiceSettling, setVoiceSettling] = useState(false);
  const [error, setError] = useState('');
  const [voiceState, setVoiceState] = useState<PoppinsVoiceVisualState>('idle');
  const voiceStateRef = useRef<PoppinsVoiceVisualState>('idle');
  voiceStateRef.current = voiceState;
  const [liveCaption, setLiveCaption] = useState<LiveCaption | null>(null);
  const [toolFlash, setToolFlash] = useState<string | null>(null);
  const voiceRef = useRef<PoppinsVoiceSession | null>(null);
  const householdRef = useRef(household);
  householdRef.current = household;
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);
  const drive = usePoppinsUiDrive();
  const kidSession = currentMember?.role === 'child';
  const memberNames = useMemo(
    () => household.members.map((member) => member.name),
    [household.members]
  );
  const memberNamesRef = useRef(memberNames);
  memberNamesRef.current = memberNames;
  const kidSessionRef = useRef(kidSession);
  kidSessionRef.current = kidSession;
  const voiceFailedRef = useRef(false);
  const lastUtteranceRef = useRef('');
  const billedSpeakRef = useRef(false);
  const voiceSessionIdRef = useRef<string | null>(null);
  const voiceTurnIndexRef = useRef(0);
  const continuityRef = useRef<IuiContinuity | null>(null);
  const wasLiveRef = useRef(false);

  useEffect(() => {
    if (micUi.preferKeyboard) setThreadOpen(true);
  }, [micUi.preferKeyboard]);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearInterval(tapTimerRef.current);
    };
  }, []);

  const clearTapTimer = () => {
    if (tapTimerRef.current) {
      clearInterval(tapTimerRef.current);
      tapTimerRef.current = null;
    }
    setTapSecondsLeft(null);
  };

  const rememberInputSource = (source: TurnInputSource) => {
    const ordinal = poppinsConversation.filter((m) => m.role === 'user').length;
    sourceByUserOrdinal.current.set(ordinal, source);
    setSourceEpoch((n) => n + 1);
  };

  const persistContinuity = (patch?: IuiContinuity) => {
    const householdId = household.id;
    if (!householdId) return;
    const next =
      patch ??
      snapshotFromDrive(continuityRef.current, householdId, poppinsUiOrchestrator.getState());
    continuityRef.current = next;
    void saveIuiContinuity(next);
  };

  const holdMsForSession = () => (kidSessionRef.current ? HOLD_MS_KID : HOLD_MS_DEFAULT);

  const restoreOpenAct = (record: IuiContinuity | null, opts?: { resumeHold?: boolean }) => {
    const snap = openActSnapshot(record, holdMsForSession());
    if (!snap) return false;
    poppinsUiOrchestrator.restore(snap, { resumeHold: opts?.resumeHold === true });
    return true;
  };

  const surfaceVoiceError = (raw: unknown) => {
    voiceFailedRef.current = true;
    const copy = copyIuiVoiceError(raw);
    console.warn('[poppins-voice] surface', copy.kind, copy.detail || raw);
    setError(copy.message);
    if (copy.kind === 'mic_denied') setThreadOpen(true);
    setConnecting(false);
    setLiveConnected(false);
    setVoiceState('idle');
    setListening(false);
    setRemoteStreamUrl(null);
    try {
      voiceRef.current?.disconnect();
    } catch {
      /* already down */
    }
    voiceRef.current = null;
  };

  const flashToolSuccess = (label: string) => {
    setToolFlash(label);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setToolFlash(null), 1600);
  };

  const mapVisual = (state: PoppinsVoiceVisualState): PoppinsVisualState => {
    if (state === 'needs_attention' || state === 'connecting') return 'thinking';
    if (state === 'listening' || state === 'thinking' || state === 'speaking') return state;
    return 'idle';
  };

  const visualState: PoppinsVisualState = toolFlash
    ? 'success'
    : mapVisual(voiceState) !== 'idle'
      ? mapVisual(voiceState)
      : listening
        ? 'listening'
        : asking || connecting
          ? 'thinking'
          : 'idle';

  const STATE_CONFIG: Record<PoppinsVisualState, { label: string; color: string }> = {
    idle: {
      label: micUi.micEnabled
        ? `${majordomo.displayName} · Hold to speak`
        : `${majordomo.displayName} · Ready`,
      color: majordomo.accent,
    },
    listening: { label: `${majordomo.displayName} · Listening`, color: '#34D399' },
    thinking: { label: `${majordomo.displayName} · Thinking…`, color: '#A78BFA' },
    speaking: { label: `${majordomo.displayName} · Speaking`, color: '#38BDF8' },
    success: { label: `${majordomo.displayName} · Done`, color: '#34D399' },
  };
  const cfg = connecting
    ? { label: `${majordomo.displayName} · Tuning in…`, color: '#A78BFA' }
    : STATE_CONFIG[visualState];
  const isActive = visualState !== 'idle' || liveConnected;

  useEffect(() => {
    return () => {
      voiceRef.current?.disconnect();
      voiceRef.current = null;
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    void hydrateHouseMemory(household.id);
  }, [household.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const prior = await loadIuiContinuity(household.id);
      if (cancelled || !prior) return;
      continuityRef.current = prior;
      if (!poppinsUiOrchestrator.getState().live) {
        restoreOpenAct(prior);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once per household
  }, [household.id]);

  useEffect(() => {
    if (wasLiveRef.current && !drive.live) {
      persistContinuity();
    }
    wasLiveRef.current = drive.live;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist on the live→idle edge only
  }, [drive.live]);

  useEffect(() => {
    voiceRef.current?.disconnect();
    voiceRef.current = null;
    setLiveConnected(false);
    setRemoteStreamUrl(null);
  }, [majordomo.id]);

  useEffect(() => {
    poppinsUiOrchestrator.setSpeaking(visualState === 'speaking');
  }, [visualState]);

  useEffect(() => {
    if (visualState === 'speaking') {
      billedSpeakRef.current = true;
      return;
    }
    if (
      billedSpeakRef.current &&
      (visualState === 'listening' || visualState === 'idle') &&
      lastUtteranceRef.current.trim()
    ) {
      billedSpeakRef.current = false;
      if (!voiceSessionIdRef.current) {
        voiceSessionIdRef.current = `live-${household.id}-${Date.now()}`;
      }
      const turnIndex = voiceTurnIndexRef.current;
      voiceTurnIndexRef.current = turnIndex + 1;
      void recordPoppinsUsage('voice', {
        question: lastUtteranceRef.current,
        answer: liveCaption?.text ?? '',
        usage: { model: 'gpt-realtime-2.1' },
        mode: 'spoken',
        sessionId: voiceSessionIdRef.current,
        turnIndex,
      });
    }
  }, [household.id, liveCaption?.text, recordPoppinsUsage, visualState]);

  useEffect(() => {
    // The stage's confirm card answers the model's pending confirmation.
    poppinsUiOrchestrator.setPendingHandler((approved, ids) => {
      voiceRef.current?.notifyConfirmationResolved(ids, approved);
      if (approved) flashToolSuccess('Confirmed');
    });
    const unsubTap = poppinsUiOrchestrator.subscribeTap((tap) => {
      setVoiceState((state) => (state === 'speaking' || state === 'thinking' ? 'listening' : state));
      poppinsUiOrchestrator.setSpeaking(false);
      const iui = poppinsUiOrchestrator.getState();
      const step = iui.playlist[iui.index]?.payload.composeStep;
      const needsReply = tap.kind !== 'confirm' && step !== 'ready';
      voiceRef.current?.notifyStageTap(tap, { needsReply });
    });
    return () => {
      poppinsUiOrchestrator.setPendingHandler(null);
      unsubTap();
    };
  }, []);

  /** The person spoke or typed something final: start a turn and paint the local plan. */
  const planLocally = (text: string) => {
    poppinsUiOrchestrator.beginTurn();
    lastUtteranceRef.current = text;
    continuityRef.current = rememberTurn(continuityRef.current, household.id, {
      role: 'user',
      text,
    });
    void saveIuiContinuity(continuityRef.current);
    hearAndDrive(text, memberNamesRef.current, {
      kid: kidSessionRef.current,
      selfName: currentMember?.name,
      existingTasks: household.tasks,
      userOriginated: true,
    });
  };

  const isEchoOfAssistant = (text: string) => {
    const turns = continuityRef.current?.turns ?? [];
    const lastAssistant = [...turns].reverse().find((t) => t.role === 'assistant')?.text ?? '';
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const a = norm(text);
    const b = norm(lastAssistant);
    return Boolean(a && b && (a === b || (a.length > 8 && b.includes(a)) || (b.length > 8 && a.includes(b))));
  };

  const applyTranscript = (
    role: 'user' | 'assistant',
    text: string,
    meta?: { replace?: boolean; final?: boolean }
  ) => {
    const speaker = role === 'user' ? 'you' : 'poppins';
    setLiveCaption((prev) => applyLiveCaptionTurn(prev, speaker, text, meta?.replace));
    if (!text.trim()) return;
    if (role === 'user') {
      // Partial transcripts drive the caption only. Planning on every delta made the stage
      // reshape itself mid-sentence ("assign" → "assign a task" → …).
      if (!meta?.final) return;
      // Echo guard by content, so a spoken correction over Poppins still lands.
      if (voiceStateRef.current === 'speaking' && isEchoOfAssistant(text)) return;
      planLocally(text);
      return;
    }
    continuityRef.current = rememberTurn(continuityRef.current, household.id, {
      role: 'assistant',
      text,
    });
    void saveIuiContinuity(continuityRef.current);
    poppinsUiOrchestrator.syncSpoken(text, memberNamesRef.current);
  };

  /** A plan from the model. It refines what the person's words staged; it never duplicates. */
  const applyUiActions = (actions: Array<Record<string, unknown>>, replace = false) => {
    if (!actions.length) return;
    const onlyMemberPick = actions.every((a) => {
      const t = String(a.type ?? '');
      return t === 'member_pick' || t === 'list_members';
    });
    const local = parseCompoundHouseholdIntent(lastUtteranceRef.current, {
      memberNames: memberNamesRef.current,
      selfName: currentMember?.name,
      existingTasks: household.tasks,
    });
    // Groceries never ask "who".
    if (onlyMemberPick && local.some((a) => String(a.type) === 'add_grocery')) return;
    const preferred = preferLocalOnPlanMismatch(local, actions);
    const deduped = filterDuplicateUiActions(preferred.actions);
    if (!deduped.length) return;
    driveAiuic(deduped, lastUtteranceRef.current, {
      kid: kidSessionRef.current,
      replace,
      existingTasks: household.tasks,
      memberNames: memberNamesRef.current,
      selfName: currentMember?.name,
      source: 'model',
    });
    persistContinuity();
  };

  const connectNativeVoice = async () => {
    if (tourForcesQuietSpeak()) return null; // The tour never opens Realtime.
    if (voiceRef.current?.isConnected) return voiceRef.current;
    if (voiceSettling) return null;
    setConnecting(true);
    setError('');
    setLiveCaption(null);
    setSessionActMode('spoken');
    voiceFailedRef.current = false;
    voiceSessionIdRef.current = `live-${household.id}-${Date.now()}`;
    voiceTurnIndexRef.current = 0;
    const prep = await prepareSpeakOpen(household, metrics);
    continuityRef.current = prep.continuity;
    restoreOpenAct(prep.continuity);
    let reportedError = false;
    const session = new PoppinsVoiceSession({
      getHousehold: () => householdRef.current,
      stageShowsAct: () => poppinsUiOrchestrator.getState().live,
      onStateChange: (state) => {
        if (voiceFailedRef.current && state !== 'idle') return;
        setVoiceState(state);
        setLiveConnected(
          state === 'listening' ||
            state === 'speaking' ||
            state === 'thinking' ||
            state === 'needs_attention'
        );
      },
      onTranscript: applyTranscript,
      onPendingConfirmations: (items) => {
        const handled = items.filter((item) =>
          poppinsUiOrchestrator.stageHasActFor(item.tool, item.args ?? {})
        );
        const autoApprove = items.filter(
          (item) => !handled.includes(item) && HOLD_WRITE_TOOLS.has(item.tool)
        );
        const ask = items.filter((item) => !handled.includes(item) && !autoApprove.includes(item));
        if (handled.length) {
          voiceRef.current?.notifyHandledOnStage(
            handled.map((item) => item.id),
            handled.map((item) => item.summary).join('; ')
          );
        }
        if (autoApprove.length) {
          voiceRef.current?.notifyConfirmationResolved(
            autoApprove.map((item) => item.id),
            true
          );
        }
        if (!ask.length) return;
        setVoiceState('needs_attention');
        applyUiActions(
          ask.map((item) => ({
            type: 'confirm',
            confirmSummary: item.summary,
            confirmationIds: [item.id],
          }))
        );
      },
      onUiActions: applyUiActions,
      onSessionEnd: () => {
        setLiveConnected(false);
        setVoiceState('idle');
        setLiveCaption(null);
        const iui = poppinsUiOrchestrator.getState();
        if (iui.live && (iui.holding || iui.frozen || iui.phase === 'hold' || iui.phase === 'unfold')) {
          poppinsUiOrchestrator.pause();
          persistContinuity();
        } else {
          persistContinuity(snapshotFromDrive(continuityRef.current, household.id, iui));
        }
      },
      onSoftIdlePrompt: () => {
        /* Stay listening. */
      },
      onRemoteStream: setRemoteStreamUrl,
      onError: (message) => {
        reportedError = true;
        surfaceVoiceError(message);
      },
    });
    const ok = await session
      .connect(household, metrics, currentMember?.majordomoProfileId, {
        pageContext: 'poppins tab',
        capabilityProfile: 'Daily',
        openerInstructions: prep.opening.instructions,
        listenPrompt: prep.listenPrompt,
        seedTurns: prep.seedTurns,
        memoryHint: prep.memoryHint,
      })
      .catch((err) => {
        reportedError = true;
        surfaceVoiceError(err);
        return false;
      });
    setConnecting(false);
    if (!ok || reportedError || voiceFailedRef.current) {
      setVoiceSettling(true);
      try {
        session.disconnect();
        await waitForPendingVoiceNativeSettle();
      } finally {
        setVoiceSettling(false);
      }
      if (!reportedError) {
        surfaceVoiceError('start_failed: connect returned false with no onError');
      }
      return null;
    }
    void commitSpeakOpen(prep.memory, prep.opening);
    voiceRef.current = session;
    setLiveConnected(true);
    poppinsUiOrchestrator.unfreeze();
    return session;
  };

  const endNativeVoice = async () => {
    const iui = poppinsUiOrchestrator.getState();
    if (iui.live) poppinsUiOrchestrator.pause();
    persistContinuity();
    setVoiceSettling(true);
    try {
      await voiceRef.current?.end('manual');
    } finally {
      voiceRef.current = null;
      setLiveConnected(false);
      setVoiceState('idle');
      setListening(false);
      setRemoteStreamUrl(null);
      setLiveCaption(null);
      setVoiceSettling(false);
    }
  };

  // Switching tier is a clean slate: no leftover error, notice, or half-finished chain from
  // the other tier. (A card in its Undo window is kept — the person may still want it.)
  const tierRef = useRef(interactionPrefs.speakBack);
  useEffect(() => {
    if (tierRef.current === interactionPrefs.speakBack) return;
    tierRef.current = interactionPrefs.speakBack;
    setError('');
    setStatusNotice(null);
    setNothingHeard(null);
    setHoldTip(null);
    setLiveCaption(null);
    const iui = poppinsUiOrchestrator.getState();
    const inUndo = Boolean(iui.undoUntil && Date.now() < iui.undoUntil);
    if (iui.live && !inUndo) poppinsUiOrchestrator.clear();
    if (!interactionPrefs.speakBack && (voiceRef.current?.isConnected || liveConnected)) {
      void endNativeVoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the tier flip only
  }, [interactionPrefs.speakBack]);

  const submitUtterance = async (text: string, source: TurnInputSource) => {
    const trimmed = text.trim();
    if (!trimmed || asking) return;
    if (source === 'typed') setDraft('');
    rememberInputSource(source);
    const liveSpeak = Boolean(voiceRef.current?.isConnected);
    setSessionActMode(liveSpeak ? 'spoken' : 'silent');
    setLiveCaption(applyLiveCaptionTurn(null, 'you', trimmed, true));
    lastUtteranceRef.current = trimmed;
    setError('');
    setStatusNotice(null);
    setHoldTip(null);

    // Live duplex: the session echoes typed text back as a final transcript, which plans it.
    if (liveSpeak && voiceRef.current?.isConnected) {
      voiceRef.current.sendUserText(trimmed);
      appendPoppinsTurn(trimmed, '(live voice)');
      return;
    }

    poppinsUiOrchestrator.beginTurn();
    setAsking(true);
    if (interactionPrefs.showThinking) setVoiceState('thinking');
    const thinkStarted = Date.now();
    try {
      const resolved = await resolveBaseUtterance(trimmed, {
        memberNames: memberNamesRef.current,
        kid: kidSessionRef.current,
        selfName: currentMember?.name,
        existingTasks: household.tasks,
        ask: askPoppins,
      });

      if (resolved.kind === 'coach' && currentMember) {
        void recordActEvent(
          buildActEvent({
            memberId: currentMember.id,
            memberName: currentMember.name,
            actKind: 'coach',
            mode: 'silent',
            outcome: 'committed',
            utteranceChars: trimmed.length,
          })
        );
      }

      if (interactionPrefs.showThinking && resolved.calledModel) {
        const elapsed = Date.now() - thinkStarted;
        if (elapsed < 400) await new Promise((r) => setTimeout(r, 400 - elapsed));
      }

      setVoiceState('speaking');
      setLiveCaption(applyLiveCaptionTurn(null, 'poppins', resolved.answer, true));
      appendPoppinsTurn(trimmed, resolved.answer);

      if (resolved.kind === 'model') {
        if (resolved.actions?.length) flashToolSuccess(resolved.actions[0]!.label);
        if (resolved.ui_actions?.length) {
          applyUiActions(resolved.ui_actions as Record<string, unknown>[], true);
        }
        if (resolved.modelAnswer) {
          poppinsUiOrchestrator.syncSpoken(resolved.modelAnswer, memberNamesRef.current);
        }
      }
    } catch {
      appendPoppinsTurn(trimmed, '');
      setError(`${majordomo.displayName} could not answer right now. Try again in a moment.`);
    } finally {
      setAsking(false);
      setTimeout(() => setVoiceState('idle'), 1800);
    }
  };

  const handleSend = async () => {
    await submitUtterance(draft, 'typed');
  };

  const resetCaptureUi = () => {
    clearTapTimer();
    setCapSecondsLeft(null);
    setCaptureMode(null);
    captureModeRef.current = null;
    setQuietListening(false);
    setListening(false);
  };

  const startQuietCapture = async (mode: CaptureMode) => {
    if (quietRef.current?.active || quietStoppingRef.current || asking || connecting || voiceSettling) {
      return;
    }
    if (aiSummary.tripped) {
      persistVoiceFailure('budget_tripped');
      setError('');
      setStatusNotice(POPPINS_PAUSED_COPY);
      return;
    }
    setSessionActMode('silent');
    setError('');
    setStatusNotice(null);
    setHoldTip(null);
    setNothingHeard(null);
    setCapSecondsLeft(null);
    setWaveLevelDb(null);
    const capture = createQuietCapture();
    quietRef.current = capture;
    captureModeRef.current = mode;
    setCaptureMode(mode);
    setQuietListening(true);
    setListening(true);
    setVoiceState('listening');
    setLiveCaption(applyLiveCaptionTurn(null, 'you', 'Listening…', true));
    try {
      await capture.start({
        onAutoStop: () => {
          void stopQuietCapture();
        },
        onCapCountdown: (secondsLeft) => setCapSecondsLeft(secondsLeft),
        onLevel: (db) => setWaveLevelDb(db),
        onPartial: (partial) => setLiveCaption(applyLiveCaptionTurn(null, 'you', partial, true)),
        onStatus: (status) => {
          if (status === 'got_it') setLiveCaption(applyLiveCaptionTurn(null, 'you', 'Got it', true));
          if (status === 'transcribing') {
            setVoiceState('thinking');
            setWaveLevelDb(null);
          }
        },
      });
      if (mode === 'tap10') {
        const startedAt = Date.now();
        setTapSecondsLeft(10);
        tapTimerRef.current = setInterval(() => {
          const left = Math.max(0, Math.ceil((TAP10_MS - (Date.now() - startedAt)) / 1000));
          setTapSecondsLeft(left);
          if (left <= 0) {
            clearTapTimer();
            void stopQuietCapture();
          }
        }, 200);
      }
    } catch (err) {
      resetCaptureUi();
      quietRef.current = null;
      setWaveLevelDb(null);
      setVoiceState('idle');
      setError(err instanceof Error ? err.message : 'Could not start listening.');
    }
  };

  const stopQuietCapture = async () => {
    const capture = quietRef.current;
    if (!capture || quietStoppingRef.current) return;
    quietStoppingRef.current = true;
    // Null before the await so an overlapping stop / press-out / cap cannot double-submit.
    quietRef.current = null;
    clearTapTimer();
    setQuietListening(false);
    setListening(false);
    setWaveLevelDb(null);
    try {
      const result = await capture.stop(householdRef.current, metrics);
      setCaptureMode(null);
      captureModeRef.current = null;
      setCapSecondsLeft(null);
      if ('failed' in result) {
        setVoiceState('idle');
        const failed = result.failed;
        const line = QUIET_FAILURE_MESSAGES[failed] ?? "Didn't catch that. Hold while you speak.";
        if (failed === 'too_short') {
          setHoldTip('Hold while you speak');
          setLiveCaption(applyLiveCaptionTurn(null, 'poppins', line, true));
          setNothingHeard(null);
          return;
        }
        if (VOICE_FAILURE_CAUSES.has(failed)) {
          setNothingHeard(null);
          if (failed === 'budget_tripped') {
            setError('');
            setStatusNotice(line);
          } else {
            setStatusNotice(null);
            setError(line);
          }
          setLiveCaption(applyLiveCaptionTurn(null, 'poppins', line, true));
          return;
        }
        setNothingHeard(
          failed === 'no_audio' || failed === 'transcribe_failed' || failed === 'empty_transcript'
            ? failed
            : 'empty_transcript'
        );
        setLiveCaption(applyLiveCaptionTurn(null, 'poppins', line, true));
        return;
      }
      setNothingHeard(null);
      setHoldTip(null);
      setLiveCaption(applyLiveCaptionTurn(null, 'you', result.transcript, true));
      await submitUtterance(result.transcript, 'dictated');
    } catch {
      resetCaptureUi();
      setVoiceState('idle');
      setError('Could not hear that. Try again.');
    } finally {
      quietStoppingRef.current = false;
    }
  };

  const connectOrToggleRealtime = async () => {
    if (voiceSettling) return;
    const { emitTourEvent } = await import('@/lib/tour/tour-events');
    emitTourEvent('poppins_spoke', { phase: 'press' });
    if (liveConnected || voiceRef.current?.isConnected) {
      await endNativeVoice();
      emitTourEvent('poppins_spoke', { phase: 'done' });
      return;
    }
    if (asking || connecting) return;
    if (aiSummary.tripped) {
      persistVoiceFailure('budget_tripped');
      setError('');
      setStatusNotice(POPPINS_PAUSED_COPY);
      return;
    }
    setSessionActMode('spoken');
    await connectNativeVoice();
  };

  const beginQuietMic = async (mode: CaptureMode) => {
    const { emitTourEvent } = await import('@/lib/tour/tour-events');
    emitTourEvent('poppins_spoke', { phase: 'press' });
    if (quietRef.current?.active || quietListening) {
      await stopQuietCapture();
      emitTourEvent('poppins_spoke', { phase: 'done' });
      return;
    }
    if (liveConnected || voiceRef.current?.isConnected) await endNativeVoice();
    await startQuietCapture(mode);
  };

  const currentTransport = () =>
    speakTransportForPrefs(tourForcesQuietSpeak() ? false : interactionPrefs.speakBack);

  const onMicLongPress = () => {
    if (voiceSettling || !micUi.micEnabled) return;
    longPressArmedRef.current = true;
    if (currentTransport() === 'quiet') {
      void beginQuietMic('hold');
      return;
    }
    void connectOrToggleRealtime();
  };

  const onMicPressOut = () => {
    if (captureModeRef.current === 'hold' && (quietRef.current?.active || quietListening)) {
      void stopQuietCapture();
    }
    // After a long press RN never fires onPress — clear so the next tap works.
    if (longPressArmedRef.current) {
      requestAnimationFrame(() => {
        longPressArmedRef.current = false;
      });
    }
  };

  const switchToBaseFromMic = () => {
    if (!permissions.canManageHousehold) return;
    void savePoppinsInteractionPrefs(household.id, prefsForTier('base', interactionPrefs));
  };

  const onMicPress = () => {
    if (voiceSettling) return;
    if (longPressArmedRef.current) {
      longPressArmedRef.current = false;
      return;
    }
    if (!micUi.micEnabled) {
      if (micUi.offerSwitchToBase && permissions.canManageHousehold) switchToBaseFromMic();
      return;
    }
    if (currentTransport() === 'quiet') {
      if (quietRef.current?.active || quietListening) {
        void stopQuietCapture();
        return;
      }
      void beginQuietMic('tap10');
      return;
    }
    void connectOrToggleRealtime();
  };

  const selectPoppinsTier = (tier: 'base' | 'max') => {
    if (!permissions.canManageHousehold) return;
    void savePoppinsInteractionPrefs(household.id, prefsForTier(tier, interactionPrefs));
  };

  const retryAfterNothingHeard = () => {
    setNothingHeard(null);
    void startQuietCapture('tap10');
  };

  /** After a HOLD creates a task: keep the live session's picture of the house current. */
  const onVoiceTaskCreated = (task: HouseholdTask) => {
    const current = householdRef.current;
    const next = {
      ...current,
      tasks: current.tasks.some((item) => item.id === task.id) ? current.tasks : [task, ...current.tasks],
    };
    householdRef.current = next;
    voiceRef.current?.syncHousehold(next);
    voiceRef.current?.notifyTaskCommitted({
      title: task.title,
      assignee: task.assignee,
      due: task.due,
    });
  };

  // ── What the view shows ─────────────────────────────────────────────────────────────
  const idleHint = micUi.micEnabled
    ? `${greetingWord()}. Hold to speak — or tap for 10 seconds.`
    : micUi.preferKeyboard
      ? `${greetingWord()}. Type below.`
      : `${greetingWord()}. ${micUi.hint ?? 'Type below.'}`;
  const continueHint =
    continuityRef.current &&
    isContinuityFresh(continuityRef.current) &&
    continuityRef.current.householdId === household.id
      ? 'Tap to continue.'
      : null;

  const isClarifyingQuestion =
    liveCaption?.speaker === 'poppins' &&
    (/\?/.test(liveCaption.text) || /^(who|when|what|which|where)\b/i.test(liveCaption.text.trim()));
  const showWrittenCaption =
    Boolean(toolFlash) ||
    interactionPrefs.writtenReplies ||
    isClarifyingQuestion ||
    liveCaption?.speaker === 'you' ||
    quietListening;
  const liveSpeaker: 'you' | 'poppins' | 'done' | 'thinking' | null = toolFlash
    ? 'done'
    : showWrittenCaption && liveCaption
      ? liveCaption.speaker
      : interactionPrefs.showThinking && (visualState === 'thinking' || connecting)
        ? 'thinking'
        : null;
  const liveLabel = connecting
    ? `${majordomo.displayName} · Tuning in…`
    : liveSpeaker === 'you'
      ? 'YOU'
      : liveSpeaker === 'done'
        ? 'DONE'
        : liveSpeaker === 'thinking'
          ? 'THINKING'
          : majordomo.displayName.toUpperCase();
  const liveText = toolFlash
    ? toolFlash
    : connecting
      ? 'Tuning in to the house…'
      : liveCaption?.text
        ? captionWindow(liveCaption.text)
        : liveSpeaker === 'thinking'
          ? 'Working on your household…'
          : '';
  const liveAccent = liveSpeaker === 'you' || liveSpeaker === 'done' ? '#34D399' : cfg.color;
  const showCaptionDots =
    liveSpeaker !== 'done' &&
    !toolFlash &&
    (visualState === 'thinking' || connecting || (visualState === 'listening' && !liveText));
  const captionTextColor = isDark ? 'rgba(255,255,255,0.9)' : c.text;

  const primaryConnected = liveConnected || quietListening;
  const personalUsed = personalActTokens(aiSummary, currentMember?.id);
  const dailyLeft = Math.max(0, TOKENS_PER_DAY - personalUsed);
  const dailyFill = TOKENS_PER_DAY > 0 ? dailyLeft / TOKENS_PER_DAY : 0;
  const monthLeft = Math.max(0, TOKENS_PER_MONTH - aiSummary.tokensUsedThisPeriod);
  const monthGlow = permissions.canManageHousehold ? monthLeft / TOKENS_PER_MONTH : dailyFill;

  // One orb, never unmounted. Live or typing: 72. Idle: 196. It carries the tick through
  // the whole Undo window.
  const liveScene = drive.playlist[drive.index]?.scene;
  const undoWindowOpen = Boolean(drive.undoUntil && Date.now() < drive.undoUntil);
  const orbIsSettle =
    undoWindowOpen ||
    (drive.live && (drive.phase === 'settle' || liveScene === 'result_mark' || liveScene === 'task_done'));
  const orbSize = drive.live || threadOpen ? 72 : 196;
  const orbVisual: PoppinsVisualState = orbIsSettle ? 'success' : visualState;
  const showDrainPreview =
    drive.live && !orbIsSettle && (drive.holding || drive.phase === 'hold' || drive.phase === 'unfold');
  const drainPreview = showDrainPreview
    ? drainPreviewFill(dailyFill, turnActCost(getSessionActMode()), TOKENS_PER_DAY)
    : null;

  const stageBeat = drive.playlist[drive.index];
  const stageTint = stageBeat ? stageAccent(stageBeat.scene, stageBeat.payload.write) : null;
  const ambient = drive.live && stageTint
    ? `${stageTint}12`
    : visualState === 'listening'
      ? 'rgba(52,211,153,0.12)'
      : visualState === 'speaking'
        ? 'rgba(56,189,248,0.14)'
        : visualState === 'thinking'
          ? 'rgba(167,139,250,0.12)'
          : visualState === 'success'
            ? 'rgba(52,211,153,0.16)'
            : isDark
              ? 'rgba(56,189,248,0.06)'
              : `${orbitPalette.primary}18`;

  const headerLabel = stageHeaderLabel(drive, majordomo.displayName);
  const headerDot = drive.live && stageTint ? stageTint : cfg.color;

  const micLabel = micUi.micEnabled
    ? primaryConnected
      ? captureMode === 'tap10'
        ? 'Stop'
        : 'Done'
      : 'Speak'
    : cfg.label;

  const poppinsAllowed = canShowPoppinsTab({
    role: currentMember?.role,
    sidekickPoppinsAi: household.sidekickPoppinsAi,
  });

  return {
    // identity & permissions
    poppinsAllowed,
    majordomo,
    canManageHousehold: permissions.canManageHousehold,
    // stage
    drive,
    onVoiceTaskCreated,
    headerLabel,
    headerDot,
    ambient,
    // orb
    orb: {
      size: orbSize,
      state: orbVisual,
      speaking: visualState === 'speaking',
      dailyFill,
      monthGlow,
      accent: majordomo.accent,
      drainPreview,
      label: `${majordomo.displayName}, ${cfg.label}`,
    },
    dailyLeft,
    // caption
    caption: {
      speaker: liveSpeaker,
      label: liveLabel,
      text: liveText,
      accent: liveAccent,
      textColor: captionTextColor,
      showDots: showCaptionDots,
    },
    idleHint,
    continueHint,
    waveLevelDb,
    visualState,
    stateColor: cfg.color,
    isActive,
    // notices
    error,
    statusNotice,
    holdTip,
    nothingHeard,
    retryAfterNothingHeard,
    // mic & dock
    micUi,
    micLabel,
    primaryConnected,
    connecting,
    voiceSettling,
    captureMode,
    tapSecondsLeft,
    capSecondsLeft,
    onMicPress,
    onMicLongPress,
    onMicPressOut,
    switchToBaseFromMic,
    interactionPrefs,
    selectPoppinsTier,
    // thread
    threadOpen,
    setThreadOpen,
    draft,
    setDraft,
    handleSend,
    liveConnected,
    conversation: poppinsConversation,
    sourceByUserOrdinal: sourceByUserOrdinal.current,
    sourceEpoch,
    // audio sink
    remoteStreamUrl,
  };
}

export type PoppinsController = ReturnType<typeof usePoppinsController>;
