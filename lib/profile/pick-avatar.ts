/**
 * Shared avatar picker — Photos + Apple Image Playground (native iOS only).
 *
 * Whatever the source, the chosen image is copied into the app's document directory
 * before it is stored on `member.avatar`. Image Playground and the Photos picker both
 * hand back URIs in a temporary location the system reclaims, which is how avatars used
 * to turn into blank circles a day later.
 *
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

/** The looks Image Playground can draw. Order matches the picker. */
export const PLAYGROUND_STYLES = ['illustration', 'sketch', 'animation'] as const;
export type PlaygroundStyle = (typeof PLAYGROUND_STYLES)[number];

export const PLAYGROUND_STYLE_LABELS: Record<PlaygroundStyle, string> = {
  illustration: 'Illustration',
  sketch: 'Sketch',
  animation: 'Animation',
};

function normalizeFileUri(path: string): string {
  if (path.startsWith('file://') || path.startsWith('content://') || path.startsWith('data:')) {
    return path;
  }
  return `file://${path}`;
}

function extensionFor(uri: string): string {
  const match = /\.(png|jpg|jpeg|heic|webp)(\?|$)/i.exec(uri);
  return match ? match[1].toLowerCase() : 'png';
}

/**
 * Copy a picked image into `documents/avatars/` and return the lasting URI.
 * Falls back to the original URI if the copy fails, so a picker never dead-ends.
 */
export async function persistAvatarImage(uri: string): Promise<string> {
  try {
    const { Directory, File, Paths } = await import('expo-file-system');
    const folder = new Directory(Paths.document, 'avatars');
    if (!folder.exists) folder.create({ intermediates: true });
    const target = new File(folder, `avatar-${Date.now()}.${extensionFor(uri)}`);
    await new File(uri).copy(target);
    return target.uri;
  } catch {
    return uri;
  }
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

  return persistAvatarImage(result.assets[0].uri);
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

export type PlaygroundRequest = {
  /** The member's name — Playground seeds the character from it. */
  nameHint?: string;
  /** Words the person typed, e.g. "curly hair, red hoodie, holding a skateboard". */
  description?: string;
  /** Which look to open Playground on. */
  style?: PlaygroundStyle;
  /** Optional photo to draw the character from. */
  sourceImageUri?: string | null;
};

/** Split a free-text description into the concept words Playground expects. */
export function conceptsFromDescription(description?: string): string[] {
  return (description ?? '')
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6);
}

/**
 * Present Apple's Image Playground system sheet and return a lasting local file URI,
 * or null if the person backs out. Throws `unavailable` when the native module or the
 * device cannot open Playground (Expo Go, older iPhone, Apple Intelligence off).
 */
export async function createAvatarWithImagePlayground(
  options?: PlaygroundRequest
): Promise<string | null> {
  if (Platform.OS !== 'ios') {
    throw new AvatarPickError('unavailable', 'Image Playground is available on iPhone only.');
  }

  let result: string | null | undefined;
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
    const words = conceptsFromDescription(options?.description);
    const text = [...(hint ? [hint] : []), ...words, 'friendly character', 'profile picture'];

    result = await playground.launchAsync({
      concepts: { text },
      sourceUri: options?.sourceImageUri ?? undefined,
      selectedStyle: options?.style ?? 'illustration',
      allowedStyles: [...PLAYGROUND_STYLES],
      personalizationPolicy: 'automatic',
    });
  } catch (error) {
    if (error instanceof AvatarPickError) throw error;
    throw new AvatarPickError(
      'unavailable',
      'Image Playground is not available in this build. Create a look in the Image Playground app, save it to Photos, then choose it here.'
    );
  }

  if (!result) return null;
  return persistAvatarImage(normalizeFileUri(result));
}

/** Pick a photo to hand Playground as the starting point (no editing, no persistence). */
export async function pickPlaygroundSourcePhoto(): Promise<string> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new AvatarPickError(
      'permission_denied',
      'Allow photo library access to start from a photo.'
    );
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });
  if (result.canceled || !result.assets?.[0]?.uri) {
    throw new AvatarPickError('cancelled', 'No photo selected.');
  }
  return result.assets[0].uri;
}
