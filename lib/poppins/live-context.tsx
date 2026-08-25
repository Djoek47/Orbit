import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'expo-router';

import { useOrbitOptional } from '@/store/orbit-store';
import { driveAiuic, hearAndDrive } from '@/lib/poppins/aiuic';
import {
  openActSnapshot,
  rememberTurn,
  saveIuiContinuity,
  snapshotFromDrive,
  type IuiContinuity,
} from '@/lib/poppins/iui-continuity';
import { commitSpeakOpen, hydrateHouseMemory, prepareSpeakOpen } from '@/lib/poppins/speak-open';
import { copyIuiVoiceError } from '@/lib/poppins/iui-voice-error';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import { HOLD_MS_DEFAULT, HOLD_MS_KID } from '@/lib/poppins/ui-scenes';
import {
  isPoppinsNativeVoiceAvailable,
  PoppinsVoiceSession,
  warmPoppinsMicrophone,
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
  const continuityRef = useRef<IuiContinuity | null>(null);
  const askPoppins = orbit?.askPoppins;
  const household = orbit?.household;
  const metrics = orbit?.metrics;
  const appendPoppinsTurn = orbit?.appendPoppinsTurn;
  const kid = orbit?.currentMember?.role === 'child';
  const selfName = orbit?.currentMember?.name;
  const memberNames = useMemo(
    () => household?.members.map((member) => member.name) ?? [],
    [household?.members]
  );

  useEffect(() => {
    void hydrateHouseMemory(household?.id);
  }, [household?.id]);

  useEffect(() => {
    if (onPoppinsTab) setSheetOpen(false);
  }, [onPoppinsTab]);

  useEffect(() => {
    return poppinsUiOrchestrator.subscribeTap((tap) => {
      if (!voiceRef.current?.isConnected) return;
      setVisual((state) => (state === 'speaking' || state === 'thinking' ? 'listening' : state));
      poppinsUiOrchestrator.setSpeaking(false);
      const step = poppinsUiOrchestrator.getState().playlist[poppinsUiOrchestrator.getState().index]
        ?.payload.composeStep;
      const needsReply = tap.kind !== 'confirm' && step !== 'ready';
      voiceRef.current.notifyStageTap(tap, { needsReply });
    });
  }, []);

  const persistDrive = useCallback(() => {
    if (!household?.id) return;
    const next = snapshotFromDrive(
      continuityRef.current,
      household.id,
      poppinsUiOrchestrator.getState()
    );
    continuityRef.current = next;
    void saveIuiContinuity(next);
  }, [household?.id]);

  const stop = useCallback(async () => {
    const iui = poppinsUiOrchestrator.getState();
    if (iui.live) poppinsUiOrchestrator.pause();
    persistDrive();
    await voiceRef.current?.end('manual');
    voiceRef.current = null;
    setVisual('idle');
    if (!poppinsUiOrchestrator.getState().live) {
      setSheetOpen(false);
      setCaption('');
    }
    setError('');
  }, [persistDrive]);

  const startInPlace = useCallback(
    async (pageContext = 'in-place') => {
      if (onPoppinsTab) {
        setSheetOpen(false);
        return;
      }
      setError('');
      setSheetOpen(true);
      if (nativeVoice && household && metrics) {
        if (voiceRef.current?.isConnected) {
          setVisual('listening');
          poppinsUiOrchestrator.unfreeze();
          return;
        }
        setVisual('connecting');
        void warmPoppinsMicrophone();
        const prep = await prepareSpeakOpen(household, metrics);
        continuityRef.current = prep.continuity;
        const snap = openActSnapshot(prep.continuity, kid ? HOLD_MS_KID : HOLD_MS_DEFAULT);
        if (snap) poppinsUiOrchestrator.restore(snap);
        let reportedError = false;
        const session = new PoppinsVoiceSession({
          onStateChange: (state) => setVisual(mapVisual(state)),
          onTranscript: (role, text) => {
            if (!text.trim()) return;
            setCaption(text);
            if (household.id) {
              continuityRef.current = rememberTurn(continuityRef.current, household.id, {
                role,
                text,
              });
              void saveIuiContinuity(continuityRef.current);
            }
            if (role === 'user') {
              lastUtteranceRef.current = text;
              hearAndDrive(text, memberNames, { kid, selfName });
            } else {
              poppinsUiOrchestrator.syncSpoken(text);
            }
          },
          onUiActions: (actions) => {
            driveAiuic(actions, lastUtteranceRef.current, { replace: true });
            persistDrive();
          },
          onSessionEnd: () => {
            const iui = poppinsUiOrchestrator.getState();
            if (iui.live) poppinsUiOrchestrator.pause();
            persistDrive();
            setVisual('idle');
            if (!iui.live) setSheetOpen(false);
          },
          onError: (message) => {
            reportedError = true;
            setError(copyIuiVoiceError(message).message);
            setVisual('idle');
            try {
              session.disconnect();
            } catch {
              /* already down */
            }
            voiceRef.current = null;
          },
        });
        const ok = await session.connect(household, metrics, orbit?.currentMember?.majordomoProfileId, {
          pageContext,
          capabilityProfile: 'Daily',
          openerInstructions: prep.opening.instructions,
          listenPrompt: prep.listenPrompt,
          seedTurns: prep.seedTurns,
          memoryHint: prep.memoryHint,
        });
        if (!ok) {
          session.disconnect();
          setVisual('idle');
          if (!reportedError) setError(copyIuiVoiceError('start_failed').message);
          return;
        }
        void commitSpeakOpen(prep.memory, prep.opening);
        voiceRef.current = session;
        setVisual('listening');
        poppinsUiOrchestrator.unfreeze();
        return;
      }
      setVisual('idle');
    },
    [household, kid, memberNames, metrics, nativeVoice, onPoppinsTab, orbit?.currentMember?.majordomoProfileId, persistDrive, selfName]
  );

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !askPoppins) return;
      lastUtteranceRef.current = trimmed;
      if (voiceRef.current?.isConnected) {
        voiceRef.current.sendUserText(trimmed);
        setCaption(trimmed);
        hearAndDrive(trimmed, memberNames, { kid, selfName });
        return;
      }
      setVisual('thinking');
      setCaption(trimmed);
      try {
        const result = await askPoppins(trimmed);
        setCaption(result.answer);
        appendPoppinsTurn?.(trimmed, result.answer);
        if (result.ui_actions?.length) {
          driveAiuic(result.ui_actions, trimmed, { replace: true, kid });
        } else {
          hearAndDrive(trimmed, memberNames, { kid, selfName });
        }
        setVisual('speaking');
        setTimeout(() => setVisual('idle'), 1600);
      } catch {
        setError('Poppins could not answer right now. Try again in a moment.');
        setVisual('idle');
      }
    },
    [appendPoppinsTurn, askPoppins, kid, memberNames, selfName]
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
