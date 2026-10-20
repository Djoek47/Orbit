/** Mirrored from Make v9 calendarData NOVA_ACTIVITY (fileKey 4J6d4LW335tDyEDpqq3VD1). */
export type MakeNovaActivity = {
  id: number;
  timestamp: string;
  action: string;
  detail: string;
  icon: string;
  type: 'completed' | 'reminder' | 'insight' | 'itinerary' | 'notification';
};

export const MAKE_NOVA_ACTIVITY: MakeNovaActivity[] = [
  { id: 1, timestamp: 'Just now', action: 'Marked complete', detail: "Weekly grocery run — James ⚡+5 XP earned", icon: '✅', type: 'completed' },
  { id: 2, timestamp: '12 min ago', action: 'Sent reminder', detail: 'Chapter 5 homework due today — sent to Maya', icon: '📚', type: 'reminder' },
  { id: 3, timestamp: '1 hr ago', action: 'Itinerary created', detail: 'Bundled 3 errands into one Thursday trip — saves 42 min', icon: '🗺️', type: 'itinerary' },
  { id: 4, timestamp: '2 hrs ago', action: 'Insight detected', detail: "Air filter overdue by 12 days — added to James's list", icon: '💡', type: 'insight' },
  { id: 5, timestamp: 'Yesterday', action: 'Marked complete', detail: "Emma's dentist check-up — archived from calendar", icon: '✅', type: 'completed' },
  { id: 6, timestamp: 'Yesterday', action: 'Notification sent', detail: 'Reminded Sarah: dentist reschedule still pending', icon: '🔔', type: 'notification' },
  { id: 7, timestamp: '2 days ago', action: 'Insight detected', detail: 'Grocery pattern: Thursdays are best for Whole Foods', icon: '🛒', type: 'insight' },
  { id: 8, timestamp: '3 days ago', action: 'Itinerary created', detail: 'Grouped pharmacy + dry cleaning + post office into one loop', icon: '🗺️', type: 'itinerary' },
];
