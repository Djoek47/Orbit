/**
 * Shared GPS session for an active trip — banner + itinerary screen stay in sync
 * when the person leaves the detail screen (Uber / Waze style live banner).
 */
type Listener = () => void;

export type TripLiveSnapshot = {
  itineraryId: string | null;
  stopId: string | null;
  distanceMeters: number | null;
  arrived: boolean;
  updatedAt: number;
};

let snapshot: TripLiveSnapshot = {
  itineraryId: null,
  stopId: null,
  distanceMeters: null,
  arrived: false,
  updatedAt: 0,
};

const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function getTripLiveSnapshot(): TripLiveSnapshot {
  return snapshot;
}

export function subscribeTripLive(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function patchTripLive(patch: Partial<TripLiveSnapshot>): void {
  snapshot = {
    ...snapshot,
    ...patch,
    updatedAt: Date.now(),
  };
  emit();
}

export function clearTripLive(): void {
  snapshot = {
    itineraryId: null,
    stopId: null,
    distanceMeters: null,
    arrived: false,
    updatedAt: Date.now(),
  };
  emit();
}
