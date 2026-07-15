import type { HouseholdEvent } from '@/types/orbit';

export type EventGroupKey = 'Today' | 'Tomorrow' | 'Later';

const GROUP_ORDER: EventGroupKey[] = ['Today', 'Tomorrow', 'Later'];

function groupKeyForDate(dateLabel: string): EventGroupKey {
  const normalized = dateLabel.trim().toLowerCase();
  if (normalized === 'today' || normalized.startsWith('today')) {
    return 'Today';
  }
  if (normalized === 'tomorrow' || normalized.startsWith('tomorrow')) {
    return 'Tomorrow';
  }
  return 'Later';
}

/** Sort helper for loose AM/PM time labels used in mock data. */
export function compareEventTime(a: string, b: string) {
  const parse = (value: string) => {
    const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) {
      return 0;
    }
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) {
      hours += 12;
    }
    if (meridiem === 'AM' && hours === 12) {
      hours = 0;
    }
    return hours * 60 + minutes;
  };
  return parse(a) - parse(b);
}

export function groupHouseholdEvents(events: HouseholdEvent[]) {
  const buckets: Record<EventGroupKey, HouseholdEvent[]> = {
    Today: [],
    Tomorrow: [],
    Later: [],
  };

  for (const event of events) {
    buckets[groupKeyForDate(event.date)].push(event);
  }

  for (const key of GROUP_ORDER) {
    buckets[key].sort((left, right) => compareEventTime(left.time, right.time));
  }

  return GROUP_ORDER.map((key) => ({
    key,
    events: buckets[key],
  })).filter((group) => group.events.length > 0);
}

/** Build a simple 7-day chip strip starting from today for Expo Go calendar. */
export function buildWeekStrip(reference = new Date()) {
  const days: { key: string; label: string; dayNumber: number; isToday: boolean }[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(reference);
    date.setDate(reference.getDate() + offset);
    days.push({
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      dayNumber: date.getDate(),
      isToday: offset === 0,
    });
  }
  return days;
}

export function countUpcomingSoon(events: HouseholdEvent[]) {
  return events.filter((event) => {
    const key = groupKeyForDate(event.date);
    return key === 'Today' || key === 'Tomorrow';
  }).length;
}
