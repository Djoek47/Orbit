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
import { VoiceFailureError, classifyVoiceFailure } from '@/lib/voice/quiet-failures';
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

  const form = new FormData();
  form.append('audio', {
    uri: audioUri,
    name: 'poppins.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);
  form.append('householdId', household.id ?? '');
  form.append('metrics', JSON.stringify(metrics));
  form.append('household', JSON.stringify(buildPoppinsHouseholdPayload(household, metrics)));
  if (transcriptOnly) {
    form.append('transcriptOnly', '1');
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/functions/v1/poppins-voice`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new VoiceFailureError('whisper_failed', detail);
  }

  const payload = await response.json().catch(() => ({} as { error?: string }));
  if (!response.ok || payload.error) {
    const err = String(payload.error ?? `Voice request failed (${response.status})`);
    if (response.status === 401 || response.status === 403) {
      throw new VoiceFailureError('signed_out', err);
    }
    const cause = classifyVoiceFailure(err);
    throw new VoiceFailureError(cause, err);
  }

  return {
    transcript: String(payload.transcript ?? ''),
    answer: String(payload.answer ?? ''),
  };
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
