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
