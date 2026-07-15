import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

let recording: Audio.Recording | null = null;

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

/**
 * Converts a short voice prompt into text for Nova.
 * Production: send audio to a speech-to-text edge function.
 * Until then, returns a calm default prompt so the voice path is exercisable.
 */
export async function transcribeVoicePrompt(_uri: string | null): Promise<string> {
  return 'What should our household focus on right now?';
}
