/**
 * Friendly copy for technical / edge-function errors shown in Orbit alerts.
 * Raw text is still saved in the error log for Support.
 */
export function friendlyErrorMessage(raw: string | null | undefined): string {
  const text = (raw ?? '').trim();
  if (!text) return 'Something went wrong. Try again in a moment.';

  const lower = text.toLowerCase();
  if (lower.includes('proof_uri_required') || lower.includes('proof uri')) {
    return 'The photo didn’t attach. Take or pick it again, then send.';
  }
  if (lower.includes('proof_upload_failed') || lower.includes('proof_bucket')) {
    return 'Couldn’t upload the photo. Check your connection and try again.';
  }
  if (lower.includes('proof_decode') || lower.includes('could not read the photo')) {
    return 'That photo couldn’t be read. Try another shot.';
  }
  // Grant failures first — often arrive wrapped as "non-2xx" from supabase-js.
  if (
    lower.includes('grant_token_pack') ||
    lower.includes('grant failed') ||
    lower.includes('payment may have gone through')
  ) {
    return 'Payment may have gone through, but we couldn’t add credits to your household. Send feedback and we’ll fix it — don’t buy again until we confirm.';
  }
  if (lower.includes('sku_not_found') || lower.includes('empty product')) {
    return 'This pack isn’t live in the App Store yet. It opens as soon as Apple approves it — try again later.';
  }
  if (
    lower.includes('failed to request purchase') ||
    lower.includes('product_not_found') ||
    lower.includes('item_unavailable') ||
    lower.includes('storekit') ||
    lower.includes('token_pack_product_mismatch')
  ) {
    return 'Apple couldn’t start this purchase. It may not be live in the App Store yet — try again later, or send feedback so we can check.';
  }
  if (
    lower.includes('non-2xx') ||
    lower.includes('edge function') ||
    lower.includes('functions.httperror')
  ) {
    return 'Couldn’t reach Choremaxx just now. Check your connection and try again.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'You’re offline or the connection dropped. Try again when you’re back online.';
  }
  // Already human-readable short messages — keep them.
  if (text.length <= 160 && !/[_:]{2,}|\berror\b/i.test(text) && !/^[a-z0-9_]+$/i.test(text)) {
    return text;
  }
  if (/^[a-z][a-z0-9_]+$/i.test(text)) {
    return 'Something went wrong. Details are saved under Settings → Support.';
  }
  return text.length > 220 ? `${text.slice(0, 200).trim()}…` : text;
}

export function looksLikeErrorAlert(title: string, message?: string): boolean {
  const blob = `${title} ${message ?? ''}`.toLowerCase();
  return (
    blob.includes('could not') ||
    blob.includes('couldn’t') ||
    blob.includes('failed') ||
    blob.includes('error') ||
    blob.includes('went wrong') ||
    blob.includes('try again') ||
    blob.includes("didn't go through") ||
    blob.includes('didn’t go through') ||
    blob.includes('unavailable')
  );
}
