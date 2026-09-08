/**
 * OpenAI Realtime errors and IUI tap policy.
 *
 * A chip press is not a webhook. It is a data-channel user line so the model
 * hears the choice. Hands-off voice worked; a tap hung up because we sent
 * response.cancel while only listening and treated response_cancel_not_active
 * as fatal.
 */

export type VoiceTapPhase = 'listening' | 'speaking' | 'thinking' | 'tools';

export type StageTapPlan = 'inject_now' | 'cancel_then_inject' | 'queue_until_idle';

export function planStageTap(phase: VoiceTapPhase, responseInFlight: boolean): StageTapPlan {
  if (phase === 'tools') return 'queue_until_idle';
  if (responseInFlight || phase === 'speaking' || phase === 'thinking') return 'cancel_then_inject';
  return 'inject_now';
}

export type RealtimeErrorDisposition = 'hangup' | 'inject_pending_tap' | 'keep_going';

export function unwrapRealtimeError(raw: unknown): { code: string; message: string } {
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

export function isRecoverableRealtimeError(raw: unknown): boolean {
  const { code, message } = unwrapRealtimeError(raw);
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

export function disposeRealtimeError(raw: unknown): RealtimeErrorDisposition {
  if (!isRecoverableRealtimeError(raw)) return 'hangup';
  const { code, message } = unwrapRealtimeError(raw);
  if (
    code === 'response_cancel_not_active' ||
    /no active response/.test(message) ||
    /cancel_not_active/.test(message) ||
    /cancellation failed/.test(message)
  ) {
    return 'inject_pending_tap';
  }
  return 'keep_going';
}

/** Simulated live session — same rules the native class must follow. */
export type TapSim = {
  phase: VoiceTapPhase;
  responseInFlight: boolean;
  hungUp: boolean;
  sent: string[];
  pending: boolean;
};

export function simTap(state: TapSim, opts?: { needsReply?: boolean }): TapSim {
  if (state.hungUp) return state;
  const plan = planStageTap(state.phase, state.responseInFlight);
  if (plan === 'queue_until_idle') {
    return { ...state, pending: true };
  }
  if (plan === 'cancel_then_inject') {
    return { ...state, pending: true, sent: [...state.sent, 'response.cancel'], phase: 'listening' };
  }
  const sent = [...state.sent, 'conversation.item.create'];
  if (opts?.needsReply) {
    sent.push('response.create');
    return { ...state, sent, responseInFlight: true, phase: 'thinking', pending: false };
  }
  return { ...state, sent, pending: false, phase: 'listening' };
}

export function simEvent(
  state: TapSim,
  type: string,
  error?: unknown
): TapSim {
  if (state.hungUp) return state;
  if (type === 'response.created') {
    return { ...state, responseInFlight: true, phase: 'speaking' };
  }
  if (type === 'response.done' || type === 'response.cancelled') {
    let next: TapSim = {
      ...state,
      responseInFlight: false,
      phase: 'listening',
    };
    if (next.pending) {
      next = { ...next, pending: false };
      next = simTap(next, { needsReply: true });
    }
    return next;
  }
  if (type === 'error') {
    const d = disposeRealtimeError(error);
    if (d === 'hangup') return { ...state, hungUp: true };
    if (d === 'inject_pending_tap') {
      let next: TapSim = { ...state, responseInFlight: false, phase: 'listening' };
      if (next.pending) {
        next = { ...next, pending: false };
        next = simTap(next, { needsReply: true });
      }
      return next;
    }
    return { ...state, responseInFlight: true };
  }
  return state;
}
