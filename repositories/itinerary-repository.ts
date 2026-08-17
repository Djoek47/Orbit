import { mockHousehold } from '@/data/mock-household';
import { createLocalId, isMockMode } from '@/repositories/repository-utils';
import type { CreateItineraryInput, Itinerary, ItineraryStop } from '@/types/orbit';

let mockItineraries: Itinerary[] = clone(mockHousehold.itineraries ?? []);

export const itineraryRepository = {
  async list(householdId: string | null | undefined): Promise<Itinerary[]> {
    if (isMockMode()) {
      const id = householdId ?? mockHousehold.id;
      return clone(mockItineraries.filter((item) => item.householdId === id));
    }
    // Supabase table ships in family-time migration; mock-first until wired.
    return [];
  },

  async getById(id: string): Promise<Itinerary | null> {
    if (isMockMode()) {
      return clone(mockItineraries.find((item) => item.id === id) ?? null);
    }
    return null;
  },

  async create(householdId: string, input: CreateItineraryInput): Promise<Itinerary> {
    const stops: ItineraryStop[] = input.stops.map((stop, index) => ({
      id: createLocalId('stop'),
      label: stop.label.trim(),
      kind: stop.kind,
      address: stop.address,
      placeQuery: stop.placeQuery ?? stop.address ?? stop.label,
      lat: stop.lat,
      lng: stop.lng,
      eventId: stop.eventId,
      groceryListId: stop.groceryListId,
      etaMinutes: stop.etaMinutes,
      sortOrder: stop.sortOrder ?? index,
      savedPlaceId: stop.savedPlaceId,
      status: index === 0 ? 'active' : 'pending',
    }));

    const itinerary: Itinerary = {
      id: createLocalId('itin'),
      householdId,
      title: input.title.trim(),
      date: input.date,
      status: 'active',
      stops,
      suggestedByPoppins: input.suggestedByPoppins,
      summary: input.summary,
      favorite: false,
    };

    if (isMockMode()) {
      mockItineraries = [itinerary, ...mockItineraries];
      return clone(itinerary);
    }

    return itinerary;
  },

  async update(itinerary: Itinerary): Promise<Itinerary> {
    if (isMockMode()) {
      mockItineraries = mockItineraries.map((item) => (item.id === itinerary.id ? itinerary : item));
      return clone(itinerary);
    }
    return itinerary;
  },

  async advanceStop(itineraryId: string, stopId: string): Promise<Itinerary | null> {
    const current = await this.getById(itineraryId);
    if (!current) {
      return null;
    }

    const ordered = [...current.stops].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = ordered.findIndex((stop) => stop.id === stopId);
    if (index < 0) {
      return current;
    }

    ordered[index] = { ...ordered[index], status: 'done' };
    if (index + 1 < ordered.length) {
      ordered[index + 1] = { ...ordered[index + 1], status: 'active' };
    }

    const allDone = ordered.every((stop) => stop.status === 'done' || stop.status === 'skipped');
    const next: Itinerary = {
      ...current,
      stops: ordered,
      status: allDone ? 'completed' : 'active',
    };
    return this.update(next);
  },

  async reorderStops(itineraryId: string, stopIds: string[]): Promise<Itinerary | null> {
    const current = await this.getById(itineraryId);
    if (!current) {
      return null;
    }
    const byId = new Map(current.stops.map((stop) => [stop.id, stop]));
    const stops = stopIds
      .map((id, index) => {
        const stop = byId.get(id);
        return stop ? { ...stop, sortOrder: index } : null;
      })
      .filter((stop): stop is ItineraryStop => Boolean(stop));
    return this.update({ ...current, stops });
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
