import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, typography } from '@/constants/orbit-theme';
import { isSharedDeviceAccount } from '@/lib/household/shared-device';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdEvent } from '@/types/orbit';

const CATEGORIES: HouseholdEvent['category'][] = ['School', 'Activity', 'Appointment', 'Family', 'Routine'];
const DATE_PRESETS = ['Today', 'Tomorrow', 'This weekend', 'Next week'];

export default function CreateEventScreen() {
  const { createEvent, household, currentMember, permissions } = useOrbit();
  const caps = resolveMemberCapabilities(household);
  const sharedKidMode =
    isSharedDeviceAccount(currentMember, household.members) || currentMember?.role === 'child';
  const canCreate = permissions.canManageHousehold || caps.allowCalendarCreate;
  const simplified = sharedKidMode && !permissions.canManageHousehold;

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('Today');
  const [time, setTime] = useState('5:30 PM');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<HouseholdEvent['category']>('Family');
  const [responsible, setResponsible] = useState(
    currentMember?.name ?? household.members[0]?.name ?? '',
  );
  const [remindMe, setRemindMe] = useState('Yes');
  const [saving, setSaving] = useState(false);

  const memberNames = useMemo(() => household.members.map((member) => member.name), [household.members]);
  const canSave =
    canCreate && title.trim().length > 1 && date.trim().length > 1 && time.trim().length > 1 && !!responsible;

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
        location: simplified ? location.trim() : location,
        responsible: simplified ? currentMember?.name ?? responsible : responsible,
        category: simplified ? 'Family' : category,
        remindMe: !simplified && remindMe === 'Yes',
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (!canCreate) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={orbitScreen.container}>
        <ScrollView contentContainerStyle={orbitScreen.content}>
          <View style={orbitScreen.header}>
            <Text style={typography.footnote}>Plan</Text>
            <Text style={typography.title1}>Create event locked</Text>
            <Text style={typography.body}>
              An admin can enable calendar creates in Settings → Member permissions.
            </Text>
          </View>
          <OrbitButton onPress={() => router.back()}>Go back</OrbitButton>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={orbitScreen.container}>
      <ScrollView contentContainerStyle={orbitScreen.content} contentInsetAdjustmentBehavior="automatic">
        <View style={orbitScreen.header}>
          <Text style={typography.footnote}>{simplified ? 'My event' : 'Family logistics'}</Text>
          <Text style={typography.title1}>Create Event</Text>
          <Text style={typography.body}>
            {simplified
              ? 'Title, when, and optional place — keep it simple.'
              : 'Add a calendar event, assign responsibility, and optionally schedule a local reminder.'}
          </Text>
        </View>

        <GlassCard>
          <OrbitInput label="Event title" onChangeText={setTitle} placeholder="Dentist appointment" value={title} />
          <ChoiceRow label="Date preset" onChange={setDate} options={DATE_PRESETS} value={date} />
          <OrbitInput label="Date label" onChangeText={setDate} placeholder="Today" value={date} />
          <OrbitInput label="Time" onChangeText={setTime} placeholder="5:30 PM" value={time} />
          <OrbitInput
            label={simplified ? 'Place (optional)' : 'Location'}
            onChangeText={setLocation}
            placeholder="School, store, or address"
            value={location}
          />
          {!simplified ? (
            <>
              <ChoiceRow
                label="Category"
                onChange={(value) => setCategory(value as HouseholdEvent['category'])}
                options={CATEGORIES}
                value={category}
              />
              <ChoiceRow label="Responsible person" onChange={setResponsible} options={memberNames} value={responsible} />
              <ChoiceRow label="Local reminder" onChange={setRemindMe} options={['Yes', 'No']} value={remindMe} />
            </>
          ) : null}
        </GlassCard>

        <OrbitButton disabled={!canSave || saving} onPress={handleSave}>
          {saving ? 'Saving…' : 'Save Event'}
        </OrbitButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
