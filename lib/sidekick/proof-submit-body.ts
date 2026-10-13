/**
 * Shape the Sidekick / shared-device submit_proof payload.
 * Pure — safe for node tests (no Supabase / Expo imports).
 */

/** Edge request body soft limit — keep base64 under this or Prefer signed PUT only. */
export const MAX_PROOF_BASE64_CHARS = 4_500_000;

/**
 * Shape the submit_proof payload so admins always get an https URL.
 * Signed PUT is best-effort; base64 is the reliable path unless oversized.
 */
export function buildSidekickProofSubmitBody(input: {
  code: string;
  taskId: string;
  remoteUri?: string;
  proofBase64?: string;
  proofMime?: string;
  proofExt?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    action: 'submit_proof',
    code: input.code,
    taskId: input.taskId,
  };
  const remote =
    typeof input.remoteUri === 'string' && /^https?:\/\//i.test(input.remoteUri.trim())
      ? input.remoteUri.trim()
      : '';
  if (remote) body.proofUri = remote;

  const b64 = input.proofBase64?.trim() ?? '';
  const tooLarge = b64.length > MAX_PROOF_BASE64_CHARS;
  // Attach bytes when they fit (reliable if signed PUT missed). Skip oversized
  // base64 when we already have https so the edge JSON body stays under limit.
  if (b64 && !tooLarge) {
    body.proofBase64 = b64;
    body.proofMime = input.proofMime ?? 'image/jpeg';
    body.proofExt = input.proofExt ?? 'jpg';
  }

  if (!body.proofUri && !body.proofBase64) {
    if (tooLarge) {
      throw new Error('That photo is too large to send. Take it again a little closer / smaller.');
    }
    throw new Error('Could not prepare the photo for upload. Try again.');
  }
  return body;
}
