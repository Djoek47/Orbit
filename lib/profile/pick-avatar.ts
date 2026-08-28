/**
 * Shared avatar picker — gallery + Apple Image Playground (native iOS only).
 *
 * Persistence today: local URI on `member.avatar` + AsyncStorage override.
 * Cross-device photo sync needs Supabase Storage later (out of scope here).
 */
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type AvatarPickErrorCode = 'permission_denied' | 'cancelled' | 'unavailable' | 'failed';

export class AvatarPickError extends Error {
  code: AvatarPickErrorCode;
  constructor(code: AvatarPickErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'AvatarPickError';
  }
}

function normalizeFileUri(path: string): string {
  if (path.startsWith('file://') || path.startsWith('content://') || path.startsWith('data:')) {
    return path;
  }
  return `file://${path}`;
}

/** Pick a square avatar from the device photo library. */
export async function pickAvatarFromLibrary(): Promise<string> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new AvatarPickError(
      'permission_denied',
      'Allow photo library access to choose a profile picture.'
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    throw new AvatarPickError('cancelled', 'No photo selected.');
  }

  return result.assets[0].uri;
}

/**
 * True when Apple Image Playground can be presented in-process
 * (native iOS build on supported hardware — not Expo Go).
 */
export async function canUseImagePlayground(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const mod = await import('torch-image-playground');
    const playground = mod.default;
    return Boolean(playground?.isSupported?.());
  } catch {
    return false;
  }
}

/**
 * Present Apple’s Image Playground system sheet.
 * Returns a local file URI, or null if the user cancels.
 * Throws `unavailable` when the native module / device cannot open Playground.
 */
export async function createAvatarWithImagePlayground(options?: {
  /** Seed concepts, e.g. member name. */
  nameHint?: string;
}): Promise<string | null> {
  if (Platform.OS !== 'ios') {
    throw new AvatarPickError('unavailable', 'Image Playground is available on iPhone only.');
  }

  try {
    const mod = await import('torch-image-playground');
    const playground = mod.default;
    if (!playground?.isSupported?.()) {
      throw new AvatarPickError(
        'unavailable',
        'Image Playground needs iOS 18.2+, Apple Intelligence, and a supported iPhone.'
      );
    }

    const hint = options?.nameHint?.trim();
    const result = await playground.launchAsync({
      concepts: hint
        ? { text: [hint, 'friendly portrait', 'profile picture'] }
        : { text: ['friendly portrait', 'profile picture'] },
      selectedStyle: 'illustration',
      allowedStyles: ['illustration', 'animation', 'sketch'],
      personalizationPolicy: 'automatic',
    });

    if (!result) return null;
    return normalizeFileUri(result);
  } catch (error) {
    if (error instanceof AvatarPickError) throw error;
    throw new AvatarPickError(
      'unavailable',
      'Image Playground is not available in this build. Create a look in the Image Playground app, save it to Photos, then choose it here.'
    );
  }
}
