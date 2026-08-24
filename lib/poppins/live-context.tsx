import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'expo-router';

import { useOrbitOptional } from '@/store/orbit-store';
import { driveAiuic } from '@/lib/poppins/aiuic';
import {
  continuityListenPrompt,
  hasOpenAct,
  loadIuiContinuity,
  rememberTurn,
  saveIuiContinuity,
  shouldGreet,
  snapshotFromDrive,
} from '@/lib/poppins/iui-continuity';
import { parseHouseholdIntent } from '@/lib/poppins/ui-intent';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import {
  isPoppinsNativeVoiceAvailable,
  PoppinsVoiceSession,
  type PoppinsVoiceVisualState,
} from '@/lib/voice/poppins-voice-session';

export type PoppinsLiveVisual = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

type PoppinsLiveValue = {
  visual: PoppinsLiveVisual;
  caption: string;
  error: string;
  sheetOpen: boolean;
  nativeVoice: boolean;
  startInPlace: (pageContext?: string) => Promise<void>;
  sendText: (text: string) => Promise<void>;
  stop: () => Promise<void>;
  markThinking: () => void;
  markIdle: () => void;
};

const PoppinsLiveContext = createContext<PoppinsLiveValue | null>(null);

function mapVisual(state: PoppinsVoiceVisualState): PoppinsLiveVisual {
  if (state === 'connecting' || state === 'needs_attention') return 'thinking';
  if (state === 'listening' || state === 'thinking' || state === 'speaking') return state;
  return 'idle';
}

export function PoppinsLiveProvider({ children }: { children: ReactNode }) {
  const orbit = useOrbitOptional();
  const pathname = usePathname();
  const onPoppinsTab = pathname?.includes('poppins') ?? false;
  const nativeVoice = isPoppinsNativeVoiceAvailable();
  const [visual, setVisual] = useState<PoppinsLiveVisual>('idle');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const voiceRef = useRef<PoppinsVoiceSession | null>(null);
  const lastUtteranceRef = useRef('');
  const continuityHouseholdRef = useRef<string | null>(null);
  const askPoppins = orbit?.askPoppins;
  const household = orbit?.household;
  const metrics = orbit?.metrics;
  const appendPoppinsTurn = orbit?.appendPoppinsTurn;

  const stop = useCallback(async () => {
    const iui = poppinsUiOrchestrator.getState();
    if (iui.live) poppinsUiOrchestrator.pause();
    if (household?.id) {
      const next = snapshotFromDrive(null, household.id, poppinsUiOrchestrator.getState());
      void saveIuiContinuity(next);
    }
    await voiceRef.current?.end('manual');
    voiceRef.current = null;
    setVisual('idle');
    if (!poppinsUiOrchestrator.getState().live) {
      setSheetOpen(false);
      setCaption('');
    }
    setError('');
  }, [household?.id]);

  const startInPlace = useCallback(
    async (pageContext = 'in-place') => {
      setError('');
      setSheetOpen(!onPoppinsTab);
      if (nativeVoice && household && metrics) {
        if (voiceRef.current?.isConnected) {
          setVisual('listening');
          return;
        }
        setVisual('connecting');
        const prior = household.id ? await loadIuiContinuity(household.id) : null;
        const greet = shouldGreet(prior, household.id);
        if (hasOpenAct(prior) && prior?.openPlaylist) {
          poppinsUiOrchestrator.restore(
            {
              playlist: prior.openPlaylist,
              index: prior.openIndex ?? 0,
              phase: 'unfold',
              frozen: true,
              holdMs: 1500,
              thinkingLine: prior.lastTitle ?? '',
            },
            { resumeHold: true }
          );
        }
        const session = new PoppinsVoiceSession({
          onStateChange: (state) => setVisual(mapVisual(state)),
          onTranscript: (role, text) => {
            if (!text.trim()) return;
            setCaption(text);
            if (role === 'user') {
              lastUtteranceRef.current = text;
              if (household.id) {
                void saveIuiContinuity(rememberTurn(prior, household.id, { role: 'user', text }));
              }
              if (poppinsUiOrchestrator.applySpeech(text)) return;
              const inferred = parseHouseholdIntent(text);
              if (inferred.length) driveAiuic(inferred, text, { replace: true });
            } else {
              if (household.id) {
                void saveIuiContinuity(
                  rememberTurn(prior, household.id, { role: 'assistant', text })
                );
              }
              poppinsUiOrchestrator.syncSpoken(text);
            }
          },
          onUiActions: (actions) => {
            driveAiuic(actions, lastUtteranceRef.current, { replace: true });
          },
          onSessionEnd: () => {
            const iui = poppinsUiOrchestrator.getState();
            if (iui.live) poppinsUiOrchestrator.pause();
            setVisual('idle');
            if (!iui.live) setSheetOpen(false);
          },
          onError: (message) => {
            setError(message);
            setVisual('idle');
          },
        });
        const ok = await session.connect(household, metrics, orbit?.currentMember?.majordomoProfileId, {
          pageContext,
          capabilityProfile: 'Daily',
          greet,
          listenPrompt: prior && !greet ? continuityListenPrompt(prior) : undefined,
          seedTurns: prior && !greet ? prior.turns : undefined,
        });
        if (!ok) {
          session.disconnect();
          setVisual('idle');
          setError('Poppins could not start voice. Type instead.');
          return;
        }
        voiceRef.current = session;
        setVisual('listening');
        return;
      }
      setVisual('idle');
    },
    [household, metrics, nativeVoice, onPoppinsTab, orbit?.currentMember?.majordomoProfileId]
  );

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !askPoppins) return;
      lastUtteranceRef.current = trimmed;
      if (voiceRef.current?.isConnected) {
        voiceRef.current.sendUserText(trimmed);
        setCaption(trimmed);
        if (!poppinsUiOrchestrator.applySpeech(trimmed)) {
          const inferred = parseHouseholdIntent(trimmed);
          if (inferred.length) driveAiuic(inferred, trimmed, { replace: true });
        }
        return;
      }
      setVisual('thinking');
      setCaption(trimmed);
      try {
        const result = await askPoppins(trimmed);
        setCaption(result.answer);
        appendPoppinsTurn?.(trimmed, result.answer);
        if (result.ui_actions?.length) {
          driveAiuic(result.ui_actions, trimmed, { replace: true });
        } else {
          driveAiuic([], trimmed, { replace: true });
        }
        setVisual('speaking');
        setTimeout(() => setVisual('idle'), 1600);
      } catch {
        setError('Poppins could not answer right now.');
        setVisual('idle');
      }
    },
    [appendPoppinsTurn, askPoppins]
  );

  const value = useMemo<PoppinsLiveValue>(
    () => ({
      visual,
      caption,
      error,
      sheetOpen,
      nativeVoice,
      startInPlace,
      sendText,
      stop,
      markThinking: () => setVisual('thinking'),
      markIdle: () => setVisual('idle'),
    }),
    [caption, error, nativeVoice, sendText, sheetOpen, startInPlace, stop, visual]
  );

  return <PoppinsLiveContext.Provider value={value}>{children}</PoppinsLiveContext.Provider>;
}

export function usePoppinsLive(): PoppinsLiveValue | null {
  return useContext(PoppinsLiveContext);
}
