import { format } from 'date-fns';

import type { Itinerary, ItineraryStop } from '../../types/orbit';
import { addLocalDays, formatLocalDate, parseLocalDate } from '../streaks/local-date';

export function todayIso(now: Date = new Date()): string {
  return formatLocalDate(now);
}

export function orderedStops(itinerary: Itinerary): ItineraryStop[] {
  return [...itinerary.stops].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function isOpenStop(stop: ItineraryStop): boolean {
  return stop.status === 'active' || stop.status === 'pending';
}

const COORDINATE_PAIR = /^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/;

export function looksLikeCoordinates(value: string | null | undefined): boolean {
  if (!value) return false;
  return COORDINATE_PAIR.test(value.trim());
}

/**
 * Human place line under a stop name.
 * Never show raw lat/lng. Never repeat the stop name. Hide the line if there
 * is nothing useful to say — Directions already takes you there.
 */
export function stopPlaceLine(stop: ItineraryStop): string | null {
  const label = stop.label.trim().toLowerCase();
  for (const raw of [stop.address, stop.placeQuery]) {
    const value = raw?.trim();
    if (!value) continue;
    if (looksLikeCoordinates(value)) continue;
    if (value.toLowerCase() === label) continue;
    return value;
  }
  return null;
}

export function formatStopCount(count: number): string {
  if (count === 1) return '1 stop';
  return `${count} stops`;
}

export function tripWhenLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addLocalDays(today, 1)) return 'Tomorrow';
  if (date === addLocalDays(today, -1)) return 'Yesterday';
  try {
    return format(parseLocalDate(date), 'EEE, MMM d');
  } catch {
    return date;
  }
}

export function isGroceryStop(stop: ItineraryStop): boolean {
  return stop.kind === 'grocery' || stop.kind === 'shop' || Boolean(stop.groceryListId);
}

export function isUsefulSummary(summary: string | undefined, stopCount: number): boolean {
  const text = summary?.trim();
  if (!text) return false;
  const compact = text.toLowerCase().replace(/\.+$/, '');
  if (compact === formatStopCount(stopCount).toLowerCase()) return false;
  if (/^\d+\s+stops?$/.test(compact)) return false;
  return true;
}

export function applyStopOrder(stops: ItineraryStop[], orderedIds: string[]): ItineraryStop[] {
  const byId = new Map(stops.map((stop) => [stop.id, stop]));
  const next = orderedIds
    .map((id) => byId.get(id))
    .filter((stop): stop is ItineraryStop => Boolean(stop));
  const firstOpen = next.findIndex(isOpenStop);
  return next.map((stop, index) => ({
    ...stop,
    sortOrder: index,
    status:
      stop.status === 'done' || stop.status === 'skipped'
        ? stop.status
        : index === firstOpen
          ? 'active'
          : 'pending',
  }));
}

export function makeStopNextIds(itinerary: Itinerary, stopId: string): string[] | null {
  const ordered = orderedStops(itinerary);
  const remaining = ordered.filter(isOpenStop);
  if (!remaining.some((stop) => stop.id === stopId)) return null;
  const completed = ordered.filter((stop) => !isOpenStop(stop));
  const nextRemaining = [stopId, ...remaining.map((stop) => stop.id).filter((id) => id !== stopId)];
  return [...completed.map((stop) => stop.id), ...nextRemaining];
}

export function moveOpenStopIds(
  itinerary: Itinerary,
  stopId: string,
  direction: -1 | 1,
): string[] | null {
  const ordered = orderedStops(itinerary);
  const remaining = ordered.filter(isOpenStop);
  const completed = ordered.filter((stop) => !isOpenStop(stop));
  const ids = remaining.map((stop) => stop.id);
  const index = ids.indexOf(stopId);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= ids.length) return null;
  const swapped = [...ids];
  [swapped[index], swapped[next]] = [swapped[next]!, swapped[index]!];
  return [...completed.map((stop) => stop.id), ...swapped];
}

export type TripPhase = 'empty' | 'planned' | 'active' | 'completed';

export type TripIntent = {
  phase: TripPhase;
  remaining: ItineraryStop[];
  completed: ItineraryStop[];
  current: ItineraryStop | null;
  upcoming: ItineraryStop[];
  /** Quiet line under the title: “Today”, never “1 stops” and never the current stop name (the hero says it). */
  subtitle: string;
  showSummary: boolean;
  showComingUp: boolean;
  showReorder: boolean;
  showCompletedRecap: boolean;
  showRunAgain: boolean;
  showDirections: boolean;
  showImHere: boolean;
  showShopping: boolean;
  primaryCta: 'directions' | 'run_again' | 'none';
  primaryCtaLabel: string;
  imHereLabel: string;
  emptyTitle: string;
  emptyBody: string;
};

export function tripIntent(itinerary: Itinerary, today: string = todayIso()): TripIntent {
  const ordered = orderedStops(itinerary);
  const remaining = ordered.filter(isOpenStop);
  const completed = ordered.filter((stop) => stop.status === 'done');
  const current = remaining[0] ?? null;
  const upcoming = remaining.slice(1);
  const when = tripWhenLabel(itinerary.date, today);

  const phase: TripPhase =
    ordered.length === 0
      ? 'empty'
      : itinerary.status === 'completed' || remaining.length === 0
        ? 'completed'
        : itinerary.status === 'active'
          ? 'active'
          : 'planned';

  if (phase === 'empty') {
    return {
      phase,
      remaining,
      completed,
      current: null,
      upcoming: [],
      subtitle: when,
      showSummary: false,
      showComingUp: false,
      showReorder: false,
      showCompletedRecap: false,
      showRunAgain: false,
      showDirections: false,
      showImHere: false,
      showShopping: false,
      primaryCta: 'none',
      primaryCtaLabel: '',
      imHereLabel: 'I’m here',
      emptyTitle: 'No stops yet',
      emptyBody: 'Ask Poppins to plan this run, or go back to Plan.',
    };
  }

  if (phase === 'completed') {
    return {
      phase,
      remaining,
      completed,
      current: null,
      upcoming: [],
      subtitle: `${when} · Done`,
      showSummary: isUsefulSummary(itinerary.summary, ordered.length),
      showComingUp: false,
      showReorder: false,
      showCompletedRecap: completed.length > 0,
      showRunAgain: true,
      showDirections: false,
      showImHere: false,
      showShopping: false,
      primaryCta: 'run_again',
      primaryCtaLabel: 'Run again',
      imHereLabel: 'I’m here',
      emptyTitle: '',
      emptyBody: '',
    };
  }

  const lastStop = remaining.length === 1;

  return {
    phase,
    remaining,
    completed,
    current,
    upcoming,
    subtitle: when,
    showSummary: isUsefulSummary(itinerary.summary, ordered.length),
    showComingUp: upcoming.length > 0,
    showReorder: remaining.length >= 2,
    showCompletedRecap: completed.length > 0,
    showRunAgain: false,
    showDirections: Boolean(current),
    showImHere: Boolean(current),
    showShopping: current ? isGroceryStop(current) : false,
    primaryCta: 'directions',
    primaryCtaLabel: 'Directions',
    imHereLabel: lastStop ? 'I’m here — finish' : 'I’m here',
    emptyTitle: '',
    emptyBody: '',
  };
}
