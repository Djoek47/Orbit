/**
 * Poppins Divine Voice — WebRTC full-duplex session (TestFlight / EAS native).
 *
 * Footguns (non-negotiable):
 * 1. Server SDP via poppins-realtime-sdp as JSON (never FormData — iOS 27 RCTBlobManager).
 * 2. After every tool: function_call_output THEN response.create (session audio; never response.modalities).
 * 3. Tool order: parallel reads → serial mutations → end_session last.
 * 4. Voice path uses poppins-voice-tool with forceRiskyConfirmation.
 *
 * Expo Go: react-native-webrtc is unavailable — callers degrade to text + IUI only.
 */

import { AppState, type AppStateStatus, Platform } from 'react-native';

import { buildPoppinsHouseholdPayload } from '@/lib/ai/household-context';
import { resolveMajordomoProfileId } from '@/lib/ai/majordomo-profiles';
import { orderPoppinsToolCalls, type PoppinsToolName } from '@/lib/ai/poppins-tools';
import { getSupabaseClient } from '@/lib/supabase/client';
import { configurePoppinsSpeakerAudio, restorePoppinsAudio } from '@/lib/voice/audio-route';
import { mergeTranscript } from '@/lib/voice/transcript-merge';
import { formatStageTapUserLine } from '@/lib/poppins/stage-tap';
import {
  disposeRealtimeError,
  planStageTap,
  type VoiceTapPhase,
} from '@/lib/poppins/realtime-error';
import {
  beginVoiceAudioEpoch,
  currentVoiceAudioEpoch,
  markVoiceNativeClosePending,
  resolveLiveVoiceHousehold,
  VOICE_NATIVE_CLOSE_MS,
  waitForPendingVoiceNativeSettle,
} from '@/lib/voice/voice-lifecycle';
import type { HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

export {
  beginVoiceAudioEpoch,
  currentVoiceAudioEpoch,
  markVoiceNativeClosePending,
  remainingVoiceSettleMs,
  resolveLiveVoiceHousehold,
  VOICE_NATIVE_CLOSE_MS,
  VOICE_NATIVE_SETTLE_MS,
  VOICE_TEARDOWN_SETTLE_MS,
  waitForPendingVoiceNativeSettle,
} from '@/lib/voice/voice-lifecycle';
export { resetVoiceNativeClosePendingForTests } from '@/lib/voice/voice-lifecycle';

export type PoppinsVoiceVisualState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'needs_attention';

export type PoppinsPendingConfirmation = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
};

export type PoppinsVoiceSessionCallbacks = {
  onStateChange?: (state: PoppinsVoiceVisualState) => void;
  onTranscript?: (
    role: 'user' | 'assistant',
    text: string,
    meta?: { replace?: boolean }
  ) => void;
  onPendingConfirmations?: (items: PoppinsPendingConfirmation[]) => void;
  onUiActions?: (actions: Array<Record<string, unknown>>) => void;
  onSessionEnd?: (reason: string) => void;
  onError?: (message: string) => void;
  /** Soft idle check-in fired once before hangup. */
  onSoftIdlePrompt?: () => void;
  /** Remote WebRTC stream URL for a hidden RTCView (audio sink). */
  onRemoteStream?: (url: string | null) => void;
  /** Live household — tools must not freeze the connect-time snapshot. */
  getHousehold?: () => HouseholdSnapshot | null | undefined;
};

type WebRtcModule = {
  mediaDevices: {
    getUserMedia: (constraints: object) => Promise<MediaStream>;
  };
  RTCPeerConnection: new (config?: object) => RTCPeerConnectionLike;
  MediaStream: new () => MediaStream;
  RTCSessionDescription: new (init: { type: string; sdp: string }) => { type: string; sdp: string };
};

