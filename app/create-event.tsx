import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { EventDatePicker } from '@/components/orbit/event-date-picker';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, typography } from '@/constants/orbit-theme';
import { buildStartsAtIso, formatStoredDateLabel, todayKey } from '@/lib/calendar/event-date';
import { isSharedDeviceAccount } from '@/lib/household/shared-device';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdEvent } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

const CATEGORIES: HouseholdEvent['category'][] = ['School', 'Activity', 'Appointment', 'Family'];

export default function CreateEventScreen() {
  const insets = useSafeAreaInsets();
  const { createEvent, household, currentMember, orbitPalette, permissions } = useOrbit();
  const { c } = useOrbitColors();
  const caps = resolveMemberCapabilities(household);
  const sharedKidMode =
    isSharedDeviceAccount(currentMember, household.members) || currentMember?.role === 'child';
  const canCreate = permissions.canManageHousehold || caps.allowCalendarCreate;
  const simplified = sharedKidMode && !permissions.canManageHousehold;

  const [title, setTitle] = useState('');
  const [dateKey, setDateKey] = useState(todayKey());
  const [time, setTime] = useState('5:30 PM');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<HouseholdEvent['category']>('Family');
  const [responsible, setResponsible] = useState(
    currentMember?.name ?? household.members[0]?.name ?? '',
  );
  const [remindMe, setRemindMe] = useState('Yes');
  const [saving, setSaving] = useState(false);

  const memberNames = useMemo(() => household.members.map((member) => member.name), [household.members]);
  const dateLabel = useMemo(() => formatStoredDateLabel(dateKey), [dateKey]);
  const canSave =
    canCreate && title.trim().length > 1 && dateKey.trim().length > 1 && time.trim().length > 1 && !!responsible;

  const handleSave = async () => {
    if (!canSave || saving) {
      return;
    }

    setSaving(true);
    try {
      await createEvent({
        title,
        date: dateLabel,
        dateKey,
        startsAt: buildStartsAtIso(dateKey, time),
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[orbitScreen.container, { backgroundColor: orbitPalette.backgroundSoft, paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={orbitScreen.content}>
          <View style={orbitScreen.header}>
            <Text style={[typography.footnote, { color: c.textMuted }]}>Plan</Text>
            <Text style={[typography.title1, { color: c.text }]}>Create event locked</Text>
            <Text style={[typography.body, { color: c.textSoft }]}>
              An admin can enable calendar creates in Settings → Member permissions.
            </Text>
          </View>
          <OrbitButton onPress={() => router.back()}>Go back</OrbitButton>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[orbitScreen.container, { backgroundColor: orbitPalette.backgroundSoft, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={orbitScreen.content} contentInsetAdjustmentBehavior="automatic">
        <View style={orbitScreen.header}>
          <Text style={[typography.footnote, { color: c.textMuted }]}>
            {simplified ? 'My event' : 'Family logistics'}
          </Text>
          <Text style={[typography.title1, { color: c.text }]}>Create Event</Text>
          <Text style={[typography.body, { color: c.textSoft }]}>
            {simplified
              ? 'Title, when, and optional place — keep it simple.'
              : 'Add a calendar event, assign responsibility, and optionally schedule a local reminder.'}
          </Text>
        </View>

        <GlassCard>
          <OrbitInput label="Event title" onChangeText={setTitle} placeholder="Dentist appointment" value={title} />
          <Text style={[typography.caption1, { color: c.textMuted, marginBottom: 8 }]}>Date</Text>
          <EventDatePicker value={dateKey} onChange={setDateKey} />
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
