import * as Speech from 'expo-speech';

import { buildPoppinsHouseholdPayload } from '@/lib/ai/household-context';
import { useLivePoppinsAi } from '@/config/poppins-ai-mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { configurePoppinsSpeakerAudio, restorePoppinsAudio } from '@/lib/voice/audio-route';
import {
  finishMicRecorder,
  micUnavailableMessage,
  requestMicPermission,
  startMicRecorder,
} from '@/lib/voice/mic-capture';
import { VoiceFailureError } from '@/lib/voice/quiet-failures';
import { serverNeedsMultipart, voiceResult, type VoiceResponse } from '@/lib/voice/voice-response';
import { poppinsService } from '@/services/poppins-service';
import type { AudioRecorder } from 'expo-audio';
import type { HouseholdSnapshot, PoppinsConversationAnswer, OrbitMetrics } from '@/types/orbit';

export async function speakPoppins(text: string) {
  Speech.stop();
  await restorePoppinsAudio();
  Speech.speak(text, {
    language: 'en-US',
    rate: 0.96,
    pitch: 1.0,
  });
}

export async function stopSpeaking() {
  Speech.stop();
}

let recording: AudioRecorder | null = null;

export async function startVoiceCapture() {
  const allowed = await requestMicPermission();
  if (!allowed) {
    throw new Error(micUnavailableMessage());
  }
  await configurePoppinsSpeakerAudio();
  recording = await startMicRecorder(false);
  return recording;
}

export async function stopVoiceCapture() {
  if (!recording) {
    return null;
  }

  const current = recording;
  recording = null;
  const uri = await finishMicRecorder(current);
  await restorePoppinsAudio();
  return uri;
}

async function invokePoppinsVoice(
  audioUri: string,
  household: HouseholdSnapshot,
  metrics: OrbitMetrics,
  transcriptOnly = false
): Promise<{ transcript: string; answer: string }> {
  const supabase = getSupabaseClient();
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabase || !baseUrl) {
    throw new VoiceFailureError('whisper_failed', 'no_supabase_config');
  }

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) {
    throw new VoiceFailureError('signed_out');
  }

  const url = `${baseUrl}/functions/v1/poppins-voice`;
  const householdPayload = buildPoppinsHouseholdPayload(household, metrics);

  // JSON first: the audio travels as base64 text. A multipart file upload goes through
  // RCTBlobManager, which is what broke the Realtime SDP upload on iOS 27 (see
  // webrtc-teardown.test.ts) — Quiet was never moved off it. An older deployment of the
  // function only reads multipart; if it rejects JSON we fall back to the form upload.
  const audioBase64 = await readAudioBase64(audioUri);
  if (audioBase64) {
    const json = await postVoice(url, token, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        mimeType: 'audio/m4a',
        householdId: household.id ?? '',
        metrics,
        household: householdPayload,
        transcriptOnly,
      }),
    });
    if (!serverNeedsMultipart(json)) return voiceResult(json);
  }

  const form = new FormData();
  form.append('audio', {
    uri: audioUri,
    name: 'poppins.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);
  form.append('householdId', household.id ?? '');
  form.append('metrics', JSON.stringify(metrics));
  form.append('household', JSON.stringify(householdPayload));
  if (transcriptOnly) {
    form.append('transcriptOnly', '1');
  }
  return voiceResult(await postVoice(url, token, { body: form }, 'form'));
}

/** Read the recording as base64 without a multipart upload. Null when unavailable. */
async function readAudioBase64(audioUri: string): Promise<string | null> {
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const data = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return data && data.length > 0 ? data : null;
  } catch (error) {
    console.warn('[poppins-voice] base64 read failed; using form upload', error);
    return null;
  }
}

async function postVoice(
  url: string,
  token: string,
  init: { headers?: Record<string, string>; body: BodyInit },
  via: 'json' | 'form' = 'json'
): Promise<VoiceResponse> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
      body: init.body,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    // The network or the upload itself failed before the function answered.
    throw new VoiceFailureError('whisper_failed', `${via} upload: ${detail}`);
  }
  const payload = (await response.json().catch(() => ({}))) as VoiceResponse['payload'];
  return { status: response.status, ok: response.ok, payload };
}

/** Whisper-only transcription for Realtime text turns (Expo Go). */
export async function transcribePoppinsAudio(
  audioUri: string | null,
  household: HouseholdSnapshot,
  metrics: OrbitMetrics
): Promise<string> {
  const fallbackQuestion = 'What should our household focus on right now?';
  if (!useLivePoppinsAi || !audioUri) {
    return fallbackQuestion;
  }
  try {
    const payload = await invokePoppinsVoice(audioUri, household, metrics, true);
    return payload?.transcript?.trim() || fallbackQuestion;
  } catch {
    return fallbackQuestion;
  }
}

/**
 * Quiet capture transcription. Returns null on empty transcript.
 * Throws VoiceFailureError so Quiet can show a distinct §1.2 line.
 * Never invents a sentence the user did not say.
 */
export async function transcribeQuietAudio(
  audioUri: string | null,
  household: HouseholdSnapshot,
  metrics: OrbitMetrics
): Promise<string | null> {
  if (!useLivePoppinsAi) {
    throw new VoiceFailureError('ai_off');
  }
  if (!audioUri) {
    throw new VoiceFailureError('whisper_failed', 'no_audio_uri');
  }
  const payload = await invokePoppinsVoice(audioUri, household, metrics, true);
  const transcript = payload.transcript?.trim();
  return transcript || null;
}

export async function transcribeAndAskPoppins(
  audioUri: string | null,
  household: HouseholdSnapshot,
  metrics: OrbitMetrics
): Promise<PoppinsConversationAnswer> {
  const fallbackQuestion = 'What should our household focus on right now?';

  if (!useLivePoppinsAi || !audioUri) {
    return poppinsService.answerQuestion(fallbackQuestion, household, metrics);
  }

  try {
    const payload = await invokePoppinsVoice(audioUri, household, metrics, false);
    return {
      question: payload.transcript || fallbackQuestion,
      answer: payload.answer || 'I could not respond just now.',
    };
  } catch {
    return poppinsService.answerQuestion(fallbackQuestion, household, metrics);
  }
}
