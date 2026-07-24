import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitListItem } from '@/components/orbit/orbit-list-item';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { buildWeekStrip, groupHouseholdEvents } from '@/lib/calendar/event-groups';
import { useOrbit } from '@/store/orbit-store';

type PlanSubTab = 'calendar' | 'itinerary';

const SAMPLE_ITINERARIES = [
  {
    id: 'it1',
    title: 'Saturday soccer morning',
    when: 'Sat · 8:00 AM',
    stops: ['Pack water bottles', 'Drive to Riverside Field', 'Snack after game'],
  },
  {
    id: 'it2',
    title: 'Sunday grocery + meal prep',
    when: 'Sun · 10:30 AM',
    stops: ['Shopping list sync', 'Market run', 'Prep lunches'],
  },
];

export default function PlanScreen() {
  const { household, metrics } = useOrbit();
  const [planTab, setPlanTab] = useState<PlanSubTab>('calendar');
  const [selectedDay, setSelectedDay] = useState(0);
  const week = useMemo(() => buildWeekStrip(), []);
  const groups = useMemo(() => groupHouseholdEvents(household.events), [household.events]);

  const focusLabel = selectedDay === 0 ? 'Today' : selectedDay === 1 ? 'Tomorrow' : 'Later';
  const focusedEvents =
    selectedDay <= 1
      ? groups.find((group) => group.key === focusLabel)?.events ?? []
      : household.events;

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Plan</Text>
        <Text style={orbitTypography.display}>Family logistics</Text>
        <Text style={orbitTypography.body}>
          Calendar and itineraries in one place — {metrics.upcomingEvents} upcoming ·{' '}
          {metrics.calendarCoverage}% coverage.
        </Text>
      </View>

      <View style={styles.subNav}>
        {(
          [
            { id: 'calendar' as const, label: 'Calendar' },
            { id: 'itinerary' as const, label: 'Itineraries' },
          ] as const
        ).map((tab) => {
          const active = planTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setPlanTab(tab.id)}
              style={[styles.subNavButton, active && styles.subNavButtonActive]}>
              <Text style={[styles.subNavLabel, active && styles.subNavLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {planTab === 'calendar' ? (
        <>
          <GlassCard elevated>
            <Text style={orbitTypography.cardTitle}>This week</Text>
            <View style={styles.weekStrip}>
              {week.map((day, index) => {
                const active = selectedDay === index;
                return (
                  <Pressable
                    key={day.key}
                    onPress={() => setSelectedDay(index)}
                    style={[styles.dayChip, active && styles.dayChipActive, day.isToday && styles.dayChipToday]}>
                    <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{day.label}</Text>
                    <Text style={[styles.dayNumber, active && styles.dayLabelActive]}>{day.dayNumber}</Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>

          <OrbitButton onPress={() => router.push('/create-event' as never)}>Create Event</OrbitButton>

          {household.events.length === 0 ? (
            <GlassCard>
              <Text style={orbitTypography.cardTitle}>No events yet</Text>
              <Text style={orbitTypography.caption}>
                Add school pickups, activities, and appointments so Nova can brief the household.
              </Text>
            </GlassCard>
          ) : selectedDay <= 1 ? (
            <View style={styles.section}>
              <Text style={orbitTypography.cardTitle}>{focusLabel}</Text>
              {focusedEvents.length === 0 ? (
                <GlassCard>
                  <Text style={orbitTypography.caption}>Nothing scheduled for {focusLabel.toLowerCase()}.</Text>
                </GlassCard>
              ) : (
                focusedEvents.map((event) => <EventCard key={event.id} event={event} />)
              )}
            </View>
          ) : (
            groups.map((group) => (
              <View key={group.key} style={styles.section}>
                <Text style={orbitTypography.cardTitle}>{group.key}</Text>
                {group.events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </View>
            ))
          )}
        </>
      ) : (
        <>
          <Text style={orbitTypography.cardTitle}>This weekend</Text>
          {SAMPLE_ITINERARIES.map((item) => (
            <GlassCard key={item.id} elevated style={styles.itineraryCard}>
              <Text style={styles.itineraryWhen}>{item.when}</Text>
              <Text style={orbitTypography.cardTitle}>{item.title}</Text>
              {item.stops.map((stop, index) => (
                <View key={stop} style={styles.stopRow}>
                  <View style={styles.stopIndex}>
                    <Text style={styles.stopIndexText}>{index + 1}</Text>
                  </View>
                  <Text style={orbitTypography.body}>{stop}</Text>
                </View>
              ))}
            </GlassCard>
          ))}
          <GlassCard>
            <Text style={orbitTypography.caption}>
              Full itinerary builder ships next — groceries stay on Home for quick missing-item capture.
            </Text>
          </GlassCard>
        </>
      )}
    </ScrollView>
  );
}

function EventCard({
  event,
}: {
  event: {
    id: string;
    title: string;
    category: string;
    date: string;
    time: string;
    location: string;
    responsible: string;
  };
}) {
  return (
    <Pressable onPress={() => router.push(`/event/${event.id}` as never)}>
      <GlassCard>
        <View style={styles.eventRow}>
          <View style={styles.timeBadge}>
            <Text style={styles.dateText}>{event.date}</Text>
            <Text style={styles.timeText}>{event.time}</Text>
          </View>
          <OrbitListItem
            meta={`${event.location || 'No location'} • ${event.responsible}`}
            title={event.title}
            trailing={<StatusPill label={event.category} tone="cyan" />}
          />
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dateText: {
    color: orbitColors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  dayChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    flexGrow: 1,
    gap: 4,
    minWidth: 44,
    paddingVertical: orbitSpacing.sm,
  },
  dayChipActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
    borderColor: 'rgba(167, 139, 250, 0.45)',
  },
  dayChipToday: {
    borderColor: 'rgba(59, 181, 240, 0.45)',
  },
  dayLabel: {
    color: orbitColors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  dayLabelActive: {
    color: orbitColors.text,
  },
  dayNumber: {
    color: orbitColors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  eventRow: {
    flexDirection: 'row',
    gap: orbitSpacing.md,
  },
  itineraryCard: {
    gap: orbitSpacing.sm,
  },
  itineraryWhen: {
    color: orbitColors.planPurple,
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    gap: orbitSpacing.md,
  },
  stopIndex: {
    alignItems: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  stopIndexText: {
    color: orbitColors.planPurple,
    fontSize: 11,
    fontWeight: '800',
  },
  stopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  subNav: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: orbitRadius.lg,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  subNavButton: {
    alignItems: 'center',
    borderRadius: orbitRadius.md,
    flex: 1,
    paddingVertical: 10,
  },
  subNavButtonActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
    borderColor: 'rgba(167, 139, 250, 0.3)',
    borderWidth: 1,
  },
  subNavLabel: {
    color: orbitColors.textSubtle,
    fontSize: 14,
    fontWeight: '500',
  },
  subNavLabelActive: {
    color: orbitColors.planPurple,
    fontWeight: '700',
  },
  timeBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.16)',
    borderColor: 'rgba(167, 139, 250, 0.3)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 76,
    width: 78,
  },
  timeText: {
    color: orbitColors.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  weekStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: orbitSpacing.sm,
  },
});
