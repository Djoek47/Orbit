import { dataMode } from '@/config/data-mode';
import { createLocalId, requireMockOrSupabaseReady } from '@/repositories/repository-utils';
import type { CreateEventInput, HouseholdEvent } from '@/types/orbit';

export const calendarRepository = {
  async getEvents(events: HouseholdEvent[]): Promise<HouseholdEvent[]> {
    if (dataMode === 'mock') {
      return [...events];
    }

    requireMockOrSupabaseReady('calendarRepository.getEvents');
    return [...events];
  },

  async createEvent(input: CreateEventInput): Promise<HouseholdEvent> {
    if (dataMode !== 'mock') {
      requireMockOrSupabaseReady('calendarRepository.createEvent');
    }

    return {
      id: createLocalId('event'),
      title: input.title.trim(),
      category: 'Family',
      date: input.date.trim(),
      time: input.time.trim(),
      location: input.location.trim(),
      responsible: input.responsible,
    };
  },
};
