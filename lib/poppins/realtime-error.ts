/**
 * OpenAI Realtime error events that must not hang up the live IUI session.
 * A tap sends response.cancel; if Poppins was only listening, the API replies
 * response_cancel_not_active. Treating that as fatal is why hands-off voice
 * worked and a finger on a chip cooked the call.
 */

export function isRecoverableRealtimeError(raw: unknown): boolean {
  const bag = unwrapRealtimeError(raw);
  const code = bag.code;
  const message = bag.message;
  if (
    code === 'response_cancel_not_active' ||
    code === 'conversation_already_has_active_response'
  ) {
    return true;
  }
  return (
    /no active response/.test(message) ||
    /cancel_not_active/.test(message) ||
    /already has an active response/.test(message) ||
    /cancellation failed/.test(message)
  );
}

function unwrapRealtimeError(raw: unknown): { code: string; message: string } {
  if (!raw || typeof raw !== 'object') {
    return { code: '', message: String(raw ?? '').toLowerCase() };
  }
  const root = raw as Record<string, unknown>;
  const nested =
    root.error && typeof root.error === 'object'
      ? (root.error as Record<string, unknown>)
      : root;
  return {
    code: String(nested.code ?? root.code ?? '').toLowerCase(),
    message: String(nested.message ?? root.message ?? '').toLowerCase(),
  };
}
