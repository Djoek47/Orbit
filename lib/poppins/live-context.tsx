import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'expo-router';

import { useOrbitOptional } from '@/store/orbit-store';
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
  const askPoppins = orbit?.askPoppins;
  const household = orbit?.household;
  const metrics = orbit?.metrics;
  const appendPoppinsTurn = orbit?.appendPoppinsTurn;

  const stop = useCallback(async () => {
    await voiceRef.current?.end('manual');
    voiceRef.current = null;
    setVisual('idle');
    setSheetOpen(false);
    setCaption('');
    setError('');
  }, []);

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
        const session = new PoppinsVoiceSession({
          onStateChange: (state) => setVisual(mapVisual(state)),
          onTranscript: (_role, text) => {
            if (text.trim()) setCaption(text);
          },
          onSessionEnd: () => {
            setVisual('idle');
            setSheetOpen(false);
          },
          onError: (message) => {
            setError(message);
            setVisual('idle');
          },
        });
        const ok = await session.connect(household, metrics, orbit?.currentMember?.majordomoProfileId, {
          pageContext,
          capabilityProfile: 'Daily',
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
      if (voiceRef.current?.isConnected) {
        voiceRef.current.sendUserText(trimmed);
        setCaption(trimmed);
        return;
      }
      setVisual('thinking');
      setCaption(trimmed);
      try {
        const result = await askPoppins(trimmed);
        setCaption(result.answer);
        appendPoppinsTurn?.(trimmed, result.answer);
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