type RTCPeerConnectionLike = {
  addTrack: (track: MediaStreamTrack, stream: MediaStream) => void;
  createDataChannel: (label: string) => RTCDataChannelLike;
  createOffer: (options?: object) => Promise<{ type: string; sdp: string }>;
  setLocalDescription: (desc: { type: string; sdp: string }) => Promise<void>;
  setRemoteDescription: (desc: { type: string; sdp: string }) => Promise<void>;
  close: () => void;
  ontrack: ((event: { streams: MediaStream[] }) => void) | null;
  oniceconnectionstatechange: (() => void) | null;
  iceConnectionState: string;
  getSenders?: () => Array<{ track?: MediaStreamTrack | null }>;
};

type RTCDataChannelLike = {
  readyState: string;
  label: string;
  send: (data: string) => void;
  close: () => void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: (() => void) | null;
};

type MediaStream = {
  getTracks: () => MediaStreamTrack[];
  getAudioTracks: () => MediaStreamTrack[];
  toURL?: () => string;
};

type MediaStreamTrack = {
  stop: () => void;
  enabled: boolean;
  kind: string;
  readyState?: string;
};

let cachedWebRtc: WebRtcModule | null | undefined;

export function isPoppinsVoiceWebRtcEnabled(): boolean {
  return process.env.EXPO_PUBLIC_POPPINS_VOICE_WEBRTC === '1';
}

export function loadReactNativeWebRtc(): WebRtcModule | null {
  if (cachedWebRtc !== undefined) return cachedWebRtc;
  if (Platform.OS === 'web') {
    cachedWebRtc = null;
    return null;
  }
  try {
    // Native-only; Expo Go will throw / return empty.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-webrtc') as WebRtcModule;
    if (!mod?.RTCPeerConnection || !mod?.mediaDevices?.getUserMedia) {
      cachedWebRtc = null;
      return null;
    }
    cachedWebRtc = mod;
    return mod;
  } catch {
    cachedWebRtc = null;
    return null;
  }
}

export function isPoppinsNativeVoiceAvailable(): boolean {
  return isPoppinsVoiceWebRtcEnabled() && loadReactNativeWebRtc() != null;
}

let warmedMic: MediaStream | null = null;

function streamHasLiveAudio(stream: MediaStream | null): boolean {
  if (!stream) return false;
  const tracks = stream.getAudioTracks?.() ?? stream.getTracks();
  return tracks.some((track) => {
    if (track.enabled === false) return false;
    return track.readyState !== 'ended';
  });
}

/** Prefetch mic after permission — does not mint a Realtime session. */
export async function warmPoppinsMicrophone(): Promise<boolean> {
  const webrtc = loadReactNativeWebRtc();
  if (!webrtc) return false;
  try {
    const { Audio } = await import('expo-av');
    const perm = await Audio.getPermissionsAsync();
    if (!perm.granted) return false;
  } catch {
    return false;
  }
  try {
    if (streamHasLiveAudio(warmedMic)) return true;
    releaseWarmedMicrophone();
    await configurePoppinsSpeakerAudio();
    warmedMic = await webrtc.mediaDevices.getUserMedia({ audio: true, video: false });
    return streamHasLiveAudio(warmedMic);
  } catch {
    releaseWarmedMicrophone();
    return false;
  }
}

export function takeWarmedMicrophone(): MediaStream | null {
  const stream = warmedMic;
  if (!streamHasLiveAudio(stream)) {
    releaseWarmedMicrophone();
    return null;
  }
  warmedMic = null;
  return stream;
}

export function releaseWarmedMicrophone() {
  try {
    warmedMic?.getTracks().forEach((track) => track.stop());
  } catch {
    /* ignore */
  }
  warmedMic = null;
}

const livePoppinsVoiceSessions = new Set<{ disconnect: () => void }>();

/** Close every live WebRTC session before auth remounts the JS tree. */
export function teardownAllPoppinsVoice(except?: { disconnect: () => void }): void {
  for (const session of [...livePoppinsVoiceSessions]) {
    if (except && session === except) continue;
    try {
      session.disconnect();
    } catch {
      /* already down */
    }
  }
  if (!except) livePoppinsVoiceSessions.clear();
}

/** Unbind + close, then wait for native void methods to drain. */
export async function teardownAllPoppinsVoiceAndSettle(
  except?: { disconnect: () => void }
): Promise<void> {
  teardownAllPoppinsVoice(except);
  await waitForPendingVoiceNativeSettle();
}

