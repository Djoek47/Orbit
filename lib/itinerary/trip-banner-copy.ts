/**
 * Lock Screen / Dynamic Island copy for an active trip.
 * Reuses the shopping subtitle protocol so the existing Live Activity view can
 * check off the current stop (advance) without a native rebuild of the codec.
 *
 *   Family run                         ← title
 *   Stop 1 of 3 · Cuir Dimitri         ← line 0
 *   #id:<stopId>|🛒 Marché Legendre    ← upcoming (first = current for check-off)
 *   #p0
 */
import { packBannerItem } from '@/lib/grocery/shopping-banner-copy';
import type { ItineraryStop } from '@/types/orbit';

export type TripBannerStop = {
  id: string;
  label: string;
  emoji?: string;
};

export type TripRunState = {
  tripTitle: string;
  /** 0-based index of the current open stop among remaining. */
  index: number;
  total: number;
  currentLabel: string;
  /** Remaining open stops in order — first is current (tap = I'm done / advance). */
  remainingStops: TripBannerStop[];
  /** Arrived at the current stop — Lock Screen still advances on check-off. */
  arrived?: boolean;
};

export type TripBannerState = {
  title: string;
  subtitle: string;
  progressBar: { progress: number };
};

export function tripBannerState(run: TripRunState): TripBannerState {
  const total = Math.max(run.total, 1);
  const done = Math.max(0, Math.min(run.index, total));
  const progress = done / total;
  const phase = run.arrived ? 'Arrived' : 'Next';
  const head = `Stop ${done + 1} of ${total} · ${phase} · ${run.currentLabel}`;
  const lines = [
    head,
    ...run.remainingStops.slice(0, 36).map((stop) =>
      packBannerItem({
        id: stop.id,
        label: `${stop.emoji ?? '📍'} ${stop.label}`.trim(),
      })
    ),
    '#p0',
  ];
  return {
    title: run.tripTitle.trim() || 'Trip',
    subtitle: lines.join('\n'),
    progressBar: { progress },
  };
}

export function tripBannerFinalSubtitle(run: TripRunState): string {
  return `Done · ${run.tripTitle.trim() || 'Trip'}`;
}

export function stopsToBannerItems(
  stops: ItineraryStop[],
  emojiFor: (kind: ItineraryStop['kind']) => string
): TripBannerStop[] {
  return stops.map((stop) => ({
    id: stop.id,
    label: stop.label,
    emoji: emojiFor(stop.kind),
  }));
}
