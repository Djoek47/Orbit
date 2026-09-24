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
import {
  POPPINS_PAUSED_COPY,
} from '@/lib/ai/credits';
import { TOKENS_PER_DAY, TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import { drainPreviewFill, turnActCost } from '@/lib/poppins/orb-levels';
import { prefsForTier, savePoppinsInteractionPrefs } from '@/lib/poppins/poppins-prefs';
import { personalActTokens, summarizeActUsage, notifyActUndone, buildActEvent } from '@/lib/ai/act-events';
import { driveAiuic, hearAndDrive, isLocalHowTo } from '@/lib/poppins/aiuic';
import {
  confirmationForLocalWrite,
  findLocalWriteBeat,
} from '@/lib/poppins/local-act-confirm';
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
import { speakTransportForPrefs } from '@/lib/voice/speak-transport';
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
  const [quietListening, setQuietListening] = useState(false);
  const [nothingHeard, setNothingHeard] = useState<
    null | 'no_audio' | 'too_short' | 'transcribe_failed' | 'empty_transcript'
  >(null);

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
        });
      }
      await notifyActUndone(beat.id, beat.payload.write, beat.payload.actMode);
    });
    return () => {
      poppinsUiOrchestrator.setUndoHandler(null);
    };
  }, [deleteTask, deleteEvent, updateTask, removeGroceryItem, removeSavedPlace, rejectAllowance]);

  const STATE_CONFIG: Record<PoppinsVisualState, { label: string; color: string }> = {
    idle: {
      label: nativeVoice ? `${majordomo.displayName} · Tap to speak` : `${majordomo.displayName} · Ready`,
      color: majordomo.accent,
    },
    listening: { label: `${majordomo.displayName} · Listening`, color: '#34D399' },
    thinking: { label: `${majordomo.displayName} · Thinking…`, color: '#A78BFA' },
    speaking: { label: `${majordomo.displayName} · Speaking`, color: '#38BDF8' },
    success: { label: `${majordomo.displayName} · Done`, color: '#34D399' },
  };

  const [showText, setShowText] = useState(() => !isPoppinsNativeVoiceAvailable());
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
    if (copy.kind === 'mic_denied') setShowText(true);
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
    const liveSpeak = Boolean(voiceRef.current?.isConnected);
    setSessionActMode(liveSpeak ? 'spoken' : 'silent');
    setLiveCaption(applyLiveCaptionTurn(null, 'you', trimmed, true));
    lastUtteranceRef.current = trimmed;
    setError('');
    const tookLocal = hearAndDrive(trimmed, memberNamesRef.current, {
      kid: kidSessionRef.current,
      selfName: currentMember?.name,
      existingTasks: household.tasks,
    });
    const localWrite = findLocalWriteBeat(
      poppinsUiOrchestrator.getState().playlist,
      poppinsUiOrchestrator.getState().index
    );
    const localConfirm = localWrite ? confirmationForLocalWrite(localWrite) : null;

    // Live duplex: inject into the same WebRTC conversation.
    if (liveSpeak && voiceRef.current?.isConnected) {
      voiceRef.current.sendUserText(trimmed);
      appendPoppinsTurn(trimmed, '(live voice)');
      return;
    }

    // A4: local write already staged — confirm from the act, do not ask the model.
    if (tookLocal && localConfirm) {
      setVoiceState('speaking');
      setLiveCaption(applyLiveCaptionTurn(null, 'poppins', localConfirm, true));
      appendPoppinsTurn(trimmed, localConfirm);
      setTimeout(() => setVoiceState('idle'), 1800);
      return;
    }

    // WO12 §D — teaching matched locally: coach card is free, never call the model.
    const liveBeat = poppinsUiOrchestrator.getState().playlist[poppinsUiOrchestrator.getState().index];
    if (tookLocal && (liveBeat?.scene === 'coach_steps' || isLocalHowTo(trimmed))) {
      const answer = liveBeat?.payload.coachLine ?? liveBeat?.payload.subtitle ?? 'Here is how.';
      if (currentMember) {
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
      setVoiceState('speaking');
      setLiveCaption(applyLiveCaptionTurn(null, 'poppins', answer, true));
      appendPoppinsTurn(trimmed, answer);
      setTimeout(() => setVoiceState('idle'), 1800);
      return;
    }

    setAsking(true);
    if (interactionPrefs.showThinking) {
      setVoiceState('thinking');
    }
    const thinkStarted = Date.now();
    try {
      const result = await askPoppins(trimmed);
      if (interactionPrefs.showThinking) {
        const elapsed = Date.now() - thinkStarted;
        if (elapsed < 400) {
          await new Promise((r) => setTimeout(r, 400 - elapsed));
        }
      }
      // Prefer local confirmation over a model failure / offline sentence.
      const offline =
        Boolean(result.error_code) ||
        result.source === 'openai_error' ||
        /could not answer|is offline right now/i.test(result.answer ?? '');
      if (offline && (localConfirm || tookLocal)) {
        poppinsUiOrchestrator.flagModelOffline();
      }
      const answer =
        offline && localConfirm ? localConfirm : result.answer || localConfirm || '';
      setVoiceState('speaking');
      setLiveCaption(applyLiveCaptionTurn(null, 'poppins', answer, true));
      appendPoppinsTurn(trimmed, answer);
      if (!offline && result.actions?.length) {
        flashToolSuccess(result.actions[0]!.label);
      }
      if (!offline && result.ui_actions?.length) {
        applyUiActions(result.ui_actions, true);
      }
      if (!offline) {
        poppinsUiOrchestrator.syncSpoken(result.answer, memberNamesRef.current);
      }
    } catch {
      if (localConfirm) {
        setVoiceState('speaking');
        setLiveCaption(applyLiveCaptionTurn(null, 'poppins', localConfirm, true));
        appendPoppinsTurn(trimmed, localConfirm);
      } else {
        // Still show the user bubble so the thread never loses what they said.
        appendPoppinsTurn(trimmed, '');
        setError(`${majordomo.displayName} could not answer right now. Try again in a moment.`);
      }
    } finally {
      setAsking(false);
      setTimeout(() => setVoiceState('idle'), 1800);
    }
  };

  const handleSend = async () => {
    await submitUtterance(draft, 'typed');
  };

  const startQuietCapture = async () => {
    if (quietRef.current?.active || asking || connecting || voiceSettling) return;
    if (aiSummary.tripped) {
      setError(POPPINS_PAUSED_COPY);
      return;
    }
    setSessionActMode('silent');
    setError('');
    setNothingHeard(null);
    const capture = createQuietCapture();
    quietRef.current = capture;
    setQuietListening(true);
    setListening(true);
    setVoiceState('listening');
    setLiveCaption(applyLiveCaptionTurn(null, 'you', 'Listening…', true));
    try {
      await capture.start({
        onAutoStop: () => {
          void stopQuietCapture();
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
          }
        },
      });
    } catch (error) {
      setQuietListening(false);
      setListening(false);
      setVoiceState('idle');
      quietRef.current = null;
      setError(error instanceof Error ? error.message : 'Could not start listening.');
    }
  };

  const stopQuietCapture = async () => {
    const capture = quietRef.current;
    if (!capture) return;
    setQuietListening(false);
    setListening(false);
    try {
      const result = await capture.stop(householdRef.current, metrics);
      quietRef.current = null;
      if ('failed' in result) {
        setVoiceState('idle');
        setNothingHeard(result.failed);
        const line =
          QUIET_FAILURE_MESSAGES[result.failed] ??
          "Didn't catch that. Tap to try again.";
        setLiveCaption(applyLiveCaptionTurn(null, 'poppins', line, true));
        return;
      }
      setNothingHeard(null);
      await submitUtterance(result.transcript, 'dictated');
    } catch {
      quietRef.current = null;
      setVoiceState('idle');
      setError('Could not hear that. Try again.');
    }
  };

  const toggleConnect = async () => {
    if (voiceSettling) return;

    const { emitTourEvent } = await import('@/lib/tour/tour-events');
    emitTourEvent('poppins_spoke', { phase: 'press' });

    const transport = speakTransportForPrefs(
      tourForcesQuietSpeak() ? false : interactionPrefs.speakBack
    );

    // Quiet uses expo-audio. Speak back needs native WebRTC.
    if (!nativeVoice && transport !== 'quiet') return;

    // Quiet path — never construct PoppinsVoiceSession.
    if (transport === 'quiet') {
      if (quietRef.current?.active || quietListening) {
        await stopQuietCapture();
        emitTourEvent('poppins_spoke', { phase: 'done' });
        return;
      }
      if (liveConnected || voiceRef.current?.isConnected) {
        await endNativeVoice();
        emitTourEvent('poppins_spoke', { phase: 'done' });
      }
      await startQuietCapture();
      return;
    }

    if (liveConnected || voiceRef.current?.isConnected) {
      await endNativeVoice();
      emitTourEvent('poppins_spoke', { phase: 'done' });
      return;
    }
    if (asking || connecting) return;
    if (aiSummary.tripped) {
      setError(POPPINS_PAUSED_COPY);
      return;
    }
    setSessionActMode('spoken');
    await connectNativeVoice();
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

  const idleHint = nativeVoice
    ? `${greetingWord()}. Tap to speak.`
    : `${greetingWord()}. Type below.`;

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

  // WO13 — one orb, three sizes. Never unmount while the tab is open.
  const liveScene = drive.playlist[drive.index]?.scene;
  const orbIsSettle =
    drive.live &&
    (drive.phase === 'settle' || liveScene === 'result_mark' || liveScene === 'task_done');
  const orbSize = showText && !drive.live ? 34 : drive.live ? 72 : 196;
  const orbVisual: PoppinsVisualState = orbIsSettle
    ? 'success'
    : visualState === 'success'
      ? 'success'
      : visualState;
  const showDrainPreview =
    drive.live &&
    !orbIsSettle &&
    (drive.holding || drive.phase === 'hold' || drive.phase === 'unfold');
  const drainPreview = showDrainPreview
    ? drainPreviewFill(dailyFill, turnActCost(getSessionActMode()), TOKENS_PER_DAY)
    : null;

  const selectPoppinsTier = (tier: 'base' | 'max') => {
    if (!permissions.canManageHousehold) return;
    void savePoppinsInteractionPrefs(household.id, prefsForTier(tier));
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
          {showText && !drive.live ? (
            <PoppinsOrb
              size={34}
              state={orbVisual}
              speaking={visualState === 'speaking'}
              dailyFill={dailyFill}
              monthGlow={monthGlow}
              accent={majordomo.accent}
            />
          ) : (
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
          )}
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
              void startQuietCapture();
            }}
          />
        </View>
      ) : null}

      {/* WO13 — one orb for the tab. Live: 72 above the card. Idle: 196 centre. Text: 34 in header. */}
      <View style={styles.body}>
        {showText && !drive.live ? (
          <ScrollView
            style={styles.thread}
            contentContainerStyle={styles.threadContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {poppinsConversation.length === 0 && !liveText ? (
              <Text style={[styles.idleHint, { color: isDark ? 'rgba(255,255,255,0.28)' : c.textMuted }]}>
                {idleHint}
              </Text>
            ) : null}
            {poppinsConversation.slice(-16).map((message, index) => {
              const mine = message.role === 'user';
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
                  <Text style={[styles.bubbleText, { color: c.text }]}>{message.content}</Text>
                </View>
              );
            })}
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
        ) : (
          <>
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
              style={[styles.orbSlot, drive.live ? styles.orbSlotLive : styles.orbSlotIdle]}
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
                />
              </View>
            )}
          </>
        )}
      </View>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {error ? (
          <Text style={[styles.error, { color: c.danger }]} selectable numberOfLines={8}>
            {error}
          </Text>
        ) : null}
        {showText ? (
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
        ) : null}

        <View style={styles.controlRow}>
          <Pressable
            onPress={() => setShowText((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showText ? 'Hide keyboard' : `Type to ${majordomo.displayName}`}
            style={[
              styles.sideBtn,
              {
                backgroundColor: showText ? 'rgba(56,189,248,0.15)' : glass(0.07),
                borderColor: showText ? 'rgba(56,189,248,0.3)' : glassBorder(0.1),
              },
            ]}>
            <MaterialIcons
              name={showText ? 'close' : 'keyboard'}
              size={20}
              color={showText ? '#38BDF8' : c.textMuted}
            />
          </Pressable>

          {nativeVoice ? (
            <TourTarget id="poppins.speak"><Pressable
              onPress={() => void toggleConnect()}
              disabled={voiceSettling}
              style={styles.micWrap}
              accessibilityRole="button"
              accessibilityLabel={primaryConnected ? 'Done' : 'Speak'}
              accessibilityHint={
                primaryConnected
                  ? 'Stops listening and keeps what is on screen'
                  : 'Starts listening'
              }
              accessibilityState={{
                busy: connecting || voiceSettling,
                selected: primaryConnected,
                disabled: voiceSettling,
              }}>
              {primaryConnected ? (
                <View style={[styles.micPulse, { backgroundColor: 'rgba(52,211,153,0.2)' }]} />
              ) : null}
              <LinearGradient
                colors={
                  primaryConnected
                    ? ['rgba(248,113,113,0.95)', 'rgba(239,68,68,0.85)']
                    : connecting
                      ? ['rgba(167,139,250,0.9)', 'rgba(139,92,246,0.8)']
                      : [STAGE.shell.mic, '#248A64']
                }
                style={[
                  styles.micBtn,
                  {
                    borderColor: primaryConnected
                      ? 'rgba(255,255,255,0.25)'
                      : 'rgba(118,196,174,0.28)',
                  },
                ]}>
                {primaryConnected ? (
                  <View style={styles.stopSquare} />
                ) : connecting ? (
                  <MaterialIcons name="graphic-eq" size={28} color="#fff" />
                ) : (
                  <MaterialIcons name="mic" size={28} color="#FFFFFF" />
                )}
              </LinearGradient>
            </Pressable></TourTarget>
          ) : (
            <View style={styles.micWrap} />
          )}

          <Pressable
            onPress={() => {
              setShowText(true);
              setDraft((prev) => (prev.trim() ? prev : 'how do I '));
            }}
            accessibilityRole="button"
            accessibilityLabel="Show me how"
            style={[
              styles.sideBtn,
              {
                backgroundColor: `${STAGE.domain.household}24`,
                borderColor: `${STAGE.domain.household}57`,
              },
            ]}>
            <MaterialIcons name="help-outline" size={21} color={STAGE.shell.teach} />
          </Pressable>
        </View>

        <Text
          style={[styles.stateLabel, { color: isActive ? cfg.color : c.textSubtle }]}
          accessibilityLiveRegion="polite">
          {nativeVoice ? (primaryConnected ? 'Done' : 'Speak') : cfg.label}
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
    gap: 20,
    justifyContent: 'center',
  },
  sideBtn: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  speakBalance: {
    height: 54,
    width: 54,
  },
  micWrap: {
    alignItems: 'center',
    height: 82,
    justifyContent: 'center',
    width: 82,
  },
  micPulse: {
    ...StyleSheet.absoluteFill,
    borderRadius: 41,
    transform: [{ scale: 1.35 }],
  },
  micBtn: {
    alignItems: 'center',
    borderRadius: 41,
    borderWidth: 3,
    height: 82,
    justifyContent: 'center',
    width: 82,
  },
  stopSquare: {
    backgroundColor: '#fff',
    borderRadius: 4,
    height: 20,
    width: 20,
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
