import { mockHousehold } from '@/data/mock-household';
import { buildStartsAtIso, formatStoredDateLabel } from '@/lib/calendar/event-date';
import { mapEventRow } from '@/lib/mappers/orbit-mappers';
import { createLocalId, getConfiguredSupabase, isMockMode, isPersistedHouseholdId, mapDbError } from '@/repositories/repository-utils';
import type { CreateEventInput, HouseholdEvent } from '@/types/orbit';

let mockEventsState: HouseholdEvent[] = clone(mockHousehold.events);

export function __setMockEventsStateForTests(items: HouseholdEvent[]) {
  mockEventsState = clone(items);
}

function normalizeCategory(category?: CreateEventInput['category'] | HouseholdEvent['category']): HouseholdEvent['category'] {
  const value = (category ?? 'Family').trim();
  const allowed: HouseholdEvent['category'][] = ['School', 'Activity', 'Appointment', 'Family', 'Routine'];
  const match = allowed.find((item) => item.toLowerCase() === value.toLowerCase());
  return match ?? 'Family';
}

function toDbCategory(category: HouseholdEvent['category']) {
  return category.toLowerCase() as 'school' | 'activity' | 'appointment' | 'family' | 'routine';
}

export const calendarRepository = {
  async getEvents(householdId: string | null | undefined): Promise<HouseholdEvent[]> {
    if (isMockMode()) {
      return clone(mockEventsState);
    }

    if (!isPersistedHouseholdId(householdId)) {
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
      return mockEventsState.find((event) => event.id === eventId) ?? null;
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
    const dateKey = input.dateKey?.trim();
    const dateLabel =
      dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
        ? formatStoredDateLabel(dateKey)
        : input.date.trim();
    const startsAt =
      input.startsAt ??
      (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
        ? buildStartsAtIso(dateKey, input.time)
        : undefined);
    const event: HouseholdEvent = {
      id: createLocalId('event'),
      title: input.title.trim(),
      category: normalizeCategory(input.category),
      date: dateLabel,
      time: input.time.trim(),
      location: input.location.trim(),
      responsible: input.responsible,
      startsAt,
    };

    if (isMockMode()) {
      mockEventsState = [event, ...mockEventsState];
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
        category: toDbCategory(event.category),
        date_label: event.date,
        time_label: event.time,
        location: event.location,
        responsible_name: event.responsible,
        starts_at: event.startsAt ?? null,
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
    const next = {
      ...event,
      title: event.title.trim(),
      category: normalizeCategory(event.category),
      date: event.date.trim(),
      time: event.time.trim(),
      location: event.location.trim(),
    };

    if (isMockMode()) {
      mockEventsState = mockEventsState.map((item) => (item.id === next.id ? next : item));
      return next;
    }

    const supabase = getConfiguredSupabase('calendarRepository.updateEvent');
    const { data, error } = await supabase
      .from('calendar_events')
      .update({
        title: next.title,
        category: toDbCategory(next.category),
        date_label: next.date,
        time_label: next.time,
        location: next.location,
        responsible_name: next.responsible,
        starts_at: next.startsAt ?? null,
      })
      .eq('id', next.id)
      .select('*')
      .single();
    mapDbError('calendarRepository.updateEvent', error);

    return data ? mapEventRow(data) : next;
  },

  async deleteEvent(eventId: string): Promise<void> {
    if (isMockMode()) {
      mockEventsState = mockEventsState.filter((item) => item.id !== eventId);
      return;
    }

    const supabase = getConfiguredSupabase('calendarRepository.deleteEvent');
    const { error } = await supabase.from('calendar_events').delete().eq('id', eventId);
    mapDbError('calendarRepository.deleteEvent', error);
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
