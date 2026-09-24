import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Redirect, router } from 'expo-router';
import { PoppinsHourglass } from '@/components/orbit/poppins-hourglass';
import { PoppinsLiveCaption } from '@/components/orbit/poppins-live-caption';
import { PoppinsModeCards } from '@/components/orbit/poppins-mode-cards';
import { PoppinsOrb } from '@/components/orbit/poppins-orb';
import { PoppinsStage } from '@/components/orbit/poppins-stage';
import { IuiTroubleNothingHeard } from '@/components/orbit/poppins-stage/iui-trouble';
import { TourTarget } from '@/components/orbit/tour/tour-target';
import { STAGE, stageAccent } from '@/constants/iui-stage';
import { PoppinsWaveform } from '@/components/orbit/poppins-waveform';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { radius, space } from '@/constants/orbit-theme';
import { greetingWord } from '@/lib/time/greeting';
import { canShowPoppinsTab } from '@/lib/sidekick/permissions';
import {
  getMajordomoProfile,
  resolveMajordomoProfileId,
} from '@/lib/ai/majordomo-profiles';
import { TOKENS_PER_DAY, TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import { drainPreviewFill, turnActCost } from '@/lib/poppins/orb-levels';
import { prefsForTier, savePoppinsInteractionPrefs } from '@/lib/poppins/poppins-prefs';
import { personalActTokens, summarizeActUsage, notifyActUndone, buildActEvent } from '@/lib/ai/act-events';
import { POPPINS_PAUSED_COPY } from '@/lib/ai/credits';
import { driveAiuic, hearAndDrive } from '@/lib/poppins/aiuic';
import { resolveBaseUtterance } from '@/lib/poppins/base-utterance';
import { filterDuplicateUiActions } from '@/lib/poppins/act-ledger';
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
import { commitSpeakOpen, hydrateHouseMemory, prepareSpeakOpen } from '@/lib/poppins/speak-open';
import { tourForcesQuietSpeak } from '@/lib/tour/tour-store';
import { poppinsUiOrchestrator, usePoppinsUiDrive } from '@/lib/poppins/ui-orchestrator';
import { HOLD_MS_DEFAULT, HOLD_MS_KID } from '@/lib/poppins/ui-scenes';
import { copyIuiVoiceError } from '@/lib/poppins/iui-voice-error';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import {
  applyLiveCaptionTurn,
  captionWindow,
  type LiveCaption,
} from '@/lib/voice/transcript-merge';
import {
  isPoppinsNativeVoiceAvailable,
  PoppinsVoiceSession,
  waitForPendingVoiceNativeSettle,
  type PoppinsPendingConfirmation,
  type PoppinsVoiceVisualState,
} from '@/lib/voice/poppins-voice-session';
import {
  createQuietCapture,
  QUIET_FAILURE_MESSAGES,
  type QuietCapture,
} from '@/lib/voice/quiet-capture';
import {
  micUiForPrefs,
  quietCaptureAvailable,
  speakTransportForPrefs,
} from '@/lib/voice/speak-transport';
import {
  persistVoiceFailure,
} from '@/lib/voice/quiet-failures';
import {
  DEFAULT_POPPINS_INTERACTION_PREFS,
  subscribePoppinsPrefs,
  type PoppinsInteractionPrefs,
} from '@/lib/poppins/poppins-prefs';
import { getSessionActMode, setSessionActMode, setSessionSelfName } from '@/lib/poppins/session-act-mode';
import type { HouseholdTask } from '@/types/orbit';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';

type PoppinsVisualState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success';
type CaptureMode = 'hold' | 'tap10';
type TurnInputSource = 'typed' | 'dictated';

const VOICE_FAILURE_CAUSES: ReadonlySet<string> = new Set([
  'ai_off',
  'signed_out',
  'whisper_failed',
  'budget_tripped',
]);

const TAP10_MS = 10_000;

function PoppinsRemoteAudio({ streamURL }: { streamURL: string | null }) {
  if (!streamURL || Platform.OS === 'web') return null;
  try {
    // Native-only audio sink so WebRTC remote audio is attached.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RTCView } = require('react-native-webrtc') as {
      RTCView?: ComponentType<{ streamURL: string; style?: object }>;
    };
    if (!RTCView) return null;
    return <RTCView streamURL={streamURL} style={styles.remoteAudio} />;
  } catch {
    return null;
  }
}

/**
 * Poppins Divine Voice — Speak/Done continuous WebRTC on TestFlight.
 * Expo Go is text + IUI only (no Whisper, no WS Realtime).
 */
