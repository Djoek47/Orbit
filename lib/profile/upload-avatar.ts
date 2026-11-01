/**
 * Upload a local avatar photo so it survives app delete and loads on every device.
 * Image Playground / Photos hand back file:// URIs that only live in this install's
 * documents folder — store an https URL on household_members.avatar_symbol instead.
 */
import { dataMode } from '@/config/data-mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { needsAvatarUpload } from '@/lib/profile/avatar-uri';

export const AVATAR_BUCKET = 'member-avatars';

function guessExt(uri: string, mime?: string): string {
  if (mime?.includes('png')) return 'png';
  if (mime?.includes('webp')) return 'webp';
  if (mime?.includes('heic') || mime?.includes('heif')) return 'heic';
  const m = uri.match(/\.([a-z0-9]+)(?:\?|$)/i);
  if (m?.[1]) return m[1].toLowerCase();
  return 'png';
}

function guessMime(ext: string): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
}

async function readLocalBytes(uri: string): Promise<{ bytes: ArrayBuffer; mime: string; ext: string }> {
  const trimmed = uri.trim();

  if (trimmed.startsWith('data:image')) {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(trimmed);
    if (!match) {
      throw new Error('Could not read that avatar image.');
    }
    const mime = match[1].toLowerCase();
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ext = guessExt(trimmed, mime);
    return { bytes: bytes.buffer, mime, ext };
  }

  const { stabilizeLocalProofUri } = await import('@/lib/tasks/stabilize-proof-uri');
  const stableUri = await stabilizeLocalProofUri(trimmed);

  const FileSystem = await import('expo-file-system/legacy');
  const base64 = await FileSystem.readAsStringAsync(stableUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64 || base64.length < 32) {
    throw new Error('Could not read the avatar photo. Try creating it again.');
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext = guessExt(stableUri);
  return { bytes: bytes.buffer, mime: guessMime(ext), ext };
}

function publicUrlFor(path: string): string {
  const supabase = getSupabaseClient();
  if (!supabase) return path;
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Ensure `avatar` is a durable https URL when it is a local/data photo.
 * Emoji, initials, and existing https URLs pass through unchanged.
 * Mock / offline supabase: keeps the local URI so Expo Go still previews.
 */
export async function resolveAvatarUriForSync(input: {
  avatar: string;
  householdId: string;
  memberId: string;
}): Promise<string> {
  const avatar = input.avatar.trim();
  if (!avatar) return avatar;
  if (!needsAvatarUpload(avatar)) return avatar;

  if (dataMode !== 'supabase') {
    return avatar;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return avatar;
  }

  if (!input.householdId || !input.memberId) {
    return avatar;
  }

  const { bytes, mime, ext } = await readLocalBytes(avatar);
  const path = `${input.householdId}/${input.memberId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: true,
  });

  if (error) {
    throw Object.assign(new Error(error.message || 'avatar_upload_failed'), {
      code: 'avatar_upload_failed',
      path,
    });
  }

  return publicUrlFor(path);
}
