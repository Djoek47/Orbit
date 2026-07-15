import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdEvent } from '@/types/orbit';

const CATEGORIES: HouseholdEvent['category'][] = ['School', 'Activity', 'Appointment', 'Family', 'Routine'];
const DATE_PRESETS = ['Today', 'Tomorrow', 'This weekend', 'Next week'];

export default function CreateEventScreen() {
  const { createEvent, household } = useOrbit();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('Today');
  const [time, setTime] = useState('5:30 PM');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<HouseholdEvent['category']>('Family');
  const [responsible, setResponsible] = useState(household.members[0]?.name ?? '');
  const [remindMe, setRemindMe] = useState('Yes');
  const [saving, setSaving] = useState(false);

  const memberNames = useMemo(() => household.members.map((member) => member.name), [household.members]);
  const canSave = title.trim().length > 1 && date.trim().length > 1 && time.trim().length > 1 && !!responsible;

  const handleSave = async () => {
    if (!canSave || saving) {
      return;
    }

    setSaving(true);
    try {
      await createEvent({
        title,
        date,
        time,
        location,
        responsible,
        category,
        remindMe: remindMe === 'Yes',
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={orbitScreen.container}>
      <ScrollView contentContainerStyle={orbitScreen.content} contentInsetAdjustmentBehavior="automatic">
        <View style={orbitScreen.header}>
          <Text style={orbitTypography.caption}>Family logistics</Text>
          <Text style={orbitTypography.display}>Create Event</Text>
          <Text style={orbitTypography.body}>
            Add a calendar event, assign responsibility, and optionally schedule a local reminder.
          </Text>
        </View>

        <GlassCard>
          <OrbitInput label="Event title" onChangeText={setTitle} placeholder="Dentist appointment" value={title} />
          <ChoiceRow label="Date preset" onChange={setDate} options={DATE_PRESETS} value={date} />
          <OrbitInput label="Date label" onChangeText={setDate} placeholder="Today" value={date} />
          <OrbitInput label="Time" onChangeText={setTime} placeholder="5:30 PM" value={time} />
          <OrbitInput label="Location" onChangeText={setLocation} placeholder="School, store, or address" value={location} />
          <ChoiceRow
            label="Category"
            onChange={(value) => setCategory(value as HouseholdEvent['category'])}
            options={CATEGORIES}
            value={category}
          />
          <ChoiceRow label="Responsible person" onChange={setResponsible} options={memberNames} value={responsible} />
          <ChoiceRow label="Local reminder" onChange={setRemindMe} options={['Yes', 'No']} value={remindMe} />
        </GlassCard>

        <OrbitButton disabled={!canSave || saving} onPress={handleSave}>
          {saving ? 'Saving…' : 'Save Event'}
        </OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Cancel
        </OrbitButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
