import { Audio } from 'expo-av';

import { useLiveNovaAi } from '@/config/nova-ai-mode';
import { buildNovaHouseholdPayload } from '@/lib/ai/household-context';
import { NOVA_TOOL_DEFINITIONS, type NovaToolName } from '@/lib/ai/nova-tools';
import { getSupabaseClient } from '@/lib/supabase/client';
import {
  startVoiceCapture,
  stopVoiceCapture,
  speakNova,
  stopSpeaking,
  transcribeAndAskNova,
  transcribeNovaAudio,
} from '@/lib/voice/nova-voice';
import type {
  HouseholdSnapshot,
  NovaConversationAnswer,
  NovaMonitorAction,
  OrbitMetrics,
} from '@/types/orbit';

export type NovaRealtimeVisualState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type NovaRealtimeCallbacks = {
  onStateChange?: (state: NovaRealtimeVisualState) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string) => void;
  onToolCall?: (name: NovaToolName, args: Record<string, unknown>) => Promise<unknown> | unknown;
  onError?: (message: string) => void;
};

export function isNovaRealtimeEnabled() {
  return process.env.EXPO_PUBLIC_NOVA_REALTIME === '1' && useLiveNovaAi;
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

  const res = await fetch(`${baseUrl}/functions/v1/nova-realtime-session`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      householdId: household.id,
      householdContext: buildNovaHouseholdPayload(household, metrics),
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
    model: payload.model ?? 'gpt-4o-realtime-preview',
    expiresAt: payload.expiresAt,
    voice: payload.voice,
  };
}

/**
 * OpenAI Realtime voice layer for Expo Go (WebSocket).
 * Mic audio is transcribed via Whisper (PCM streaming is limited in Expo Go),
 * then injected as a text turn into Realtime for tool-aware replies.
 * Falls back to full Whisper + TTS via nova-voice when session mint/connect fails.
 */
export class NovaRealtimeSession {
  private ws: WebSocket | null = null;
  private model = 'gpt-4o-realtime-preview';
  private assistantBuffer = '';
  private connected = false;
  private responseWaiters: Array<(text: string) => void> = [];

  constructor(private callbacks: NovaRealtimeCallbacks = {}) {}

  get isConnected() {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(household: HouseholdSnapshot, metrics: OrbitMetrics): Promise<boolean> {
    if (!isNovaRealtimeEnabled()) {
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
          tools: NOVA_TOOL_DEFINITIONS.map((tool) => ({
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
    }

    if (type === 'response.audio_transcript.done' || type === 'response.text.done') {
      const text = String(event.transcript ?? event.text ?? this.assistantBuffer).trim();
      if (text) {
        this.callbacks.onTranscript?.('assistant', text);
        this.resolveWaiters(text);
        await speakNova(text);
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
      const name = String(event.name ?? '') as NovaToolName;
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
  ): Promise<{ mode: 'realtime' | 'whisper'; answer: NovaConversationAnswer }> {
    const uri = await stopVoiceCapture();
    this.callbacks.onStateChange?.('thinking');

    if (!this.isConnected) {
      const answer = await transcribeAndAskNova(uri, household, metrics);
      this.callbacks.onTranscript?.('user', answer.question);
      this.callbacks.onTranscript?.('assistant', answer.answer);
      await speakNova(answer.answer);
      this.callbacks.onStateChange?.('idle');
      return { mode: 'whisper', answer };
    }

    try {
      const userText = await transcribeNovaAudio(uri, household, metrics);
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
      const answer = await transcribeAndAskNova(uri, household, metrics);
      this.callbacks.onTranscript?.('assistant', answer.answer);
      await speakNova(answer.answer);
      this.callbacks.onStateChange?.('idle');
      return { mode: 'whisper', answer };
    } catch (error) {
      this.callbacks.onError?.(error instanceof Error ? error.message : String(error));
      const answer = await transcribeAndAskNova(uri, household, metrics);
      this.callbacks.onTranscript?.('user', answer.question);
      this.callbacks.onTranscript?.('assistant', answer.answer);
      await speakNova(answer.answer);
      this.callbacks.onStateChange?.('idle');
      return { mode: 'whisper', answer };
    }
  }
}

/** Map tool results into monitor-style activity labels for the Nova Activity feed. */
export function toolCallToMonitorAction(
  name: NovaToolName,
  args: Record<string, unknown>
): NovaMonitorAction {
  const now = new Date().toISOString();
  switch (name) {
    case 'nudge_member':
      return {
        id: `rt-nudge-${now}`,
        kind: 'nudge',
        label: `Nudged ${args.memberName ?? 'member'}`,
        detail: String(args.reason ?? ''),
        createdAt: now,
      };
    case 'scan_deals':
      return {
        id: `rt-deals-${now}`,
        kind: 'deals',
        label: 'Scanned deals',
        detail: 'Checked mock catalog for household matches',
        createdAt: now,
      };
    case 'propose_plan':
      return {
        id: `rt-plan-${now}`,
        kind: 'plan',
        label: String(args.title ?? 'Proposed plan'),
        detail: String(args.detail ?? ''),
        createdAt: now,
      };
    case 'assess_xp_fairness':
      return {
        id: `rt-xp-${now}`,
        kind: 'xp_fairness',
        label: 'Assessed XP fairness',
        detail: 'Reviewed weekly XP balance',
        createdAt: now,
      };
    case 'ask_for_info':
      return {
        id: `rt-ask-${now}`,
        kind: 'ask_info',
        label: `Asked ${args.memberName ?? 'member'}`,
        detail: String(args.question ?? ''),
        createdAt: now,
      };
    case 'list_holidays':
      return {
        id: `rt-holiday-${now}`,
        kind: 'holiday',
        label: 'Checked holidays',
        detail: 'Reviewed who is away',
        createdAt: now,
      };
    default:
      return {
        id: `rt-${name}-${now}`,
        kind: 'monitor',
        label: name.replace(/_/g, ' '),
        detail: JSON.stringify(args),
        createdAt: now,
      };
  }
}

export { speakNova, stopSpeaking };
