import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function CreateEventScreen() {
  const { createEvent, household } = useOrbit();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('Today');
  const [time, setTime] = useState('5:30 PM');
  const [location, setLocation] = useState('');
  const [responsible, setResponsible] = useState(household.members[0]?.name ?? '');

  const memberNames = useMemo(() => household.members.map((member) => member.name), [household.members]);
  const canSave = title.trim().length > 1 && date.trim().length > 1 && time.trim().length > 1;

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    createEvent({ title, date, time, location, responsible });
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={orbitScreen.container}>
      <ScrollView contentContainerStyle={orbitScreen.content} contentInsetAdjustmentBehavior="automatic">
        <View style={orbitScreen.header}>
          <Text style={orbitTypography.caption}>Family logistics</Text>
          <Text style={orbitTypography.display}>Create Event</Text>
          <Text style={orbitTypography.body}>Add a local calendar event and assign responsibility.</Text>
        </View>

        <GlassCard>
          <OrbitInput label="Event title" onChangeText={setTitle} placeholder="Dentist appointment" value={title} />
          <OrbitInput label="Date" onChangeText={setDate} placeholder="Today" value={date} />
          <OrbitInput label="Time" onChangeText={setTime} placeholder="5:30 PM" value={time} />
          <OrbitInput label="Location" onChangeText={setLocation} placeholder="School, store, or address" value={location} />
          <ChoiceRow label="Responsible person" onChange={setResponsible} options={memberNames} value={responsible} />
        </GlassCard>

        <OrbitButton disabled={!canSave} onPress={handleSave}>
          Save Event
        </OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Cancel
        </OrbitButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
