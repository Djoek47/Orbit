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
import { ImagePlaygroundNative } from '@/modules/choremaxx-image-playground';

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

/** Why Image Playground can or can't open on this phone. */
export type PlaygroundAvailability =
  | { ok: true }
  | {
      ok: false;
      reason: 'not_ios' | 'not_in_build' | 'os_too_old' | 'apple_intelligence_off';
      /** One sentence the sheet shows as-is. */
      message: string;
    };

/**
 * Ask the native side directly. The reasons are distinct because the fixes are:
 * a build without the module needs a new TestFlight build, an old iOS needs an update,
 * and "off" is a Settings switch (or models still downloading, or a language/region
 * Apple Intelligence doesn't cover yet).
 */
export function imagePlaygroundAvailability(): PlaygroundAvailability {
  if (Platform.OS !== 'ios') {
    return { ok: false, reason: 'not_ios', message: 'Image Playground is on iPhone only.' };
  }
  const native = ImagePlaygroundNative;
  if (!native) {
    return {
      ok: false,
      reason: 'not_in_build',
      message: 'This build of Choremaxx is missing Image Playground. Update from TestFlight.',
    };
  }
  let status: { osSupported?: boolean; available?: boolean } = {};
  try {
    status = native.status();
  } catch {
    status = { osSupported: true, available: Boolean(native.isSupported()) };
  }
  if (!status.osSupported) {
    return {
      ok: false,
      reason: 'os_too_old',
      message: 'Image Playground needs iOS 18.4 or later. Update your iPhone in Settings.',
    };
  }
  if (!status.available) {
    return {
      ok: false,
      reason: 'apple_intelligence_off',
      message:
        'Turn on Apple Intelligence in Settings → Apple Intelligence & Siri, and let it finish downloading. It also needs a language and region Apple Intelligence supports.',
    };
  }
  return { ok: true };
}

/** True when Apple Image Playground can be presented right now. */
export async function canUseImagePlayground(): Promise<boolean> {
  return imagePlaygroundAvailability().ok;
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

  const availability = imagePlaygroundAvailability();
  if (!availability.ok) throw new AvatarPickError('unavailable', availability.message);
  const playground = ImagePlaygroundNative!;

  let result: string | null | undefined;
  try {
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
    // A real failure inside Playground (a photo that wouldn't load, the sheet refusing a
    // style) is not "unavailable" — say what happened.
    const detail = error instanceof Error ? error.message : String(error);
    throw new AvatarPickError(
      'failed',
      /source image/i.test(detail)
        ? "That photo couldn't be opened for Image Playground. Try another one, or start without a photo."
        : `Image Playground stopped: ${detail}`
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
