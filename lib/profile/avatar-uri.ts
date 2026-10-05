/**
 * Avatar URI helpers — no Supabase imports (safe for unit tests).
 * Local file:// / content:// / data: images must be uploaded before they can
 * survive app delete or show on another device.
 */
import {
  isLocalProofUri,
  isShareableProofUri,
} from '@/lib/tasks/proof-uri';

export { isLocalProofUri as isLocalAvatarUri, isShareableProofUri as isShareableAvatarUri };

/** True when this avatar value is a photo URI (local or remote), not emoji/initials. */
export function isAvatarPhotoUri(avatar?: string | null): boolean {
  if (!avatar?.trim()) return false;
  const value = avatar.trim();
  return (
    isShareableProofUri(value) ||
    isLocalProofUri(value) ||
    value.startsWith('data:image')
  );
}

/**
 * True when the avatar is a photo that is not yet a durable https URL.
 * Emoji and initials never need upload.
 */
export function needsAvatarUpload(avatar?: string | null): boolean {
  if (!avatar?.trim()) return false;
  if (isShareableProofUri(avatar)) return false;
  const value = avatar.trim();
  return isLocalProofUri(value) || value.startsWith('data:image');
}
