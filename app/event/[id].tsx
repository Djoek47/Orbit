import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitScreen, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdEvent } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

const CATEGORIES: HouseholdEvent['category'][] = ['School', 'Activity', 'Appointment', 'Family', 'Routine'];

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { deleteEvent, household, remindAboutEvent, updateEvent } = useOrbit();
  const event = household.events.find((item) => item.id === id);
  const memberNames = useMemo(() => household.members.map((member) => member.name), [household.members]);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? '');
  const [time, setTime] = useState(event?.time ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [category, setCategory] = useState<HouseholdEvent['category']>(event?.category ?? 'Family');
  const [responsible, setResponsible] = useState(event?.responsible ?? '');
  const [busy, setBusy] = useState(false);

  if (!event) {
    return (
      <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
        <Text style={typography.title2}>Event not found</Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back
        </OrbitButton>
      </ScrollView>
    );
  }

  const handleSave = async () => {
    setBusy(true);
    try {
      await updateEvent({
        ...event,
        title,
        date,
        time,
        location,
        category,
        responsible,
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete event', `Remove “${event.title}” from the household calendar?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteEvent(event.id).then(() => router.back());
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={typography.footnote}>Calendar</Text>
        <Text style={typography.title1}>{editing ? 'Edit event' : event.title}</Text>
        <StatusPill label={event.category} tone="cyan" />
      </View>

      {editing ? (
        <GlassCard style={styles.card}>
          <OrbitInput label="Title" value={title} onChangeText={setTitle} />
          <OrbitInput label="Date" value={date} onChangeText={setDate} />
          <OrbitInput label="Time" value={time} onChangeText={setTime} />
          <OrbitInput label="Location" value={location} onChangeText={setLocation} />
          <ChoiceRow
            label="Category"
            options={CATEGORIES}
            value={category}
            onChange={(value) => setCategory(value as HouseholdEvent['category'])}
          />
          <ChoiceRow label="Responsible" options={memberNames} value={responsible} onChange={setResponsible} />
        </GlassCard>
      ) : (
        <GlassCard style={styles.card}>
          <DetailRow label="Date" value={event.date} />
          <DetailRow label="Time" value={event.time} />
          <DetailRow label="Location" value={event.location || 'No location'} />
          <DetailRow label="Responsible" value={event.responsible} />
        </GlassCard>
      )}

      {editing ? (
        <>
          <OrbitButton disabled={busy || title.trim().length < 2} onPress={handleSave}>
            Save changes
          </OrbitButton>
          <OrbitButton tone="secondary" onPress={() => setEditing(false)}>
            Cancel edit
          </OrbitButton>
        </>
      ) : (
        <>
          <OrbitButton onPress={() => setEditing(true)}>Edit event</OrbitButton>
          <OrbitButton tone="secondary" onPress={() => remindAboutEvent(event.id)}>
            Notify / remind household
          </OrbitButton>
          <OrbitButton tone="danger" onPress={handleDelete}>
            Delete event
          </OrbitButton>
        </>
      )}

      <OrbitButton tone="secondary" onPress={() => router.push('/(tabs)/calendar' as never)}>
        Open calendar
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Back
      </OrbitButton>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { c } = useOrbitColors();
  return (
    <View style={styles.row}>
      <Text style={typography.footnote}>{label}</Text>
      <Text style={[styles.value, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
  },
  row: {
    gap: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
  },
});
