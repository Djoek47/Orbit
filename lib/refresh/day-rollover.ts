/**
 * Noticing that the day changed.
 *
 * Home already refreshes constantly — on focus, and every five seconds while it is open — so
 * the numbers look live. What never ran on its own was the occurrence catch-up: the pass that
 * expires yesterday's open tasks, spawns today's, and settles the streak. It was only wired to
 * pull-to-refresh, so a phone left on the Home tab overnight still showed yesterday in the
 * morning, with a streak that had not been counted, until someone dragged the screen down.
 *
 * Refreshing the household and rolling the day are different jobs. This is the second one: it
 * answers "is it still the same day as last time I looked", and nothing else.
 *
 * Pure: no React Native, no storage, no clock of its own.
 */

/** Local calendar day, as YYYY-MM-DD. Local on purpose — a household lives in one timezone. */
export function dayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * True when the day has moved on since `lastSeen`.
 *
 * An empty or unreadable `lastSeen` counts as a rollover: the first look of a session should
 * run the catch-up rather than assume someone else already did.
 */
export function dayHasRolled(lastSeen: string | null | undefined, now = new Date()): boolean {
  if (!lastSeen) return true;
  return lastSeen !== dayKey(now);
}

/**
 * Milliseconds until the next local midnight, so a phone left open overnight rolls on its own
 * instead of waiting for someone to pick it up.
 *
 * Never returns zero: a timer scheduled for exactly midnight can fire a hair early and leave
 * the app rolling to the same day twice. One extra second costs nothing.
 */
export function msUntilNextDay(now = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime() + 1000);
}

/**
 * How long to wait before taking a refresh seriously again.
 *
 * Foreground events arrive in bursts — a notification tap can produce several in a second —
 * and each one would otherwise kick off a full catch-up.
 */
export const REFRESH_DEBOUNCE_MS = 30_000;

export function shouldRefreshOnForeground(
  lastRefreshedAt: number | null,
  now = Date.now()
): boolean {
  if (lastRefreshedAt == null) return true;
  return now - lastRefreshedAt >= REFRESH_DEBOUNCE_MS;
}

/** "just now" · "4m ago" · "2h ago" · "yesterday" — how fresh what you are looking at is. */
export function freshnessLabel(lastRefreshedAt: number | null, now = Date.now()): string {
  if (lastRefreshedAt == null) return '';
  const ms = Math.max(0, now - lastRefreshedAt);
  if (ms < 60_000) return 'just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return 'yesterday';
}
