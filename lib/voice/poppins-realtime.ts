import { Audio } from 'expo-av';

import { useLivePoppinsAi } from '@/config/poppins-ai-mode';
import { toolResultToMonitorAction } from '@/lib/ai/execute-poppins-tool';
import { buildPoppinsHouseholdPayload } from '@/lib/ai/household-context';
import { POPPINS_TOOL_DEFINITIONS, type PoppinsToolName } from '@/lib/ai/poppins-tools';
import { getSupabaseClient } from '@/lib/supabase/client';
import {
  startVoiceCapture,
  stopVoiceCapture,
  speakPoppins,
  stopSpeaking,
  transcribeAndAskPoppins,
  transcribePoppinsAudio,
} from '@/lib/voice/poppins-voice';
import type {
  HouseholdSnapshot,
  PoppinsConversationAnswer,
  PoppinsMonitorAction,
  OrbitMetrics,
} from '@/types/orbit';

export type PoppinsRealtimeVisualState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type PoppinsRealtimeCallbacks = {
  onStateChange?: (state: PoppinsRealtimeVisualState) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string) => void;
  onToolCall?: (name: PoppinsToolName, args: Record<string, unknown>) => Promise<unknown> | unknown;
  onError?: (message: string) => void;
};

export function isPoppinsRealtimeEnabled() {
  return process.env.EXPO_PUBLIC_POPPINS_REALTIME === '1' && useLivePoppinsAi;
}

type SessionPayload = {
  clientSecret: string;
  model: string;
  expiresAt?: number | string | null;
  voice?: string;
};

async function mintRealtimeSession(
  household: HouseholdSnapshot,
  metrics: OrbitMetrics
): Promise<SessionPayload | null> {
  const supabase = getSupabaseClient();
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabase || !baseUrl) {
    return null;
  }

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) {
    return null;
  }

  const res = await fetch(`${baseUrl}/functions/v1/poppins-realtime-session`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      householdId: household.id,
      householdContext: buildPoppinsHouseholdPayload(household, metrics),
    }),
  });

  if (!res.ok) {
    return null;
  }

  const payload = await res.json();
  if (!payload?.clientSecret) {
    return null;
  }

  return {
    clientSecret: payload.clientSecret,
    model: payload.model ?? 'gpt-realtime-2.1-mini',
    expiresAt: payload.expiresAt,
    voice: payload.voice,
  };
}

/**
 * OpenAI Realtime voice layer for Expo Go (WebSocket).
 * Mic audio is transcribed via Whisper (PCM streaming is limited in Expo Go),
 * then injected as a text turn into Realtime for tool-aware replies.
 * Falls back to full Whisper + TTS via poppins-voice when session mint/connect fails.
 */
export class PoppinsRealtimeSession {
  private ws: WebSocket | null = null;
  private model = 'gpt-realtime-2.1-mini';
  private assistantBuffer = '';
  private connected = false;
  private responseWaiters: Array<(text: string) => void> = [];

  constructor(private callbacks: PoppinsRealtimeCallbacks = {}) {}

