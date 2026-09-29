/**
 * Leave-by hint from an event time — on-device, never invents traffic or drive estimates.
 */
import type { IuiPayload } from '@/lib/poppins/ui-scenes';

export function eventLeaveByLine(payload: Pick<IuiPayload, 'time' | 'location'>): string | null {
  const time = (payload.time ?? '').trim();
  if (!time) return null;
  // Require a real clock form: "4:30 PM" / "4pm" / "16:30". Reject bare "4" and
  // relative phrases like "in 15 minutes" (pre-TF punchlist B2).
  const match = time.match(
    /^(?:(\d{1,2}):(\d{2})\s*(am|pm)|(\d{1,2})\s*(am|pm)|([01]?\d|2[0-3]):([0-5]\d))$/i
  );
  if (!match) return null;

  let hour: number;
  let mins: number;
  if (match[6] != null) {
    hour = Number(match[6]);
    mins = Number(match[7] ?? '0');
  } else if (match[1] != null) {
    hour = Number(match[1]);
    mins = Number(match[2] ?? '0');
    const mer = (match[3] ?? '').toLowerCase();
    if (mer === 'pm' && hour < 12) hour += 12;
    if (mer === 'am' && hour === 12) hour = 0;
  } else {
    hour = Number(match[4]);
    mins = 0;
    const mer = (match[5] ?? '').toLowerCase();
    if (mer === 'pm' && hour < 12) hour += 12;
    if (mer === 'am' && hour === 12) hour = 0;
  }

  let leaveMins = hour * 60 + mins - 30;
  if (leaveMins < 0) leaveMins += 24 * 60;
  const lh = Math.floor(leaveMins / 60) % 24;
  const lm = leaveMins % 60;
  const displayH = ((lh + 11) % 12) + 1;
  const ampm = lh >= 12 ? 'PM' : 'AM';
  const label = `${displayH}:${lm.toString().padStart(2, '0')} ${ampm}`;
  return `Leave by ${label}`;
}
