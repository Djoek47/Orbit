/**
 * Upload a local proof photo so every household device can load it.
 * Local file:// / ph:// / content:// URIs only work on the capturing device —
 * that is why admins saw an empty Attached photo box.
 */
import { dataMode } from '@/config/data-mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isLocalProofUri, isShareableProofUri } from '@/lib/tasks/proof-uri';

export { isLocalProofUri, isShareableProofUri };
export const PROOF_BUCKET = 'task-proofs';

function guessExt(uri: string, mime?: string): string {
  if (mime?.includes('png')) return 'png';
  if (mime?.includes('webp')) return 'webp';
  if (mime?.includes('heic') || mime?.includes('heif')) return 'heic';
  const m = uri.match(/\.([a-z0-9]+)(?:\?|$)/i);
  if (m?.[1]) return m[1].toLowerCase();
  return 'jpg';
}

function guessMime(ext: string): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(view).toString('base64');
  }
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function readLocalBytes(uri: string): Promise<{ bytes: ArrayBuffer; mime: string; ext: string }> {
  // expo-file-system/legacy — read as base64 then decode (works for camera + library URIs).
  const FileSystem = await import('expo-file-system/legacy');
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext = guessExt(uri);
  return { bytes: bytes.buffer, mime: guessMime(ext), ext };
}

function publicUrlFor(path: string): string {
  const supabase = getSupabaseClient();
  if (!supabase) return path;
  const { data } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Ensure `uri` is a durable https URL (or leave mock/local when offline).
 * Returns the URL to store on the task.
 */
export async function resolveProofUriForSync(input: {
  localUri: string;
  householdId: string;
  taskId: string;
}): Promise<string> {
  const localUri = input.localUri.trim();
  if (!localUri) {
    throw new Error('No photo to send.');
  }

  // Already a remote URL — keep it.
  if (/^https?:\/\//i.test(localUri)) {
    return localUri;
  }

  // Mock / Expo Go without supabase — same device can still preview local files.
  if (dataMode !== 'supabase') {
    return localUri;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return localUri;
  }

  const { bytes, mime, ext } = await readLocalBytes(localUri);
  const path = `${input.householdId}/${input.taskId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: true,
  });

  if (error) {
    throw Object.assign(new Error(error.message || 'proof_upload_failed'), {
      code: 'proof_upload_failed',
      base64: bytesToBase64(bytes),
      mime,
      path,
    });
  }

  // Best-effort mirror row for purge / audit.
  try {
    await supabase.from('task_proofs').insert({
      task_id: input.taskId,
      household_id: input.householdId,
      storage_path: path,
    } as never);
  } catch {
    /* non-fatal */
  }

  return publicUrlFor(path);
}

/** Payload for Sidekick edge upload when the client has no Storage JWT. */
export async function proofBytesForEdge(localUri: string): Promise<{
  proofBase64: string;
  proofMime: string;
  proofExt: string;
}> {
  const { bytes, mime, ext } = await readLocalBytes(localUri);
  return { proofBase64: bytesToBase64(bytes), proofMime: mime, proofExt: ext };
}
