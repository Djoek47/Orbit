/**
 * Attach screenshots for Support feedback.
 * Prefer Supabase Storage `support-uploads`; fall back to base64 for Resend attachments.
 */
import * as ImagePicker from 'expo-image-picker';

import { getSupabaseClient } from '@/lib/supabase/client';
import { orbitAlert } from '@/components/orbit/orbit-alert';

export const SUPPORT_SHOT_BUCKET = 'support-uploads';
export const MAX_SUPPORT_SHOTS = 3;

export type SupportShot = {
  uri: string;
  /** Public or signed URL when uploaded. */
  url?: string;
  /** Base64 for Resend attachment fallback (no data: prefix). */
  contentBase64?: string;
  contentType: string;
  filename: string;
};

async function ensureLibraryPermission(): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;
  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return requested.granted;
}

export async function pickSupportScreenshot(): Promise<SupportShot | null> {
  const granted = await ensureLibraryPermission();
  if (!granted) {
    orbitAlert('Photos needed', 'Allow photo access to attach a screenshot.', undefined, {
      record: false,
    });
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.55,
    exif: false,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  const asset = result.assets[0];
  const mime = asset.mimeType ?? 'image/jpeg';
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const filename = `support-${Date.now()}.${ext}`;
  const shot: SupportShot = {
    uri: asset.uri,
    contentType: mime,
    filename,
    contentBase64: asset.base64 ?? undefined,
  };

  const uploaded = await tryUploadSupportShot(shot);
  return uploaded ?? shot;
}

async function tryUploadSupportShot(shot: SupportShot): Promise<SupportShot | null> {
  const supabase = getSupabaseClient();
  if (!supabase || !shot.contentBase64) return null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return null;

    const binary = atob(shot.contentBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const path = `${userId}/${shot.filename}`;

    const { error } = await supabase.storage.from(SUPPORT_SHOT_BUCKET).upload(path, bytes, {
      contentType: shot.contentType,
      upsert: true,
    });
    if (error) {
      console.warn('support-upload skipped', error.message);
      return null;
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(SUPPORT_SHOT_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signError || !signed?.signedUrl) {
      const { data: pub } = supabase.storage.from(SUPPORT_SHOT_BUCKET).getPublicUrl(path);
      return { ...shot, url: pub.publicUrl };
    }
    return { ...shot, url: signed.signedUrl };
  } catch (error) {
    console.warn('support-upload failed', error);
    return null;
  }
}