export default function PoppinsScreen() {
  const chromePad = useTabChromePaddingTop();
  const insets = useSafeAreaInsets();
  const { c, isDark, glass, glassBorder } = useOrbitColors();
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
  /** Maps absolute user-turn ordinal → input source (session only). */
  const sourceByUserOrdinal = useRef(new Map<number, TurnInputSource>());
  const [sourceEpoch, setSourceEpoch] = useState(0);
  const [nothingHeard, setNothingHeard] = useState<
    null | 'no_audio' | 'too_short' | 'transcribe_failed' | 'empty_transcript'
  >(null);

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
      const { loadTokenGrants, topUpBalanceFromGrants } = await import(
        '@/lib/billing/token-grants'
      );
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
  const [pendingConfirmations, setPendingConfirmations] = useState<PoppinsPendingConfirmation[]>(
    []
  );
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
  const continuityRef = useRef<IuiContinuity | null>(null);
  const wasLiveRef = useRef(false);

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

  const mapVisual = (state: typeof voiceState): PoppinsVisualState => {
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
  }, [household.id]);

  useEffect(() => {
    if (wasLiveRef.current && !drive.live) {
      persistContinuity();
    }
    wasLiveRef.current = drive.live;
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
    poppinsUiOrchestrator.setPendingHandler((approved, ids) => {
      voiceRef.current?.notifyConfirmationResolved(ids, approved);
      setPendingConfirmations((current) => current.filter((item) => !ids.includes(item.id)));
      if (approved) flashToolSuccess('Confirmed');
    });
    const unsubTap = poppinsUiOrchestrator.subscribeTap((tap) => {
      setVoiceState((state) => (state === 'speaking' || state === 'thinking' ? 'listening' : state));
      poppinsUiOrchestrator.setSpeaking(false);
      const step = poppinsUiOrchestrator.getState().playlist[poppinsUiOrchestrator.getState().index]
        ?.payload.composeStep;
      const needsReply = tap.kind !== 'confirm' && step !== 'ready';
      voiceRef.current?.notifyStageTap(tap, { needsReply });
    });
    return () => {
      poppinsUiOrchestrator.setPendingHandler(null);
      unsubTap();
    };
  }, []);

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

  const applyTranscript = (
    role: 'user' | 'assistant',
    text: string,
    meta?: { replace?: boolean }
  ) => {
    const speaker = role === 'user' ? 'you' : 'poppins';
    setLiveCaption((prev) => applyLiveCaptionTurn(prev, speaker, text, meta?.replace));
    if (!text.trim()) return;
    if (role === 'user') {
      lastUtteranceRef.current = text;
      // Defence in depth: never parse while Poppins is still speaking (echo path).
      if (voiceStateRef.current === 'speaking') {
        return;
      }
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
    } else {
      continuityRef.current = rememberTurn(continuityRef.current, household.id, {
        role: 'assistant',
        text,
      });
      void saveIuiContinuity(continuityRef.current);
      poppinsUiOrchestrator.syncSpoken(text, memberNamesRef.current);
    }
  };

  const applyUiActions = (actions: Array<Record<string, unknown>>, replace = false) => {
    if (!actions.length) return;
    // B1 — model-only member_pick while the utterance is a grocery add: keep local.
    const onlyMemberPick =
      actions.length > 0 &&
      actions.every((a) => {
        const t = String(a.type ?? '');
        return t === 'member_pick' || t === 'list_members';
      });
    const local = parseCompoundHouseholdIntent(lastUtteranceRef.current, {
      memberNames: memberNamesRef.current,
      selfName: currentMember?.name,
      existingTasks: household.tasks,
    });
    if (onlyMemberPick) {
      if (local.some((a) => String(a.type) === 'add_grocery')) {
        return;
      }
    }
    // C — local grammar wins when the model plan is a different act family.
    const preferred = preferLocalOnPlanMismatch(local, actions);
    const deduped = filterDuplicateUiActions(preferred.actions);
    if (!deduped.length) return;
    driveAiuic(deduped, lastUtteranceRef.current, {
      kid: kidSessionRef.current,
      replace,
      existingTasks: household.tasks,
      memberNames: memberNamesRef.current,
      selfName: currentMember?.name,
    });
    persistContinuity();
  };

  const connectNativeVoice = async () => {
    if (tourForcesQuietSpeak()) return; // Tour never opens Realtime

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
        const hold = items.filter((item) => HOLD_WRITE_TOOLS.has(item.tool));
        const rest = items.filter((item) => !HOLD_WRITE_TOOLS.has(item.tool));
        if (hold.length) {
          voiceRef.current?.notifyConfirmationResolved(
            hold.map((item) => item.id),
            true
          );
        }
        setPendingConfirmations(rest);
        if (!rest.length) return;
        setVoiceState('needs_attention');
        applyUiActions(
          rest.map((item) => ({
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
          persistContinuity(
            snapshotFromDrive(continuityRef.current, household.id, iui)
          );
        }
      },
      onSoftIdlePrompt: () => {
        /* Stay listening. Do not dump a chat leftover into Activity. */
      },
      onRemoteStream: setRemoteStreamUrl,
      onError: (message) => {
        reportedError = true;
        surfaceVoiceError(message);
      },
    });
    const ok = await session.connect(household, metrics, currentMember?.majordomoProfileId, {
      pageContext: 'poppins tab',
      capabilityProfile: 'Daily',
      openerInstructions: prep.opening.instructions,
      listenPrompt: prep.listenPrompt,
      seedTurns: prep.seedTurns,
      memoryHint: prep.memoryHint,
    }).catch((error) => {
      reportedError = true;
      surfaceVoiceError(error);
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

  // Mid-session Speak back off → end Realtime immediately (never leave duplex up).
  useEffect(() => {
    if (interactionPrefs.speakBack) return;
    if (voiceRef.current?.isConnected || liveConnected) {
      void endNativeVoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to pref flip / connect state
  }, [interactionPrefs.speakBack, liveConnected]);

  const submitUtterance = async (
    text: string,
    source: 'typed' | 'dictated'
  ) => {
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

    // Live duplex: inject into the same WebRTC conversation (WO15 §4).
    if (liveSpeak && voiceRef.current?.isConnected) {
      voiceRef.current.sendUserText(trimmed);
      appendPoppinsTurn(trimmed, '(live voice)');
      return;
    }

    setAsking(true);
    if (interactionPrefs.showThinking) {
      setVoiceState('thinking');
    }
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
        if (elapsed < 400) {
          await new Promise((r) => setTimeout(r, 400 - elapsed));
        }
      }

      setVoiceState('speaking');
      setLiveCaption(applyLiveCaptionTurn(null, 'poppins', resolved.answer, true));
      appendPoppinsTurn(trimmed, resolved.answer);

      if (resolved.kind === 'model') {
        if (resolved.actions?.length) {
          flashToolSuccess(resolved.actions[0]!.label);
        }
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
    if (quietRef.current?.active || quietStoppingRef.current || asking || connecting || voiceSettling)
      return;
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
        onCapCountdown: (secondsLeft) => {
          setCapSecondsLeft(secondsLeft);
        },
        onLevel: (db) => {
          setWaveLevelDb(db);
        },
        onPartial: (text) => {
          setLiveCaption(applyLiveCaptionTurn(null, 'you', text, true));
        },
        onStatus: (status) => {
          if (status === 'got_it') {
            setLiveCaption(applyLiveCaptionTurn(null, 'you', 'Got it', true));
          }
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
    } catch (error) {
      resetCaptureUi();
      quietRef.current = null;
      setWaveLevelDb(null);
      setVoiceState('idle');
      setError(error instanceof Error ? error.message : 'Could not start listening.');
    }
  };

  const stopQuietCapture = async () => {
    const capture = quietRef.current;
    if (!capture || quietStoppingRef.current) return;
    quietStoppingRef.current = true;
    // Null before await so overlapping stop/pressOut/cap cannot double-submit (audit §3 P1).
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
        const line =
          QUIET_FAILURE_MESSAGES[failed] ??
          "Didn't catch that. Hold while you speak.";

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
    if (liveConnected || voiceRef.current?.isConnected) {
      await endNativeVoice();
    }
    await startQuietCapture(mode);
  };

  const onMicLongPress = () => {
    if (voiceSettling || !micUi.micEnabled) return;
    longPressArmedRef.current = true;
    const transport = speakTransportForPrefs(
      tourForcesQuietSpeak() ? false : interactionPrefs.speakBack
    );
    if (transport === 'quiet') {
      void beginQuietMic('hold');
      return;
    }
    void connectOrToggleRealtime();
  };

  const onMicPressOut = () => {
    if (captureModeRef.current === 'hold' && (quietListening || quietStoppingRef.current === false)) {
      if (quietRef.current?.active || quietListening) {
        void stopQuietCapture();
      }
    }
    // After a long-press, RN does not fire onPress — clear so the next tap works (audit §3 P2).
    if (longPressArmedRef.current) {
      requestAnimationFrame(() => {
        longPressArmedRef.current = false;
      });
    }
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

    const transport = speakTransportForPrefs(
      tourForcesQuietSpeak() ? false : interactionPrefs.speakBack
    );
    if (transport === 'quiet') {
      if (quietRef.current?.active || quietListening) {
        void stopQuietCapture();
        return;
      }
      void beginQuietMic('tap10');
      return;
    }
    void connectOrToggleRealtime();
  };

  const switchToBaseFromMic = () => {
    if (!permissions.canManageHousehold) return;
    void savePoppinsInteractionPrefs(household.id, prefsForTier('base', interactionPrefs));
  };

  const confirmPending = (approved: boolean) => {
    const ids = pendingConfirmations.map((p) => p.id);
    voiceRef.current?.notifyConfirmationResolved(ids, approved);
    setPendingConfirmations([]);
    if (approved) {
      flashToolSuccess('Confirmed');
    }
  };

  const ambient =
    visualState === 'listening'
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

  const idleHint = micUi.micEnabled
    ? `${greetingWord()}. Hold to speak — or tap for 10 seconds.`
    : micUi.preferKeyboard
      ? `${greetingWord()}. Type below.`
      : `${greetingWord()}. ${micUi.hint ?? 'Type below.'}`;

  const captionTextColor = isDark ? 'rgba(255,255,255,0.9)' : c.text;
  const isClarifyingQuestion =
    liveCaption?.speaker === 'poppins' &&
    (/\?/.test(liveCaption.text) ||
      /^(who|when|what|which|where)\b/i.test(liveCaption.text.trim()));
  const showWrittenCaption =
    Boolean(toolFlash) ||
    interactionPrefs.writtenReplies ||
    isClarifyingQuestion ||
    liveCaption?.speaker === 'you' ||
    quietListening;
  const liveSpeaker = toolFlash
    ? 'done'
    : showWrittenCaption && liveCaption
      ? liveCaption.speaker
      : interactionPrefs.showThinking && (visualState === 'thinking' || connecting)
        ? 'thinking'
        : null;
  const liveLabel =
    connecting
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
  const liveAccent =
    liveSpeaker === 'you' || liveSpeaker === 'done' ? '#34D399' : cfg.color;
  const showCaptionDots =
    liveSpeaker !== 'done' &&
    !toolFlash &&
    (visualState === 'thinking' ||
      connecting ||
      (visualState === 'listening' && !liveText));
  const hasStrip = liveSpeaker !== null;
  const primaryConnected = liveConnected || quietListening;
  const personalUsed = personalActTokens(aiSummary, currentMember?.id);
  const dailyLeft = Math.max(0, TOKENS_PER_DAY - personalUsed);
  const dailyFill = TOKENS_PER_DAY > 0 ? dailyLeft / TOKENS_PER_DAY : 0;
  const monthLeft = Math.max(0, TOKENS_PER_MONTH - aiSummary.tokensUsedThisPeriod);
  const monthGlow = permissions.canManageHousehold
    ? monthLeft / TOKENS_PER_MONTH
    : dailyFill;

  // WO13 / WO15 — one orb. Live or thread drawer: 72. Idle stage: 196.
  // Orb is the tick: keep success tint for the full local undo window.
  const liveScene = drive.playlist[drive.index]?.scene;
  const undoWindowOpen = Boolean(drive.undoUntil && Date.now() < drive.undoUntil);
  const orbIsSettle =
    undoWindowOpen ||
    (drive.live &&
      (drive.phase === 'settle' || liveScene === 'result_mark' || liveScene === 'task_done'));
  const orbSize = drive.live || threadOpen ? 72 : 196;
  const orbVisual: PoppinsVisualState = orbIsSettle
    ? 'success'
    : visualState === 'success'
      ? 'success'
      : visualState;
  // Drain dashed line off during success / undo window — orb carries the tick.
  const showDrainPreview =
    drive.live &&
    !orbIsSettle &&
    (drive.holding || drive.phase === 'hold' || drive.phase === 'unfold');
  const drainPreview = showDrainPreview
    ? drainPreviewFill(dailyFill, turnActCost(getSessionActMode()), TOKENS_PER_DAY)
    : null;

  const selectPoppinsTier = (tier: 'base' | 'max') => {
    if (!permissions.canManageHousehold) return;
    void savePoppinsInteractionPrefs(household.id, prefsForTier(tier, interactionPrefs));
  };

  const poppinsAllowed = canShowPoppinsTab({
    role: currentMember?.role,
    sidekickPoppinsAi: household.sidekickPoppinsAi,
  });

  if (!poppinsAllowed) {
    return <Redirect href={'/(tabs)' as never} />;
  }

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          backgroundColor: drive.live
            ? isDark
              ? STAGE.shell.groundDark
              : STAGE.shell.groundLight
            : isDark
              ? STAGE.shell.groundDark
              : orbitPalette.background,
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={24}>
      <PoppinsRemoteAudio streamURL={remoteStreamUrl} />
      {(drive.live || visualState !== 'idle') ? (
        <View
          style={[
            styles.ambient,
            {
              backgroundColor: drive.live
                ? `${stageAccent(drive.playlist[drive.index]?.scene ?? 'grocery_add', drive.playlist[drive.index]?.payload.write)}12`
                : ambient,
            },
          ]}
          pointerEvents="none"
        />
      ) : (
        <View style={[styles.ambient, { backgroundColor: ambient }]} pointerEvents="none" />
      )}

      <View style={[styles.header, { paddingTop: chromePad }]}>
        <View style={styles.headerLead}>
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: drive.live
                ? stageAccent(
                    drive.playlist[drive.index]?.scene ?? 'grocery_add',
                    drive.playlist[drive.index]?.payload.write
                  )
                : cfg.color,
            }}
          />
          <Text
            style={[
              styles.kicker,
              { color: isDark ? STAGE.text.mutedDark : STAGE.text.mutedLight },
            ]}>
            {drive.live
              ? `${(drive.playlist[drive.index]?.scene ?? 'stage').replace(/_/g, ' ').toUpperCase()} · LIVE`
              : majordomo.displayName.toUpperCase()}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={[styles.kicker, { color: STAGE.text.faintDark }]}>{dailyLeft} LEFT</Text>
          <Pressable
            style={[
              styles.activityBtn,
              {
                backgroundColor: glass(0.06),
                borderColor: glassBorder(0.1),
                opacity: drive.live ? 0 : 1,
              },
            ]}
            onPress={() => {
              if (drive.live) return;
              router.push({
                pathname: '/notifications',
                params: { tab: 'activity', from: 'poppins' },
              } as never);
            }}
            accessibilityRole="button"
            accessibilityLabel="Activity"
            pointerEvents={drive.live ? 'none' : 'auto'}>
            <PoppinsHourglass size={18} color="#2DD4BF" active={isActive} />
          </Pressable>
        </View>
      </View>

      {nothingHeard && !drive.live ? (
        <View style={{ paddingHorizontal: 22, marginBottom: 12 }}>
          <IuiTroubleNothingHeard
            accent={STAGE.domain.chores}
            failed={nothingHeard}
            onRetry={() => {
              setNothingHeard(null);
              void startQuietCapture('tap10');
            }}
          />
        </View>
      ) : null}

      {micUi.hint && !micUi.micEnabled && !drive.live ? (
        <View style={styles.transportHint}>
          <Text style={[styles.transportHintText, { color: c.textMuted }]}>{micUi.hint}</Text>
          {micUi.offerSwitchToBase && permissions.canManageHousehold ? (
            <Pressable
              onPress={switchToBaseFromMic}
              accessibilityRole="button"
              accessibilityLabel="Switch to Base"
              style={[styles.switchBaseBtn, { backgroundColor: glass(0.08), borderColor: glassBorder(0.12) }]}>
              <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>Switch to Base</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {holdTip && !drive.live ? (
        <Text style={[styles.holdTip, { color: c.textMuted }]}>{holdTip}</Text>
      ) : null}

      {/* WO15 §4 — stage is permanent; thread is a drawer over the lower half. */}
      <View style={styles.body}>
        <View style={[styles.stagePermanent, threadOpen ? styles.stageWithDrawer : null]}>
          {!drive.live ? (
            <View style={styles.transcriptBlock}>
              {hasStrip && liveSpeaker ? (
                <PoppinsLiveCaption
                  key={liveSpeaker}
                  speaker={liveSpeaker}
                  label={liveLabel}
                  text={liveText}
                  accent={liveAccent}
                  textColor={captionTextColor}
                  showDots={showCaptionDots}
                />
              ) : (
                <Text
                  style={[
                    styles.idleHint,
                    { color: isDark ? 'rgba(255,255,255,0.25)' : c.textMuted },
                  ]}>
                  {continuityRef.current &&
                  isContinuityFresh(continuityRef.current) &&
                  continuityRef.current.householdId === household.id
                    ? 'Tap to continue.'
                    : idleHint}
                </Text>
              )}
            </View>
          ) : null}

          <View
            style={[styles.orbSlot, drive.live || threadOpen ? styles.orbSlotLive : styles.orbSlotIdle]}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${majordomo.displayName}, ${cfg.label}`}>
            <PoppinsOrb
              size={orbSize}
              state={orbVisual}
              speaking={visualState === 'speaking'}
              dailyFill={dailyFill}
              monthGlow={monthGlow}
              accent={majordomo.accent}
              drainPreview={drainPreview}
            />
          </View>

          {drive.live ? (
            <View style={styles.stageLive}>
              <TourTarget id="poppins.stage" style={styles.stageTour}>
                <PoppinsStage
                  onVoiceTaskCreated={(task: HouseholdTask) => {
                    const current = householdRef.current;
                    const next = {
                      ...current,
                      tasks: current.tasks.some((item) => item.id === task.id)
                        ? current.tasks
                        : [task, ...current.tasks],
                    };
                    householdRef.current = next;
                    voiceRef.current?.syncHousehold(next);
                    voiceRef.current?.notifyTaskCommitted({
                      title: task.title,
                      assignee: task.assignee,
                      due: task.due,
                    });
                  }}
                />
              </TourTarget>
            </View>
          ) : (
            <View style={styles.waveWrap}>
              <PoppinsWaveform
                active={visualState === 'listening' || visualState === 'speaking'}
                color={cfg.color}
                levelDb={waveLevelDb}
              />
            </View>
          )}
        </View>

        {threadOpen ? (
          <View
            style={[
              styles.threadDrawer,
              {
                backgroundColor: isDark ? 'rgba(10,14,20,0.96)' : 'rgba(247,245,242,0.97)',
                borderColor: glassBorder(0.12),
              },
            ]}>
            <ScrollView
              style={styles.thread}
              contentContainerStyle={styles.threadContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {poppinsConversation.length === 0 && !liveText ? (
                <Text
                  style={[
                    styles.idleHint,
                    { color: isDark ? 'rgba(255,255,255,0.28)' : c.textMuted },
                  ]}>
                  {idleHint}
                </Text>
              ) : null}
              {(() => {
                void sourceEpoch;
                const recent = poppinsConversation.slice(-16);
                const fullUserOrdinals: number[] = [];
                let ordinal = 0;
                for (const message of poppinsConversation) {
                  if (message.role === 'user') {
                    fullUserOrdinals.push(ordinal);
                    ordinal += 1;
                  } else {
                    fullUserOrdinals.push(-1);
                  }
                }
                const recentStart = Math.max(0, poppinsConversation.length - recent.length);
                return recent.map((message, index) => {
                  const mine = message.role === 'user';
                  const globalIndex = recentStart + index;
                  const userOrdinal = fullUserOrdinals[globalIndex] ?? -1;
                  const source =
                    mine && userOrdinal >= 0
                      ? sourceByUserOrdinal.current.get(userOrdinal)
                      : undefined;
                  return (
                    <View
                      key={`${message.role}-${index}`}
                      style={[
                        styles.bubble,
                        mine ? styles.bubbleMine : styles.bubbleTheirs,
                        {
                          backgroundColor: mine ? glass(0.08) : `${majordomo.accent}22`,
                          borderColor: mine ? glassBorder(0.12) : `${majordomo.accent}55`,
                        },
                      ]}>
                      {mine && source ? (
                        <View style={styles.bubbleMeta}>
                          <MaterialIcons
                            name={source === 'dictated' ? 'mic' : 'keyboard'}
                            size={12}
                            color={c.textSubtle}
                          />
                        </View>
                      ) : null}
                      <Text style={[styles.bubbleText, { color: c.text }]}>{message.content}</Text>
                    </View>
                  );
                });
              })()}
              {liveText ? (
                <View
                  style={[
                    styles.bubble,
                    styles.bubbleTheirs,
                    {
                      backgroundColor: `${majordomo.accent}22`,
                      borderColor: `${majordomo.accent}55`,
                    },
                  ]}>
                  <Text style={[styles.bubbleKicker, { color: majordomo.accent }]}>{liveLabel}</Text>
                  <Text style={[styles.bubbleText, { color: c.text }]}>{liveText}</Text>
                </View>
              ) : null}
            </ScrollView>
            <View
              style={[
                styles.textComposer,
                {
                  backgroundColor: glass(0.06),
                  borderColor: glassBorder(0.12),
                },
              ]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={
                  liveConnected
                    ? `Type into the live session…`
                    : `Type to ${majordomo.displayName}…`
                }
                placeholderTextColor={c.textSubtle}
                style={[styles.textInput, { color: c.text }]}
                onSubmitEditing={() => void handleSend()}
                returnKeyType="send"
              />
              <Pressable
                onPress={() => void handleSend()}
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: draft.trim() ? '#38BDF8' : glass(0.08),
                  },
                ]}>
                <MaterialIcons
                  name="send"
                  size={16}
                  color={draft.trim() ? '#041018' : c.textSubtle}
                />
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {error ? (
          <Text style={[styles.error, { color: c.danger }]} selectable numberOfLines={8}>
            {error}
          </Text>
        ) : null}
        {statusNotice ? (
          <Text style={[styles.statusNotice, { color: c.textMuted }]} selectable numberOfLines={6}>
            {statusNotice}
          </Text>
        ) : null}

        <View
          style={[
            styles.controlRow,
            {
              gap: STAGE.dock.gap,
            },
          ]}>
          <Pressable
            onPress={() => setThreadOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={threadOpen ? 'Hide thread' : `Type to ${majordomo.displayName}`}
            style={[
              styles.sideBtn,
              {
                width: STAGE.dock.side,
                height: STAGE.dock.side,
                borderRadius: STAGE.dock.sideRadius,
                backgroundColor: threadOpen ? 'rgba(56,189,248,0.15)' : glass(0.07),
                borderColor: threadOpen ? 'rgba(56,189,248,0.3)' : glassBorder(0.1),
              },
            ]}>
            <MaterialIcons
              name={threadOpen ? 'close' : 'keyboard'}
              size={20}
              color={threadOpen ? '#38BDF8' : c.textMuted}
            />
          </Pressable>

          <TourTarget id="poppins.speak">
            <Pressable
              onPress={onMicPress}
              onLongPress={onMicLongPress}
              onPressOut={onMicPressOut}
              delayLongPress={700}
              disabled={voiceSettling || (!micUi.micEnabled && !micUi.offerSwitchToBase)}
              style={[
                styles.micWrap,
                !micUi.micEnabled ? styles.micDisabled : null,
                { width: STAGE.dock.mic, height: STAGE.dock.mic },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                primaryConnected
                  ? captureMode === 'tap10'
                    ? 'Stop'
                    : 'Done'
                  : micUi.micEnabled
                    ? 'Speak'
                    : micUi.offerSwitchToBase
                      ? 'Switch to Base to talk'
                      : 'Voice unavailable'
              }
              accessibilityHint={
                primaryConnected
                  ? 'Stops listening and keeps what is on screen'
                  : 'Hold to talk, or tap for a 10 second window'
              }
              accessibilityState={{
                busy: connecting || voiceSettling,
                selected: primaryConnected,
                disabled: voiceSettling || (!micUi.micEnabled && !micUi.offerSwitchToBase),
              }}>
              {primaryConnected ? (
                <View
                  style={[
                    styles.micPulse,
                    {
                      backgroundColor: isDark
                        ? 'rgba(52,211,153,0.2)'
                        : 'rgba(15,111,85,0.16)',
                      borderRadius: STAGE.dock.mic / 2,
                    },
                  ]}
                />
              ) : null}
              <LinearGradient
                colors={
                  !micUi.micEnabled
                    ? ['rgba(100,116,139,0.7)', 'rgba(71,85,105,0.65)']
                    : primaryConnected
                      ? ['rgba(248,113,113,0.95)', 'rgba(239,68,68,0.85)']
                      : connecting
                        ? ['rgba(167,139,250,0.9)', 'rgba(139,92,246,0.8)']
                        : isDark
                          ? [STAGE.shell.mic, '#248A64']
                          : [STAGE.domainLight.chores, '#0A5A44']
                }
                style={[
                  styles.micBtn,
                  {
                    width: STAGE.dock.mic,
                    height: STAGE.dock.mic,
                    borderRadius: STAGE.dock.mic / 2,
                    borderWidth: 3,
                    borderColor: primaryConnected
                      ? 'rgba(255,255,255,0.25)'
                      : isDark
                        ? 'rgba(118,196,174,0.28)'
                        : 'rgba(15,111,85,0.28)',
                    opacity: micUi.micEnabled ? 1 : 0.72,
                  },
                ]}>
                {primaryConnected ? (
                  captureMode === 'tap10' && tapSecondsLeft != null ? (
                    <Text style={styles.tapCountdown}>{tapSecondsLeft}</Text>
                  ) : (
                    <View style={styles.stopSquare} />
                  )
                ) : connecting ? (
                  <MaterialIcons name="graphic-eq" size={28} color="#fff" />
                ) : (
                  <MaterialIcons name="mic" size={28} color="#FFFFFF" />
                )}
              </LinearGradient>
              {capSecondsLeft != null && capSecondsLeft <= 5 ? (
                <Text style={styles.capCountdown}>{capSecondsLeft}s</Text>
              ) : null}
            </Pressable>
          </TourTarget>

          {/* Balance the keyboard button — dock is type + talk only (WO15 §4). */}
          <View style={[styles.speakBalance, { width: STAGE.dock.side, height: STAGE.dock.side }]} />
        </View>

        <Text
          style={[styles.stateLabel, { color: isActive ? cfg.color : c.textSubtle }]}
          accessibilityLiveRegion="polite">
          {micUi.micEnabled
            ? primaryConnected
              ? captureMode === 'tap10'
                ? 'Stop'
                : 'Done'
              : 'Speak'
            : cfg.label}
        </Text>
        <TourTarget id="poppins.meter">
          <Text style={[styles.meterCaption, { color: c.textSubtle }]} numberOfLines={1}>
            {dailyLeft} left today
          </Text>
        </TourTarget>
        <TourTarget id="poppins.mode">
          <PoppinsModeCards
            layout="pills"
            prefs={interactionPrefs}
            accent={majordomo.accent}
            disabled={!permissions.canManageHousehold}
            onSelectTier={selectPoppinsTier}
          />
        </TourTarget>
      </View>

      <Modal
        visible={pendingConfirmations.length > 0}
        transparent
        animationType="fade"
        onRequestClose={() => confirmPending(false)}>
        <View style={styles.confirmBackdrop}>
          <View
            style={[
              styles.confirmSheet,
              {
                backgroundColor: isDark ? '#12141A' : '#F7F5F2',
                borderColor: glassBorder(0.14),
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}>
            <Text style={[styles.confirmTitle, { color: c.text }]}>
              {pendingConfirmations[0]?.summary ?? 'Confirm'}
            </Text>
            {pendingConfirmations.length > 1
              ? pendingConfirmations.slice(1).map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.confirmCard,
                      { borderColor: glassBorder(0.12), backgroundColor: glass(0.05) },
                    ]}>
                    <Text style={[styles.confirmDetail, { color: c.text }]}>{item.summary}</Text>
                  </View>
                ))
              : null}
            <View style={styles.confirmRow}>
              <Pressable
                onPress={() => confirmPending(false)}
                style={[styles.confirmBtn, { backgroundColor: glass(0.08) }]}>
                <Text style={{ color: c.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmPending(true)}
                style={[styles.confirmBtn, { backgroundColor: '#38BDF8' }]}>
                <Text style={{ color: '#041018', fontWeight: '700' }}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  ambient: {
    position: 'absolute',
    top: 96,
    left: '50%',
    marginLeft: -310,
    width: 620,
    height: 620,
    borderRadius: 999,
    opacity: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    zIndex: 2,
  },
  headerLead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  thread: {
    flex: 1,
    zIndex: 2,
  },
  threadContent: {
    flexGrow: 1,
    gap: 10,
    justifyContent: 'flex-end',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  threadDrawer: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    maxHeight: '52%',
    minHeight: '42%',
    paddingBottom: 8,
    paddingTop: 10,
    position: 'absolute',
    right: 0,
    zIndex: 4,
  },
  stagePermanent: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  stageWithDrawer: {
    paddingBottom: '44%',
  },
  transportHint: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: space.lg,
  },
  transportHintText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  switchBaseBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  holdTip: {
    fontSize: 13,
    marginBottom: 6,
    textAlign: 'center',
  },
  bubble: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
  },
  bubbleMeta: {
    marginBottom: 4,
  },
  bubbleKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 22,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  activityBtn: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  stage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    zIndex: 2,
  },
  body: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    zIndex: 2,
  },
  orbSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  orbSlotIdle: {
    flex: 1,
    minHeight: 196,
  },
  orbSlotLive: {
    flexGrow: 0,
    flexShrink: 0,
    paddingBottom: 10,
    paddingTop: 4,
  },
  stageLive: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    paddingHorizontal: space.md,
  },
  stageTour: {
    flex: 1,
    width: '100%',
  },
  stageIdle: {
    alignItems: 'center',
    flexGrow: 0,
    justifyContent: 'flex-start',
    paddingHorizontal: space.lg,
    width: '100%',
  },
  stageLiveContent: {
    flexGrow: 1,
    paddingHorizontal: space.md,
  },
  transcriptBlock: {
    alignItems: 'center',
    marginBottom: space.lg,
    maxHeight: 128,
    minHeight: 96,
    overflow: 'hidden',
    paddingHorizontal: space.sm,
    width: '100%',
  },
  idleHint: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  waveWrap: {
    marginTop: space.lg,
    width: '100%',
  },
  error: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  statusNotice: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  controls: {
    flexShrink: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    zIndex: 2,
  },
  textComposer: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    minHeight: 28,
    paddingVertical: 4,
  },
  sendBtn: {
    alignItems: 'center',
    borderRadius: 12,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  controlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  sideBtn: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
  },
  speakBalance: {
    height: 54,
    width: 54,
  },
  micWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micDisabled: {
    opacity: 0.9,
  },
  micPulse: {
    ...StyleSheet.absoluteFill,
    transform: [{ scale: 1.35 }],
  },
  micBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: {
    backgroundColor: '#fff',
    borderRadius: 4,
    height: 20,
    width: 20,
  },
  tapCountdown: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  capCountdown: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    position: 'absolute',
    top: -2,
  },
  stateLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  meterCaption: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    minHeight: 16,
    textAlign: 'center',
  },
  confirmBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  confirmSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    width: '100%',
  },
  confirmTitle: { fontSize: 18, fontWeight: '700' },
  confirmSub: { fontSize: 13, marginBottom: 4 },
  confirmCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 12,
  },
  confirmTool: { fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  confirmDetail: { fontSize: 12, marginTop: 4 },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  confirmBtn: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    paddingVertical: 14,
  },
  remoteAudio: {
    height: 0,
    opacity: 0,
    width: 0,
  },
});