  get isConnected() {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(household: HouseholdSnapshot, metrics: OrbitMetrics): Promise<boolean> {
    if (!isPoppinsRealtimeEnabled()) {
      return false;
    }

    try {
      const session = await mintRealtimeSession(household, metrics);
      if (!session) {
        return false;
      }

      this.model = session.model;
      const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.model)}`;
      this.ws = new WebSocket(url, [
        'realtime',
        `openai-insecure-api-key.${session.clientSecret}`,
        'openai-beta.realtime-v1',
      ]);

      await new Promise<void>((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('WebSocket missing'));
          return;
        }
        const timer = setTimeout(() => reject(new Error('Realtime connect timeout')), 12000);
        this.ws.onopen = () => {
          clearTimeout(timer);
          this.connected = true;
          this.callbacks.onStateChange?.('idle');
          resolve();
        };
        this.ws.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Realtime WebSocket error'));
        };
      });

      this.ws.onmessage = (event) => {
        void this.handleMessage(String(event.data));
      };
      this.ws.onclose = () => {
        this.connected = false;
        this.callbacks.onStateChange?.('idle');
      };

      this.send({
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          tools: POPPINS_TOOL_DEFINITIONS.map((tool) => ({
            type: 'function',
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
          tool_choice: 'auto',
          turn_detection: null,
        },
      });

      return true;
    } catch (error) {
      this.callbacks.onError?.(error instanceof Error ? error.message : String(error));
      this.disconnect();
      return false;
    }
  }

  disconnect() {
    this.connected = false;
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    this.ws = null;
    void stopSpeaking();
    this.callbacks.onStateChange?.('idle');
  }

  private send(payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private resolveWaiters(text: string) {
    const waiters = this.responseWaiters;
    this.responseWaiters = [];
    for (const resolve of waiters) {
      resolve(text);
    }
  }

  private async handleMessage(raw: string) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }

    const type = String(event.type ?? '');

    if (type === 'response.audio_transcript.delta' || type === 'response.text.delta') {
      const delta = String(event.delta ?? '');
      this.assistantBuffer += delta;
      this.callbacks.onStateChange?.('speaking');
      // Stream partial assistant text so the Make-style transcript panel can update live.
      if (this.assistantBuffer.trim()) {
        this.callbacks.onTranscript?.('assistant', this.assistantBuffer);
      }
    }

    if (type === 'response.audio_transcript.done' || type === 'response.text.done') {
      const text = String(event.transcript ?? event.text ?? this.assistantBuffer).trim();
      if (text) {
        this.callbacks.onTranscript?.('assistant', text);
        this.resolveWaiters(text);
        await speakPoppins(text);
      }
      this.assistantBuffer = '';
      this.callbacks.onStateChange?.('idle');
    }

    if (type === 'response.done' && this.assistantBuffer.trim()) {
      const text = this.assistantBuffer.trim();
      this.callbacks.onTranscript?.('assistant', text);
      this.resolveWaiters(text);
      this.assistantBuffer = '';
      this.callbacks.onStateChange?.('idle');
    }

    if (type === 'response.function_call_arguments.done') {
      const name = String(event.name ?? '') as PoppinsToolName;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(String(event.arguments ?? '{}'));
      } catch {
        args = {};
      }
      const callId = String(event.call_id ?? event.callId ?? '');
      const result = (await this.callbacks.onToolCall?.(name, args)) ?? { ok: true };
      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify(result),
        },
      });
      this.send({ type: 'response.create' });
    }

    if (type === 'error') {
      const message = String((event.error as { message?: string })?.message ?? 'Realtime error');
      this.callbacks.onError?.(message);
    }
  }

  async beginListen() {
    this.callbacks.onStateChange?.('listening');
    await Audio.requestPermissionsAsync();
    await startVoiceCapture();
  }

  async endListen(
    household: HouseholdSnapshot,
    metrics: OrbitMetrics
  ): Promise<{ mode: 'realtime' | 'whisper'; answer: PoppinsConversationAnswer }> {
    const uri = await stopVoiceCapture();
    this.callbacks.onStateChange?.('thinking');

    if (!this.isConnected) {
      const answer = await transcribeAndAskPoppins(uri, household, metrics);
      this.callbacks.onTranscript?.('user', answer.question);
      this.callbacks.onTranscript?.('assistant', answer.answer);
      await speakPoppins(answer.answer);
      this.callbacks.onStateChange?.('idle');
      return { mode: 'whisper', answer };
    }

    try {
      const userText = await transcribePoppinsAudio(uri, household, metrics);
      this.callbacks.onTranscript?.('user', userText);

      const replyPromise = new Promise<string>((resolve) => {
        const timer = setTimeout(() => resolve(''), 20000);
        this.responseWaiters.push((text) => {
          clearTimeout(timer);
          resolve(text);
        });
      });

      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: userText }],
        },
      });
      this.assistantBuffer = '';
      this.send({ type: 'response.create' });

      const reply = (await replyPromise).trim();
      if (reply) {
        const answer = { question: userText, answer: reply };
        this.callbacks.onStateChange?.('idle');
        return { mode: 'realtime', answer };
      }

      // Timed out — Whisper fallback
      const answer = await transcribeAndAskPoppins(uri, household, metrics);
      this.callbacks.onTranscript?.('assistant', answer.answer);
      await speakPoppins(answer.answer);
      this.callbacks.onStateChange?.('idle');
      return { mode: 'whisper', answer };
    } catch (error) {
      this.callbacks.onError?.(error instanceof Error ? error.message : String(error));
      const answer = await transcribeAndAskPoppins(uri, household, metrics);
      this.callbacks.onTranscript?.('user', answer.question);
      this.callbacks.onTranscript?.('assistant', answer.answer);
      await speakPoppins(answer.answer);
      this.callbacks.onStateChange?.('idle');
      return { mode: 'whisper', answer };
    }
  }
}

/** Map tool results into monitor-style activity labels for the Poppins Activity feed. */
export function toolCallToMonitorAction(
  name: PoppinsToolName,
  args: Record<string, unknown>,
  result?: Record<string, unknown>
): PoppinsMonitorAction {
  return toolResultToMonitorAction(name, args, result ?? {});
}

export { speakPoppins, stopSpeaking };
