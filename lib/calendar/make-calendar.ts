import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';

import type { HouseholdEvent } from '@/types/orbit';

/** Make v5 CalendarScreen TYPE_CONFIG — exact hex from Figma Make. */
export type MakeEventType = 'task' | 'homework' | 'event' | 'grocery' | 'itinerary';

export const TYPE_CONFIG: Record<
  MakeEventType,
  { label: string; color: string; bg: string; emoji: string }
> = {
  task: { label: 'Task', color: '#38BDF8', bg: 'rgba(56,189,248,0.15)', emoji: '✅' },
  homework: { label: 'Homework', color: '#A78BFA', bg: 'rgba(167,139,250,0.15)', emoji: '📚' },
  event: { label: 'Event', color: '#34D399', bg: 'rgba(52,211,153,0.15)', emoji: '📅' },
  grocery: { label: 'Grocery', color: '#FB923C', bg: 'rgba(251,146,60,0.15)', emoji: '🛒' },
  itinerary: { label: 'Trip', color: '#06B6D4', bg: 'rgba(6,182,212,0.15)', emoji: '🗺️' },
};

/** Legend colors keyed by Make type label (CalendarScreen legend). */
export const MAKE_TYPE_COLORS = Object.fromEntries(
  Object.entries(TYPE_CONFIG).map(([, cfg]) => [cfg.label, cfg.color])
) as Record<string, string>;

/** Map household event categories to Make calendar event types. */
export function householdCategoryToMakeType(category: HouseholdEvent['category']): MakeEventType {
  switch (category) {
    case 'School':
      return 'homework';
    case 'Routine':
      return 'task';
    case 'Activity':
    case 'Appointment':
    case 'Family':
    default:
      return 'event';
  }
}

export function eventTypeConfig(category: HouseholdEvent['category']) {
  return TYPE_CONFIG[householdCategoryToMakeType(category)];
}

export function eventColor(category: HouseholdEvent['category']): string {
  return eventTypeConfig(category).color;
}

export function monthGridDays(currentMonth: Date) {
  const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

export function weekStripDays(reference = new Date()) {
  const start = startOfWeek(reference, { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end: new Date(start.getTime() + 6 * 86_400_000) });
}

export function eventDateKey(event: HouseholdEvent, reference = new Date()): string | null {
  if (event.startsAt) {
    return event.startsAt.slice(0, 10);
  }
  const label = event.date.trim().toLowerCase();
  if (label === 'today' || label.startsWith('today')) {
    return format(reference, 'yyyy-MM-dd');
  }
  if (label === 'tomorrow' || label.startsWith('tomorrow')) {
    const d = new Date(reference);
    d.setDate(d.getDate() + 1);
    return format(d, 'yyyy-MM-dd');
  }
  const parsed = Date.parse(event.date);
  if (!Number.isNaN(parsed)) {
    return format(new Date(parsed), 'yyyy-MM-dd');
  }
  return null;
}

export function groupEventsByDate(events: HouseholdEvent[], reference = new Date()) {
  const map: Record<string, HouseholdEvent[]> = {};
  for (const event of events) {
    const key = eventDateKey(event, reference);
    if (!key) continue;
    if (!map[key]) map[key] = [];
    map[key].push(event);
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => (a.startsAt ?? a.time).localeCompare(b.startsAt ?? b.time));
  }
  return map;
}

export {
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  subMonths,
};
