import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitListItem } from '@/components/orbit/orbit-list-item';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import {
  buildWeekStrip,
  eventsForDayKey,
  groupHouseholdEvents,
  itinerariesForDayKey,
} from '@/lib/calendar/event-groups';
import { useOrbit } from '@/store/orbit-store';

type PlanSubTab = 'calendar' | 'itinerary';

export default function PlanScreen() {
  const { household, metrics, suggestNovaItinerary } = useOrbit();
  const [subTab, setSubTab] = useState<PlanSubTab>('calendar');
  const [selectedDay, setSelectedDay] = useState(0);
  const [suggesting, setSuggesting] = useState(false);
  const week = useMemo(() => buildWeekStrip(), []);
  const selectedKey = week[selectedDay]?.key ?? week[0]?.key;
  const dayEvents = useMemo(
    () => eventsForDayKey(household.events, selectedKey),
    [household.events, selectedKey]
  );
  const groups = useMemo(() => groupHouseholdEvents(household.events), [household.events]);
  const dayItineraries = useMemo(
    () => itinerariesForDayKey(household.itineraries ?? [], selectedKey),
    [household.itineraries, selectedKey]
  );
  const allItineraries = household.itineraries ?? [];
  const activeTrips = allItineraries.filter((item) => item.status !== 'completed');
  const completedTrips = allItineraries.filter((item) => item.status === 'completed');

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const created = await suggestNovaItinerary();
      if (created) {
        setSubTab('itinerary');
        router.push(`/itinerary/${created.id}` as never);
      }
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.subNav}>
        {(
          [
            { id: 'calendar' as const, label: 'Calendar', icon: 'calendar-today' as const },
            { id: 'itinerary' as const, label: 'Itineraries', icon: 'map' as const },
          ] as const
        ).map((item) => {
          const active = subTab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setSubTab(item.id)}
              style={[styles.subChip, active && styles.subChipActive]}>
              <MaterialIcons
                name={item.icon}
                size={14}
                color={active ? orbitColors.planPurple : orbitColors.textSubtle}
              />
              <Text style={[styles.subLabel, active && styles.subLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {subTab === 'calendar' ? (
        <>
          <View style={orbitScreen.header}>
            <Text style={orbitTypography.caption}>Family logistics</Text>
            <Text style={orbitTypography.display}>Calendar</Text>
            <Text style={orbitTypography.body}>
              {metrics.upcomingEvents} upcoming · {metrics.calendarCoverage}% coverage
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
                    style={[styles.dayChip, active && styles.dayChipActive]}>
                    <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{day.label}</Text>
                    <Text style={[styles.dayNumber, active && styles.dayLabelActive]}>{day.dayNumber}</Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>

          <OrbitButton onPress={() => router.push('/create-event' as never)}>Create Event</OrbitButton>
          <OrbitButton tone="secondary" onPress={() => router.push('/(tabs)/groceries' as never)}>
            Open groceries
          </OrbitButton>

          {dayEvents.length === 0 ? (
            <GlassCard>
              <Text style={orbitTypography.caption}>Nothing scheduled for this day.</Text>
            </GlassCard>
          ) : (
            dayEvents.map((event) => (
              <Pressable key={event.id} onPress={() => router.push(`/event/${event.id}` as never)}>
                <GlassCard>
                  <OrbitListItem
                    title={event.title}
                    meta={`${event.time} · ${event.location} · ${event.responsible}`}
                    trailing={<StatusPill label={event.category} tone="blue" />}
                  />
                </GlassCard>
              </Pressable>
            ))
          )}

          {selectedDay > 1
            ? groups.map((group) => (
                <View key={group.key} style={styles.section}>
                  <Text style={orbitTypography.cardTitle}>{group.key}</Text>
                  {group.events.map((event) => (
                    <Pressable key={event.id} onPress={() => router.push(`/event/${event.id}` as never)}>
                      <GlassCard>
                        <OrbitListItem
                          title={event.title}
                          meta={`${event.date} · ${event.time}`}
                          trailing={<StatusPill label={event.category} tone="cyan" />}
                        />
                      </GlassCard>
                    </Pressable>
                  ))}
                </View>
              ))
            : null}

          {dayItineraries.length > 0 ? (
            <GlassCard>
              <Text style={orbitTypography.cardTitle}>Trips today</Text>
              {dayItineraries.map((trip) => (
                <Pressable key={trip.id} onPress={() => router.push(`/itinerary/${trip.id}` as never)}>
                  <OrbitListItem
                    title={trip.title}
                    meta={trip.summary ?? `${trip.stops.length} stops`}
                    trailing={<StatusPill label={trip.status} tone="cyan" />}
                  />
                </Pressable>
              ))}
            </GlassCard>
          ) : null}
        </>
      ) : (
        <>
          <View style={orbitScreen.header}>
            <Text style={orbitTypography.caption}>Nova Smart Trips</Text>
            <Text style={orbitTypography.display}>Itineraries</Text>
            <Text style={orbitTypography.body}>
              Bundle school, errands, and grocery stops. Arrived opens the next Maps leg.
            </Text>
          </View>

          <GlassCard elevated style={styles.novaHero}>
            <StatusPill label="Nova smart routing" tone="cyan" />
            <Text style={orbitTypography.body}>
              {activeTrips.length > 0
                ? `You have ${activeTrips.length} active trip${activeTrips.length === 1 ? '' : 's'}. Mark Arrived to hand off the next stop.`
                : 'Ask Nova to bundle today’s events and missing groceries into one calm run.'}
            </Text>
            <View style={styles.statRow}>
              <Stat val={String(activeTrips.length)} label="Active" color={orbitColors.orbitBlue} />
              <Stat
                val={String(activeTrips.reduce((n, t) => n + t.stops.length, 0))}
                label="Stops"
                color={orbitColors.planPurple}
              />
              <Stat val={String(completedTrips.length)} label="Done" color={orbitColors.success} />
            </View>
          </GlassCard>

          <OrbitButton disabled={suggesting} onPress={handleSuggest}>
            {suggesting ? 'Nova is planning…' : 'Suggest trip with Nova'}
          </OrbitButton>
          <OrbitButton tone="secondary" onPress={() => router.push('/create-itinerary' as never)}>
            Create itinerary
          </OrbitButton>

          {activeTrips.map((trip) => (
            <Pressable key={trip.id} onPress={() => router.push(`/itinerary/${trip.id}` as never)}>
              <GlassCard elevated style={styles.tripCard}>
                <View style={styles.tripHeader}>
                  <Text style={orbitTypography.cardTitle}>{trip.title}</Text>
                  <StatusPill label={`${trip.stops.length} stops`} tone="green" />
                </View>
                {trip.summary ? <Text style={styles.summary}>{trip.summary}</Text> : null}
                {trip.suggestedByNova ? <Text style={styles.novaTag}>Nova suggested</Text> : null}
                <Text style={orbitTypography.caption}>
                  {trip.stops
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((stop) => stop.label)
                    .join(' → ')}
                </Text>
              </GlassCard>
            </Pressable>
          ))}

          {completedTrips.length > 0 ? (
            <GlassCard>
              <Text style={orbitTypography.cardTitle}>Completed trips</Text>
              {completedTrips.map((trip) => (
                <OrbitListItem
                  key={trip.id}
                  title={trip.title}
                  meta={`${trip.date} · ${trip.stops.length} stops`}
                  trailing={<StatusPill label="Done" tone="green" />}
                />
              ))}
            </GlassCard>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function Stat({ val, label, color }: { val: string; label: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statVal, { color }]}>{val}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dayChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: orbitRadius.md,
    flex: 1,
    gap: 2,
    paddingVertical: 10,
  },
  dayChipActive: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderColor: 'rgba(167,139,250,0.3)',
    borderWidth: 1,
  },
  dayLabel: {
    color: orbitColors.textSubtle,
    fontSize: 11,
    fontWeight: '600',
  },
  dayLabelActive: {
    color: orbitColors.planPurple,
  },
  dayNumber: {
    color: orbitColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  novaHero: {
    gap: orbitSpacing.sm,
  },
  novaTag: {
    color: orbitColors.novaCyan,
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    gap: orbitSpacing.sm,
  },
  stat: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: orbitRadius.md,
    flex: 1,
    paddingVertical: 10,
  },
  statLabel: {
    color: orbitColors.textSubtle,
    fontSize: 9,
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    gap: orbitSpacing.sm,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  subChip: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  subChipActive: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderColor: 'rgba(167,139,250,0.3)',
  },
  subLabel: {
    color: orbitColors.textSubtle,
    fontSize: 14,
    fontWeight: '400',
  },
  subLabelActive: {
    color: orbitColors.planPurple,
    fontWeight: '600',
  },
  subNav: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: orbitRadius.hero,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  summary: {
    color: orbitColors.orbitBlue,
    fontSize: 13,
    fontWeight: '600',
  },
  tripCard: {
    gap: orbitSpacing.sm,
  },
  tripHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: orbitSpacing.sm,
  },
  weekStrip: {
    flexDirection: 'row',
    gap: 6,
    marginTop: orbitSpacing.sm,
  },
});
