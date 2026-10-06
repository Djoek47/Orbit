/**
 * supabase-js hides the server's reason behind "Edge Function returned a non-2xx
 * status code". Dig the JSON `{ error }` out of the response when present.
 */
export async function edgeErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as Response).json === 'function') {
    try {
      const body = (await (context as Response).clone().json()) as {
        error?: unknown;
        message?: unknown;
      };
      if (typeof body?.error === 'string' && body.error.trim()) return body.error.trim();
      if (typeof body?.message === 'string' && body.message.trim()) return body.message.trim();
    } catch {
      /* body wasn't JSON */
    }
  }
  const message = (error as { message?: string } | null)?.message?.trim();
  if (message && !/non-2xx/i.test(message)) return message;
  return fallback;
}

/** Map transfer RPC / edge failures to short owner-facing copy. */
export function friendlyTransferError(raw: string): string {
  const text = raw.trim();
  const lower = text.toLowerCase();
  if (lower.includes('only the household owner') || lower.includes('transfer_forbidden')) {
    return 'Only the household owner can transfer ownership.';
  }
  if (lower.includes('not authenticated') || lower.includes('unauthorized')) {
    return 'Sign in again, then try the transfer.';
  }
  if (
    lower.includes('gen_random_bytes') ||
    lower.includes('could not find the function') ||
    lower.includes('transfer isn’t ready') ||
    lower.includes('transfer isn\'t ready') ||
    lower.includes('404')
  ) {
    return 'Transfer isn’t available on this server yet. Try again after an update.';
  }
  if (lower.includes('transfer_create_failed') || lower.includes('could not create the transfer qr')) {
    return 'Couldn’t create the transfer QR. Try again in a moment.';
  }
  if (lower.includes('non-2xx') || lower.includes('edge function')) {
    return 'Couldn’t create the transfer QR. Check your connection and try again.';
  }
  // Never surface raw Postgres / object dumps.
  if (lower.includes('does not exist') || text === '[object Object]' || text.length > 180) {
    return 'Couldn’t create the transfer QR. Try again, or send feedback from Support.';
  }
  return text || 'Could not create transfer QR.';
}
