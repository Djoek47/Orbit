import type { HouseholdEvent, Itinerary } from '@/types/orbit';

export type EventGroupKey = 'Today' | 'Tomorrow' | 'Later';

const GROUP_ORDER: EventGroupKey[] = ['Today', 'Tomorrow', 'Later'];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function dayOffsetFromLabel(dateLabel: string, reference = new Date()): number | null {
  const normalized = dateLabel.trim().toLowerCase();
  if (normalized === 'today' || normalized.startsWith('today')) {
    return 0;
  }
  if (normalized === 'tomorrow' || normalized.startsWith('tomorrow')) {
    return 1;
  }

  const parsed = Date.parse(dateLabel);
  if (!Number.isNaN(parsed)) {
    const target = startOfDay(new Date(parsed));
    const today = startOfDay(reference);
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
  }

  return null;
}

function groupKeyForDate(dateLabel: string, reference = new Date()): EventGroupKey {
  const offset = dayOffsetFromLabel(dateLabel, reference);
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
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

export function groupHouseholdEvents(events: HouseholdEvent[], reference = new Date()) {
  const buckets: Record<EventGroupKey, HouseholdEvent[]> = {
    Today: [],
    Tomorrow: [],
    Later: [],
  };

  for (const event of events) {
    buckets[groupKeyForDate(event.date, reference)].push(event);
  }

  for (const key of GROUP_ORDER) {
    buckets[key].sort((left, right) => {
      if (left.startsAt && right.startsAt) {
        return left.startsAt.localeCompare(right.startsAt);
      }
      return compareEventTime(left.time, right.time);
    });
  }

  return GROUP_ORDER.map((key) => ({
    key,
    events: buckets[key],
  })).filter((group) => group.events.length > 0);
}

/** Build a simple 7-day chip strip starting from today for Expo Go calendar. */
export function buildWeekStrip(reference = new Date()) {
  const days: { key: string; label: string; dayNumber: number; isToday: boolean; date: Date }[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(reference);
    date.setDate(reference.getDate() + offset);
    days.push({
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      dayNumber: date.getDate(),
      isToday: offset === 0,
      date,
    });
  }
  return days;
}

/** Events whose date label or startsAt fall on the selected ISO day key. */
export function eventsForDayKey(events: HouseholdEvent[], dayKey: string, reference = new Date()) {
  return events
    .filter((event) => {
      if (event.startsAt?.startsWith(dayKey)) {
        return true;
      }
      const offset = dayOffsetFromLabel(event.date, reference);
      if (offset == null) {
        return false;
      }
      const date = new Date(reference);
      date.setDate(reference.getDate() + offset);
      return date.toISOString().slice(0, 10) === dayKey;
    })
    .sort((a, b) => {
      if (a.startsAt && b.startsAt) {
        return a.startsAt.localeCompare(b.startsAt);
      }
      return compareEventTime(a.time, b.time);
    });
}

export function itinerariesForDayKey(itineraries: Itinerary[], dayKey: string) {
  return itineraries.filter((item) => item.date === dayKey);
}

export function countUpcomingSoon(events: HouseholdEvent[], reference = new Date()) {
  return events.filter((event) => {
    const key = groupKeyForDate(event.date, reference);
    return key === 'Today' || key === 'Tomorrow';
  }).length;
}

/** Nova-friendly itinerary suggestion copy from today's events + missing groceries. */
export function suggestItinerarySummary(input: {
  stopCount: number;
  etaMinutes: number;
  leaveBy?: string;
}) {
  const leave = input.leaveBy ?? 'soon';
  return `Leave by ${leave} · ${input.stopCount} stops · ~${input.etaMinutes} min`;
}
