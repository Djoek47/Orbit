import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitListItem } from '@/components/orbit/orbit-list-item';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function CalendarScreen() {
  const { household, metrics } = useOrbit();

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Family logistics</Text>
        <Text style={orbitTypography.display}>Calendar</Text>
        <Text style={orbitTypography.body}>
          {metrics.calendarCoverage}% of events have responsible coverage in this local MVP state.
        </Text>
      </View>

      <OrbitButton onPress={() => router.push('/create-event' as never)}>Create Event</OrbitButton>

      {household.events.map((event) => (
        <GlassCard key={event.id}>
          <View style={styles.eventRow}>
            <View style={styles.timeBadge}>
              <Text style={styles.dateText}>{event.date}</Text>
              <Text style={styles.timeText}>{event.time}</Text>
            </View>
            <OrbitListItem
              meta={`${event.location || 'No location'} • Responsible: ${event.responsible}`}
              title={event.title}
              trailing={<StatusPill label={event.category} tone="cyan" />}
            />
          </View>
        </GlassCard>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dateText: {
    color: orbitColors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  eventRow: {
    flexDirection: 'row',
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
});
