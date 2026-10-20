/**
 * Serialize an IUI beat into a notification act payload.
 * Approve / Change are first-class assent (not silence).
 */
import type { IuiBeat, IuiPayload } from '@/lib/poppins/ui-scenes';

export const IUI_ACT_KIND = 'iui_act';

/** Acts that may be approved from a notification (reversible, self-scoped). */
export function isNotificationApprovable(beat: IuiBeat, recipientName?: string): boolean {
  const write = beat.payload.write ?? 'none';
  if (write === 'none' || write === 'claim_reward') return false;
  if (write === 'create_event' || write === 'create_itinerary_stop') return false;
  if (write === 'create_task' || write === 'create_homework' || write === 'add_grocery') {
    const assignee = beat.payload.assignee?.trim();
    if (recipientName && assignee && assignee.toLowerCase() !== recipientName.toLowerCase()) {
      // Touching another person → open app (Change only).
      return false;
    }
    return true;
  }
  if (write === 'complete_task' || write === 'update_task') return true;
  return false;
}

export function previewLineForBeat(payload: IuiPayload): string {
  const parts = [
    payload.title || payload.groceryName || payload.rewardName,
    payload.assignee ? `→ ${payload.assignee}` : null,
    payload.due || payload.date,
  ].filter(Boolean);
  return parts.join(' · ') || payload.thinkingLine || 'Proposed act';
}

export type IuiActNotificationPayload = {
  kind: typeof IUI_ACT_KIND;
  actId: string;
  householdId: string;
  titleLine: string;
  previewLine: string;
  write: string;
  approvable: boolean;
  expiresAt: string;
  /** Continuity snapshot fields for Change restore. */
  beatJson: string;
};

/** Default unanswered window — absence is never assent. */
export const IUI_ACT_EXPIRY_MS = 30 * 60 * 1000;

export function serializeIuiActNotification(input: {
  beat: IuiBeat;
  householdId: string;
  recipientName?: string;
  now?: number;
}): { title: string; body: string; data: IuiActNotificationPayload } {
  const now = input.now ?? Date.now();
  const approvable = isNotificationApprovable(input.beat, input.recipientName);
  const titleLine = input.beat.payload.title || input.beat.payload.groceryName || 'Poppins';
  const preview = previewLineForBeat(input.beat.payload);
  return {
    title: titleLine,
    body: preview,
    data: {
      kind: IUI_ACT_KIND,
      actId: input.beat.id,
      householdId: input.householdId,
      titleLine,
      previewLine: preview,
      write: input.beat.payload.write ?? 'none',
      approvable,
      expiresAt: new Date(now + IUI_ACT_EXPIRY_MS).toISOString(),
      beatJson: JSON.stringify(input.beat),
    },
  };
}

export function parseIuiActBeat(data: Record<string, unknown>): IuiBeat | null {
  const raw = data.beatJson;
  if (typeof raw !== 'string') return null;
  try {
    const beat = JSON.parse(raw) as IuiBeat;
    if (!beat?.id || !beat?.scene) return null;
    return beat;
  } catch {
    return null;
  }
}

export function isIuiActExpired(data: Record<string, unknown>, now = Date.now()): boolean {
  const expiresAt = typeof data.expiresAt === 'string' ? Date.parse(data.expiresAt) : NaN;
  if (Number.isNaN(expiresAt)) return true;
  return now > expiresAt;
}
