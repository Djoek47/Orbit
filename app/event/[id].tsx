import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household } = useOrbit();
  const event = household.events.find((item) => item.id === id);

  if (!event) {
    return (
      <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
        <Text style={orbitTypography.title}>Event not found</Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back
        </OrbitButton>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Calendar</Text>
        <Text style={orbitTypography.display}>{event.title}</Text>
        <StatusPill label={event.category} tone="cyan" />
      </View>

      <GlassCard style={styles.card}>
        <DetailRow label="Date" value={event.date} />
        <DetailRow label="Time" value={event.time} />
        <DetailRow label="Location" value={event.location || 'No location'} />
        <DetailRow label="Responsible" value={event.responsible} />
      </GlassCard>

      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Back
      </OrbitButton>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={orbitTypography.caption}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: orbitSpacing.md,
  },
  row: {
    gap: 4,
  },
  value: {
    color: orbitColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
