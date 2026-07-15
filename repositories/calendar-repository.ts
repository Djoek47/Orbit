import { mockHousehold } from '@/data/mock-household';
import { mapEventRow } from '@/lib/mappers/orbit-mappers';
import { createLocalId, getConfiguredSupabase, isMockMode, mapDbError } from '@/repositories/repository-utils';
import type { CreateEventInput, HouseholdEvent } from '@/types/orbit';

export const calendarRepository = {
  async getEvents(householdId: string | null | undefined): Promise<HouseholdEvent[]> {
    if (isMockMode()) {
      return clone(mockHousehold.events);
    }

    if (!householdId) {
      return [];
    }

    const supabase = getConfiguredSupabase('calendarRepository.getEvents');
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });
    mapDbError('calendarRepository.getEvents', error);

    return (data ?? []).map((row) => mapEventRow(row));
  },

  async getById(eventId: string): Promise<HouseholdEvent | null> {
    if (isMockMode()) {
      return mockHousehold.events.find((event) => event.id === eventId) ?? null;
    }

    const supabase = getConfiguredSupabase('calendarRepository.getById');
    const { data, error } = await supabase.from('calendar_events').select('*').eq('id', eventId).maybeSingle();
    mapDbError('calendarRepository.getById', error);

    return data ? mapEventRow(data) : null;
  },

  async createEvent(
    householdId: string | null | undefined,
    input: CreateEventInput
  ): Promise<HouseholdEvent> {
    const event: HouseholdEvent = {
      id: createLocalId('event'),
      title: input.title.trim(),
      category: 'Family',
      date: input.date.trim(),
      time: input.time.trim(),
      location: input.location.trim(),
      responsible: input.responsible,
    };

    if (isMockMode()) {
      return event;
    }

    if (!householdId) {
      throw new Error('calendarRepository.createEvent: householdId is required in Supabase mode.');
    }

    const supabase = getConfiguredSupabase('calendarRepository.createEvent');
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        household_id: householdId,
        title: event.title,
        category: 'family',
        date_label: event.date,
        time_label: event.time,
        location: event.location,
        responsible_name: event.responsible,
      })
      .select('*')
      .single();
    mapDbError('calendarRepository.createEvent', error);

    if (!data) {
      throw new Error('calendarRepository.createEvent: Insert returned no row.');
    }

    return mapEventRow(data);
  },

  async updateEvent(event: HouseholdEvent): Promise<HouseholdEvent> {
    if (isMockMode()) {
      return event;
    }

    const supabase = getConfiguredSupabase('calendarRepository.updateEvent');
    const { data, error } = await supabase
      .from('calendar_events')
      .update({
        title: event.title,
        category: event.category.toLowerCase() as
          | 'school'
          | 'activity'
          | 'appointment'
          | 'family'
          | 'routine',
        date_label: event.date,
        time_label: event.time,
        location: event.location,
        responsible_name: event.responsible,
      })
      .eq('id', event.id)
      .select('*')
      .single();
    mapDbError('calendarRepository.updateEvent', error);

    return data ? mapEventRow(data) : event;
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
