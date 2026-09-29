import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export type ProofPickSource = 'camera' | 'library';

async function ensureCameraPermission() {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;
  const requested = await ImagePicker.requestCameraPermissionsAsync();
  return requested.granted;
}

async function ensureLibraryPermission() {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;
  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return requested.granted;
}

/** Capture or pick a single photo to use as task proof. Returns a local URI or null. */
export async function pickProofPhoto(source: ProofPickSource): Promise<string | null> {
  if (source === 'camera') {
    const granted = await ensureCameraPermission();
    if (!granted) {
      Alert.alert('Camera needed', 'Allow camera access to take a proof photo for this task.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0].uri;
  }

  const granted = await ensureLibraryPermission();
  if (!granted) {
    Alert.alert('Photos needed', 'Allow photo library access to attach proof for this task.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

/** Prompt camera vs library, then return a local proof URI (or null if cancelled). */
export function promptPickProofPhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert('Attach proof', 'Add a photo so an admin can review this task.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      {
        text: 'Photo library',
        onPress: () => {
          void pickProofPhoto('library').then(resolve);
        },
      },
      {
        text: 'Take photo',
        onPress: () => {
          void pickProofPhoto('camera').then(resolve);
        },
      },
    ]);
  });
}