const SOFT_IDLE_MS = Number(process.env.EXPO_PUBLIC_POPPINS_VOICE_SOFT_PROMPT_MS ?? 50_000);
const HANGUP_IDLE_MS = Number(process.env.EXPO_PUBLIC_POPPINS_VOICE_IDLE_MS ?? 90_000);
const BACKGROUND_HANGUP_MS = Number(process.env.EXPO_PUBLIC_POPPINS_VOICE_BACKGROUND_MS ?? 20_000);
const THINKING_RECOVERY_MS = 14_000;
const OPENER_DELAY_MS = 350;

type PendingToolCall = {
  call_id: string;
  name: string;
  arguments: string;
};

async function authHeaders(): Promise<Record<string, string> | null> {
  const supabase = getSupabaseClient();
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabase || !baseUrl) return null;
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) return null;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (anon) headers.apikey = anon;
  return headers;
}

export class PoppinsVoiceSession {
  private pc: RTCPeerConnectionLike | null = null;
  private dc: RTCDataChannelLike | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private connected = false;
  private fatal = false;
  private state: PoppinsVoiceVisualState = 'idle';
  private assistantBuffer = '';
  private publishedAssistant = '';
  private userTranscriptBuffer = '';
  private pendingUserReplace = false;
  private pendingTools = new Map<string, PendingToolCall>();
  private softIdleFired = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private softTimer: ReturnType<typeof setTimeout> | null = null;
  private thinkingTimer: ReturnType<typeof setTimeout> | null = null;
  private backgroundTimer: ReturnType<typeof setTimeout> | null = null;
  private appStateSub: { remove: () => void } | null = null;
  private household: HouseholdSnapshot | null = null;
  private metrics: OrbitMetrics | null = null;
  private memberProfileId: string | null = null;
  private pausedForTools = false;
  private openerInstructions: string | null = null;
  private heardUserBeforeOpen = false;
  private openerTimer: ReturnType<typeof setTimeout> | null = null;
  private listenPrompt = '';
  private seedTurns: Array<{ role: 'user' | 'assistant'; text: string }> = [];
  private memoryHint = '';
  private toreDown = false;
  private nativeCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private audioEpoch = 0;
  private responseInFlight = false;
  private pendingStageTap: { tap: { kind: string; text: string }; needsReply: boolean } | null =
    null;

  constructor(private callbacks: PoppinsVoiceSessionCallbacks = {}) {
    livePoppinsVoiceSessions.add(this);
  }

  get isConnected() {
    return this.connected && this.dc?.readyState === 'open';
  }

  get remoteMediaStream() {
    return this.remoteStream;
  }

  private setState(next: PoppinsVoiceVisualState) {
    if (this.fatal && next !== 'idle') return;
    this.state = next;
    this.callbacks.onStateChange?.(next);
    if (next === 'thinking' || next === 'speaking' || this.pausedForTools) {
      this.clearIdleTimers();
    } else if (next === 'listening' && this.connected) {
      this.armIdleTimers();
    }
  }

  private clearIdleTimers() {
    if (this.softTimer) clearTimeout(this.softTimer);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.softTimer = null;
    this.idleTimer = null;
  }

  private armIdleTimers() {
    this.clearIdleTimers();
    if (!this.connected) return;
    if (!this.softIdleFired) {
      this.softTimer = setTimeout(() => {
        if (this.state !== 'listening' || this.pausedForTools) return;
        this.softIdleFired = true;
        this.callbacks.onSoftIdlePrompt?.();
        this.sendEvent({
          type: 'response.create',
          response: {
            instructions:
              'Soft idle check-in only: ask once, briefly, if they are still there. Do not list options.',
          },
        });
      }, SOFT_IDLE_MS);
    }
    this.idleTimer = setTimeout(() => {
      if (this.pausedForTools || this.state === 'speaking' || this.state === 'thinking') return;
      void this.end('idle_timeout');
    }, this.softIdleFired ? HANGUP_IDLE_MS : SOFT_IDLE_MS + HANGUP_IDLE_MS);
  }

