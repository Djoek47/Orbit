import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

import { buildNovaHouseholdPayload } from '@/lib/ai/household-context';
import { useLiveNovaAi } from '@/config/nova-ai-mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { novaService } from '@/services/nova-service';
import type { HouseholdSnapshot, NovaConversationAnswer, OrbitMetrics } from '@/types/orbit';

export async function speakNova(text: string) {
  Speech.stop();
  Speech.speak(text, {
    language: 'en-US',
    rate: 0.96,
    pitch: 1.0,
  });
}

export async function stopSpeaking() {
  Speech.stop();
}

let recording: Audio.Recording | null = null;

export async function startVoiceCapture() {
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  return recording;
}

export async function stopVoiceCapture() {
  if (!recording) {
    return null;
  }

  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  recording = null;
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  return uri;
}

async function invokeNovaVoice(
  audioUri: string,
  household: HouseholdSnapshot,
  metrics: OrbitMetrics,
  transcriptOnly = false
): Promise<{ transcript: string; answer: string } | null> {
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

  const form = new FormData();
  form.append('audio', {
    uri: audioUri,
    name: 'nova.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);
  form.append('householdId', household.id ?? '');
  form.append('metrics', JSON.stringify(metrics));
  form.append('household', JSON.stringify(buildNovaHouseholdPayload(household, metrics)));
  if (transcriptOnly) {
    form.append('transcriptOnly', '1');
  }

  const response = await fetch(`${baseUrl}/functions/v1/nova-voice`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? 'Voice request failed');
  }

  return {
    transcript: String(payload.transcript ?? ''),
    answer: String(payload.answer ?? ''),
  };
}

/** Whisper-only transcription for Realtime text turns (Expo Go). */
export async function transcribeNovaAudio(
  audioUri: string | null,
  household: HouseholdSnapshot,
  metrics: OrbitMetrics
): Promise<string> {
  const fallbackQuestion = 'What should our household focus on right now?';
  if (!useLiveNovaAi || !audioUri) {
    return fallbackQuestion;
  }
  try {
    const payload = await invokeNovaVoice(audioUri, household, metrics, true);
    return payload?.transcript?.trim() || fallbackQuestion;
  } catch {
    return fallbackQuestion;
  }
}

export async function transcribeAndAskNova(
  audioUri: string | null,
  household: HouseholdSnapshot,
  metrics: OrbitMetrics
): Promise<NovaConversationAnswer> {
  const fallbackQuestion = 'What should our household focus on right now?';

  if (!useLiveNovaAi || !audioUri) {
    return novaService.answerQuestion(fallbackQuestion, household, metrics);
  }

  try {
    const payload = await invokeNovaVoice(audioUri, household, metrics, false);
    if (!payload) {
      return novaService.answerQuestion(fallbackQuestion, household, metrics);
    }
    return {
      question: payload.transcript || fallbackQuestion,
      answer: payload.answer || 'I could not respond just now.',
    };
  } catch {
    return novaService.answerQuestion(fallbackQuestion, household, metrics);
  }
}
