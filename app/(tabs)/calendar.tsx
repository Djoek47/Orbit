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

export default function CalendarScreen() {
  const { household, metrics } = useOrbit();
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
        <Text style={orbitTypography.caption}>Family logistics</Text>
        <Text style={orbitTypography.display}>Calendar</Text>
        <Text style={orbitTypography.body}>
          {metrics.upcomingEvents} upcoming soon · {metrics.calendarCoverage}% coverage with a responsible person.
        </Text>
      </View>

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
    backgroundColor: 'rgba(41, 121, 255, 0.2)',
    borderColor: 'rgba(41, 121, 255, 0.45)',
  },
  dayChipToday: {
    borderColor: 'rgba(0, 194, 255, 0.45)',
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
  section: {
    gap: orbitSpacing.md,
  },
  timeBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(41, 121, 255, 0.16)',
    borderColor: 'rgba(41, 121, 255, 0.3)',
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