  private noteUserActivity() {
    this.softIdleFired = false;
    if (this.connected && this.state === 'listening') {
      this.armIdleTimers();
    }
  }

  async connect(
    household: HouseholdSnapshot,
    metrics: OrbitMetrics,
    memberProfileId?: string | null,
    opts?: {
      pageContext?: string;
      capabilityProfile?: string;
      /** @deprecated Use openerInstructions. false = listen only. */
      greet?: boolean;
      /** If set, speak this after a short listen window — never a self-intro. */
      openerInstructions?: string | null;
      listenPrompt?: string;
      seedTurns?: Array<{ role: 'user' | 'assistant'; text: string }>;
      memoryHint?: string | null;
    }
  ): Promise<boolean> {
    const webrtc = loadReactNativeWebRtc();
    if (!webrtc) {
      this.callbacks.onError?.('Voice needs the TestFlight build (WebRTC).');
      return false;
    }
    if (!isPoppinsVoiceWebRtcEnabled()) {
      this.callbacks.onError?.('Native Poppins voice is not enabled in this build.');
      return false;
    }

    this.household = household;
    this.metrics = metrics;
    this.memberProfileId = memberProfileId ?? null;
    this.openerInstructions = opts?.openerInstructions?.trim() || null;
    this.heardUserBeforeOpen = false;
    if (this.openerTimer) {
      clearTimeout(this.openerTimer);
      this.openerTimer = null;
    }
    this.listenPrompt = opts?.listenPrompt?.trim() ?? '';
    this.seedTurns = opts?.seedTurns?.filter((turn) => turn.text.trim()) ?? [];
    this.memoryHint = opts?.memoryHint?.trim() ?? '';
    this.fatal = false;
    this.toreDown = false;
    this.audioEpoch = beginVoiceAudioEpoch();
    this.setState('connecting');

    await teardownAllPoppinsVoiceAndSettle(this);

    try {
      const headers = await authHeaders();
      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!headers || !baseUrl) {
        this.callbacks.onError?.('Sign in required for live voice.');
        this.setState('idle');
        return false;
      }

      await configurePoppinsSpeakerAudio();

      this.localStream = await webrtc.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      this.pc = new webrtc.RTCPeerConnection({});
      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream);
      }

      this.pc.ontrack = (event) => {
        this.remoteStream = event.streams[0] ?? null;
        const url = this.remoteStream?.toURL?.() ?? null;
        this.callbacks.onRemoteStream?.(url);
        void configurePoppinsSpeakerAudio();
      };
      this.pc.oniceconnectionstatechange = () => {
        if (this.pc?.iceConnectionState === 'connected' || this.pc?.iceConnectionState === 'completed') {
          void configurePoppinsSpeakerAudio();
        }
      };

      this.dc = this.pc.createDataChannel('oai-events');
      this.dc.onopen = () => {
        this.connected = true;
        this.setState('listening');
        this.armIdleTimers();
        for (const turn of this.seedTurns) {
          this.sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: turn.role,
              content: [{ type: 'input_text', text: turn.text }],
            },
          });
        }
        if (this.openerInstructions) {
          this.openerTimer = setTimeout(() => {
            this.openerTimer = null;
            if (this.heardUserBeforeOpen || !this.openerInstructions) return;
            this.sendEvent({
              type: 'response.create',
              response: { instructions: this.openerInstructions },
            });
            this.responseInFlight = true;
          }, OPENER_DELAY_MS);
        }
      };
      this.dc.onmessage = (event) => {
        void this.handleServerEvent(String(event.data));
      };
      this.dc.onclose = () => {
        this.connected = false;
      };

      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await this.pc.setLocalDescription(offer);

      const majordomoProfileId = resolveMajordomoProfileId({
        householdProfileId: household.majordomoProfileId,
        memberProfileId,
      });

      const sessionPayload = {
        householdId: household.id,
        majordomoProfileId,
        householdContext: buildPoppinsHouseholdPayload(household, metrics, [], {
          memberProfileId,
          memoryHint: this.memoryHint,
        }),
        pageContext: [opts?.pageContext ?? 'poppins', this.listenPrompt, this.memoryHint]
          .filter(Boolean)
          .join('\n'),
        capabilityProfile: opts?.capabilityProfile ?? 'Daily',
        billingPending: true,
      };

      const res = await fetch(`${baseUrl}/functions/v1/poppins-realtime-sdp`, {
        method: 'POST',
        headers: {
          ...headers,
          Accept: 'text/plain',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          sdp: offer.sdp ?? '',
          ...sessionPayload,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.callbacks.onError?.(`Realtime SDP failed (${res.status}).`);
        console.warn('[poppins-voice] sdp error', errText.slice(0, 400));
        this.disconnect();
        return false;
      }

      const answerSdp = await res.text();
      await this.pc.setRemoteDescription(
        new webrtc.RTCSessionDescription({ type: 'answer', sdp: answerSdp })
      );

      this.appStateSub = AppState.addEventListener('change', this.onAppState);
      return true;
    } catch (error) {
      this.callbacks.onError?.(error instanceof Error ? error.message : String(error));
      this.disconnect();
      return false;
    }
  }

  private onAppState = (next: AppStateStatus) => {
    if (next === 'background' || next === 'inactive') {
      if (this.backgroundTimer) clearTimeout(this.backgroundTimer);
      this.backgroundTimer = setTimeout(() => {
        void this.end('app_background');
      }, BACKGROUND_HANGUP_MS);
    } else if (next === 'active') {
      if (this.backgroundTimer) clearTimeout(this.backgroundTimer);
      this.backgroundTimer = null;
      this.noteUserActivity();
    }
  };

  private publishAssistant(text: string, replace = false) {
    const next = replace ? text.trim() : mergeTranscript(this.publishedAssistant, text);
    if (!next || next === this.publishedAssistant) return;
    const isReplace = replace || !this.publishedAssistant;
    this.publishedAssistant = next;
    this.callbacks.onTranscript?.('assistant', next, { replace: isReplace });
  }

  private sendEvent(payload: Record<string, unknown>) {
    if (this.dc?.readyState !== 'open') return;
    try {
      this.dc.send(JSON.stringify(payload));
    } catch (error) {
      console.warn('[poppins-voice] dc.send', error);
    }
  }

  /** Type into the same live conversation (accessibility / twin text). */
  sendUserText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !this.isConnected) return false;
    this.noteUserActivity();
    this.callbacks.onTranscript?.('user', trimmed, { replace: true });
    this.setState('thinking');
    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: trimmed }],
      },
    });
    this.sendEvent({
      type: 'response.create',
    });
    return true;
  }

  /**
   * Finger used the IUI. Tell the live Realtime session what they pressed
   * (data channel — not a webhook). Cancel only if a response is in flight;
   * cancel-while-listening is what used to hang up the call.
   */
  notifyStageTap(tap: { kind: string; text: string }, opts?: { needsReply?: boolean }) {
    if (!this.isConnected) return;
    this.noteUserActivity();
    const needsReply = opts?.needsReply === true;
    const phase: VoiceTapPhase = this.pausedForTools
      ? 'tools'
      : this.state === 'speaking'
        ? 'speaking'
        : this.state === 'thinking'
          ? 'thinking'
          : 'listening';
    const plan = planStageTap(phase, this.responseInFlight);
    if (plan === 'queue_until_idle') {
      this.pendingStageTap = { tap, needsReply };
      return;
    }
    if (plan === 'cancel_then_inject') {
      this.pendingStageTap = { tap, needsReply };
      this.sendEvent({ type: 'response.cancel' });
      this.setState('listening');
      return;
    }
    this.injectStageTap(tap, needsReply);
  }

  private injectStageTap(tap: { kind: string; text: string }, needsReply: boolean) {
    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: formatStageTapUserLine(tap) }],
      },
    });
    if (needsReply) {
      this.responseInFlight = true;
      this.sendEvent({
        type: 'response.create',
        response: {
          instructions:
            'They used the IUI. Do not re-offer that choice. If something is still unknown, ask only for that in one short sentence. Otherwise stay quiet.',
        },
      });
      this.setState('thinking');
      return;
    }
    this.setState('listening');
  }

  private flushPendingStageTap() {
    const pending = this.pendingStageTap;
    if (!pending) return;
    this.pendingStageTap = null;
    this.injectStageTap(pending.tap, pending.needsReply);
  }

  private clearThinkingRecovery() {
    if (this.thinkingTimer) clearTimeout(this.thinkingTimer);
    this.thinkingTimer = null;
  }

  private armThinkingRecovery() {
    this.clearThinkingRecovery();
    this.thinkingTimer = setTimeout(() => {
      if (this.state !== 'thinking' || !this.isConnected) return;
      this.sendEvent({
        type: 'response.create',
        response: {
          instructions:
            'You went quiet after tools. Speak a one-sentence status update now. Do not call more tools unless needed.',
        },
      });
    }, THINKING_RECOVERY_MS);
  }

  private async handleServerEvent(raw: string) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    const type = String(event.type ?? '');

    if (
      type === 'input_audio_buffer.speech_started' ||
      type === 'input_audio_buffer.committed'
    ) {
      this.heardUserBeforeOpen = true;
      if (this.openerTimer) {
        clearTimeout(this.openerTimer);
        this.openerTimer = null;
      }
      if (type === 'input_audio_buffer.committed') {
        this.noteUserActivity();
        return;
      }
      this.noteUserActivity();
      this.setState('listening');
      this.pendingUserReplace = true;
      this.userTranscriptBuffer = '';
      this.publishedAssistant = '';
      this.callbacks.onTranscript?.('user', '', { replace: true });
    }

    if (type === 'conversation.item.input_audio_transcription.delta') {
      this.noteUserActivity();
      this.setState('listening');
      const delta = String(event.delta ?? event.transcript ?? '').trim();
      if (delta) {
        const next = this.pendingUserReplace
          ? delta
          : mergeTranscript(this.userTranscriptBuffer, delta);
        const replace = this.pendingUserReplace;
        this.pendingUserReplace = false;
        this.userTranscriptBuffer = next;
        this.callbacks.onTranscript?.('user', next, { replace });
      }
    }

    if (type === 'conversation.item.input_audio_transcription.completed') {
      const transcript = String(event.transcript ?? '').trim();
      if (transcript) {
        const next = mergeTranscript(this.userTranscriptBuffer, transcript);
        const replace = this.pendingUserReplace || !this.userTranscriptBuffer;
        this.pendingUserReplace = false;
        this.userTranscriptBuffer = next;
        this.callbacks.onTranscript?.('user', next, { replace });
      }
      this.noteUserActivity();
    }

    if (
      type === 'response.output_audio_transcript.delta' ||
      type === 'response.audio_transcript.delta' ||
      type === 'response.output_text.delta' ||
      type === 'response.text.delta'
    ) {
      this.clearThinkingRecovery();
      const delta = String(event.delta ?? '');
      const starting = !this.assistantBuffer;
      if (starting) this.publishedAssistant = '';
      this.assistantBuffer += delta;
      this.setState('speaking');
      if (this.assistantBuffer.trim()) {
        this.publishAssistant(this.assistantBuffer, starting);
      }
    }

    if (
      type === 'response.output_audio_transcript.done' ||
      type === 'response.audio_transcript.done' ||
      type === 'response.output_text.done' ||
      type === 'response.text.done'
    ) {
      const text = String(event.transcript ?? event.text ?? this.assistantBuffer).trim();
      if (text) this.publishAssistant(text);
      this.assistantBuffer = '';
    }

    if (type === 'response.created') {
      this.responseInFlight = true;
    }

    if (type === 'response.done' || type === 'response.cancelled') {
      this.clearThinkingRecovery();
      this.responseInFlight = false;
      if (this.assistantBuffer.trim()) {
        this.publishAssistant(this.assistantBuffer.trim());
        this.assistantBuffer = '';
      }
      if (this.connected) this.setState('listening');
      this.flushPendingStageTap();
    }

    if (type === 'response.function_call_arguments.done') {
      const callId = String(event.call_id ?? '');
      const name = String(event.name ?? '');
      const args = String(event.arguments ?? '{}');
      this.pendingTools.set(callId || name, { call_id: callId, name, arguments: args });
      // Batch: wait briefly for parallel tool events, then flush.
      this.setState('thinking');
      this.pausedForTools = true;
      this.clearIdleTimers();
      await this.flushPendingTools();
    }

    if (type === 'error') {
      const disposition = disposeRealtimeError(event);
      if (disposition === 'inject_pending_tap') {
        this.responseInFlight = false;
        this.flushPendingStageTap();
        return;
      }
      if (disposition === 'keep_going') {
        this.responseInFlight = true;
        return;
      }
      const err = (event.error as { message?: string } | undefined) ?? event;
      const message = String(err.message ?? 'Realtime error');
      this.fatal = true;
      this.callbacks.onError?.(message);
      this.disconnect();
    }
  }

  private flushLock: Promise<void> | null = null;

  private async flushPendingTools() {
    if (this.flushLock) {
      await this.flushLock;
      return;
    }
    this.flushLock = (async () => {
      // Micro-batch parallel function calls arriving together.
      await new Promise((r) => setTimeout(r, 80));
      const calls = [...this.pendingTools.values()];
      this.pendingTools.clear();
      if (!calls.length) return;

      const ordered = orderPoppinsToolCalls(calls);
      const results = await this.executeVoiceTools(ordered);

      for (let i = 0; i < ordered.length; i++) {
        const call = ordered[i]!;
        const result = results[i] ?? { ok: true };
        if (call.call_id) {
          this.sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: call.call_id,
              output: JSON.stringify(result),
            },
          });
        } else {
          // Missing call_id — inject as text context so the model can continue.
          this.sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: `[tool ${call.name} result] ${JSON.stringify(result)}`,
                },
              ],
            },
          });
        }

        const pending = (result as { pending_confirmations?: PoppinsPendingConfirmation[] })
          .pending_confirmations;
        if (pending?.length) {
          this.callbacks.onPendingConfirmations?.(pending);
          this.setState('needs_attention');
        }
        const uiActions = (result as { ui_actions?: Array<Record<string, unknown>> }).ui_actions;
        if (uiActions?.length) this.callbacks.onUiActions?.(uiActions);
        if ((result as { session_control?: string }).session_control === 'end') {
          this.pausedForTools = false;
          // Mandatory spoken close then hangup is owned by model; client ends after audio settles.
          this.sendEvent({
            type: 'response.create',
            response: {
              instructions: 'Say a brief goodbye in one short sentence, then stop.',
            },
          });
          setTimeout(() => void this.end('end_session_tool'), 4000);
          return;
        }
      }

      // NON-NEGOTIABLE: always request spoken response after tools —
      // unless a finger tap is waiting to tell the model what they chose.
      this.pausedForTools = false;
      if (this.pendingStageTap) {
        this.flushPendingStageTap();
      } else {
        this.sendEvent({
          type: 'response.create',
        });
        this.armThinkingRecovery();
      }
    })().finally(() => {
      this.flushLock = null;
    });

    await this.flushLock;
  }

  private liveHousehold(): HouseholdSnapshot | null {
    return resolveLiveVoiceHousehold(this.household, this.callbacks.getHousehold);
  }

  syncHousehold(household: HouseholdSnapshot) {
    this.household = household;
  }

  /** After HOLD createTask — confirm the live list instead of guessing from connect-time. */
  notifyTaskOnTasks(title: string) {
    const trimmed = title.trim();
    if (!trimmed || !this.isConnected) return;
    this.noteUserActivity();
    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `The task “${trimmed}” is on Tasks now.`,
          },
        ],
      },
    });
    this.sendEvent({
      type: 'response.create',
      response: {
        instructions: `Confirm that “${trimmed}” is on Tasks. Do not create it again.`,
      },
    });
    this.setState('thinking');
  }

  private async executeVoiceTools(
    calls: PendingToolCall[]
  ): Promise<Array<Record<string, unknown>>> {
    const headers = await authHeaders();
    const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const household = this.liveHousehold();
    if (!headers || !baseUrl || !household || !this.metrics) {
      return calls.map(() => ({ error: 'unavailable' }));
    }

    try {
      const res = await fetch(`${baseUrl}/functions/v1/poppins-voice-tool`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: household.id,
          household: buildPoppinsHouseholdPayload(household, this.metrics, [], {
            memberProfileId: this.memberProfileId,
            memoryHint: this.memoryHint,
          }),
          metrics: this.metrics,
          calls: calls.map((c) => {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(c.arguments || '{}');
            } catch {
              args = {};
            }
            return { name: c.name as PoppinsToolName, arguments: args, call_id: c.call_id };
          }),
        }),
      });
      if (!res.ok) {
        return calls.map(() => ({ error: `voice_tool_${res.status}` }));
      }
      const payload = await res.json();
      if (Array.isArray(payload.results)) {
        return payload.results.map(
          (r: { result?: Record<string, unknown> }) => r.result ?? { ok: true }
        );
      }
      if (payload.result) return [payload.result];
      return calls.map(() => ({ ok: true }));
    } catch (error) {
      return calls.map(() => ({
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  /** User confirmed or dismissed a risky action sheet. */
  notifyConfirmationResolved(confirmationIds: string[], approved: boolean) {
    if (!this.isConnected) return;
    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: approved
              ? `I confirmed: ${confirmationIds.join(', ')}. Proceed if still appropriate.`
              : `I declined: ${confirmationIds.join(', ')}. Do not execute those actions.`,
          },
        ],
      },
    });
    this.sendEvent({
      type: 'response.create',
    });
    this.setState('thinking');
  }

  async end(reason = 'manual') {
    this.callbacks.onSessionEnd?.(reason);
    this.disconnect();
    await waitForPendingVoiceNativeSettle();
  }

  disconnect() {
    if (this.toreDown) return;
    this.toreDown = true;
    livePoppinsVoiceSessions.delete(this);
    markVoiceNativeClosePending();
    this.connected = false;
    this.fatal = true;
    this.clearIdleTimers();
    this.clearThinkingRecovery();
    if (this.openerTimer) {
      clearTimeout(this.openerTimer);
      this.openerTimer = null;
    }
    if (this.backgroundTimer) clearTimeout(this.backgroundTimer);
    this.backgroundTimer = null;
    this.appStateSub?.remove();
    this.appStateSub = null;
    const pc = this.pc;
    const dc = this.dc;
    const localStream = this.localStream;
    this.dc = null;
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.pausedForTools = false;
    this.responseInFlight = false;
    this.pendingStageTap = null;
    this.publishedAssistant = '';
    this.assistantBuffer = '';
    this.userTranscriptBuffer = '';
    this.pendingUserReplace = false;
    try {
      this.callbacks.onRemoteStream?.(null);
    } catch {
      /* provider already unmounted */
    }
    try {
      this.setState('idle');
    } catch {
      /* provider already unmounted */
    }
    this.fatal = true;
    const closeEpoch = this.audioEpoch;
    const closeNative = () => {
      try {
        dc?.close();
      } catch {
        /* ignore */
      }
      try {
        const signaling = (pc as { signalingState?: string } | null)?.signalingState;
        if (pc && signaling !== 'closed') {
          pc.close();
        }
      } catch {
        /* native close is a void TurboModule — JS catch may not see NSException */
      }
      try {
        localStream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      if (
        currentVoiceAudioEpoch() === closeEpoch &&
        livePoppinsVoiceSessions.size === 0
      ) {
        releaseWarmedMicrophone();
        void restorePoppinsAudio();
      }
    };
    if (this.nativeCloseTimer) clearTimeout(this.nativeCloseTimer);
    this.nativeCloseTimer = setTimeout(() => {
      this.nativeCloseTimer = null;
      closeNative();
    }, VOICE_NATIVE_CLOSE_MS);
  }
}
