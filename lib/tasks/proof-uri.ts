/** Proof URI helpers — no Supabase imports (safe for unit tests). */

const LOCAL_URI = /^(file:|content:|ph:|assets-library:|data:)/i;

export function isLocalProofUri(uri: string | null | undefined): boolean {
  if (!uri?.trim()) return false;
  return LOCAL_URI.test(uri.trim()) || uri.startsWith('/');
}

/** True when Image can load this URI on any household device. */
export function isShareableProofUri(uri: string | null | undefined): boolean {
  if (!uri?.trim()) return false;
  return /^https?:\/\//i.test(uri.trim());
}

/** Any URI that is not already a durable https link must be uploaded before cross-device view. */
export function needsProofUpload(uri: string | null | undefined): boolean {
  if (!uri?.trim()) return false;
  return !isShareableProofUri(uri);
}

/** Decode base64 to bytes for a signed Storage PUT. */
export function proofBytesFromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
