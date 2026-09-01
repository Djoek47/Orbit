import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { EventDatePicker } from '@/components/orbit/event-date-picker';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import { buildStartsAtIso, formatStoredDateLabel, todayKey } from '@/lib/calendar/event-date';
import { sidekickEventNeedsApproval } from '@/lib/calendar/event-approval';
import {
  categoryForPlanAddKind,
  planAddScreenTitle,
} from '@/lib/calendar/sidekick-plan-add';
import { memberDisplayEmoji } from '@/lib/game-levels';
import { isSharedDeviceAccount } from '@/lib/household/shared-device';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdEvent, HouseholdMember } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

const CATEGORIES: HouseholdEvent['category'][] = ['School', 'Activity', 'Appointment', 'Family'];

export default function CreateEventScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const { createEvent, household, currentMember, orbitPalette, permissions } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const caps = resolveMemberCapabilities(household);
  const sharedKidMode =
    isSharedDeviceAccount(currentMember, household.members) || currentMember?.role === 'child';
  const canCreate = permissions.canManageHousehold || caps.allowCalendarCreate;
  const simplified = sharedKidMode && !permissions.canManageHousehold;
  const presetCategory = categoryForPlanAddKind(kind);
  const needsApproval =
    simplified &&
    isSidekickRole(currentMember?.role) &&
    sidekickEventNeedsApproval(caps, presetCategory);

  const [title, setTitle] = useState('');
  const [dateKey, setDateKey] = useState(todayKey());
  const [time, setTime] = useState('5:30 PM');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<HouseholdEvent['category']>(presetCategory);
  const [responsible, setResponsible] = useState(
    currentMember?.name ?? household.members[0]?.name ?? '',
  );
  const [remindMe, setRemindMe] = useState('Yes');
  const [householdWide, setHouseholdWide] = useState(false);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const screenTitle = simplified ? planAddScreenTitle(kind) : 'Create event';

  const activeMembers = useMemo(
    () => household.members.filter((member) => member.status === 'active'),
    [household.members]
  );
  const memberNames = useMemo(() => activeMembers.map((member) => member.name), [activeMembers]);
  const dateLabel = useMemo(() => formatStoredDateLabel(dateKey), [dateKey]);
  const responsibleMember = useMemo(
    () => activeMembers.find((member) => member.name === responsible) ?? null,
    [activeMembers, responsible]
  );
  const canSave =
    canCreate && title.trim().length > 1 && dateKey.trim().length > 1 && time.trim().length > 1 && !!responsible;

  const toggleAttendee = (memberId: string) => {
    setAttendeeIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  };

  const handleSave = async () => {
    if (!canSave || saving) return;

    const resolvedResponsible = simplified ? currentMember?.name ?? responsible : responsible;
    const resolvedResponsibleMember =
      simplified && currentMember ? currentMember : responsibleMember;
    const resolvedCategory = simplified ? presetCategory : category;
    const targetedIds =
      householdWide || simplified
        ? undefined
        : attendeeIds.length > 0
          ? attendeeIds
          : resolvedResponsibleMember
            ? [resolvedResponsibleMember.id]
            : undefined;

    setSaving(true);
    try {
      const created = await createEvent({
        title,
        date: dateLabel,
        dateKey,
        startsAt: buildStartsAtIso(dateKey, time),
        time,
        location: simplified ? location.trim() : location,
        responsible: resolvedResponsible,
        responsibleMemberId: resolvedResponsibleMember?.id ?? null,
        attendeeMemberIds: targetedIds,
        householdWide: !simplified && householdWide,
        category: resolvedCategory,
        remindMe: !simplified && remindMe === 'Yes',
      });
      if (created?.approvalStatus === 'pending') {
        Alert.alert(
          'Sent for approval',
          'A parent will review this before it shows for everyone.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }
      router.back();
    } catch (error) {
      Alert.alert(
        'Could not add event',
        error instanceof Error ? error.message : 'Try again.'
      );
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
            <Text style={[typography.title1, { color: c.text }]}>Calendar adds locked</Text>
            <Text style={[typography.body, { color: c.textSoft }]}>
              An admin can enable calendar adds in Settings → What Sidekicks can do.
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
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeRow}>
            <MaterialIcons name="close" size={22} color={c.textMuted} />
          </Pressable>
          <Text style={[typography.title1, { color: c.text, marginTop: space.sm }]}>{screenTitle}</Text>
          <Text style={[typography.body, { color: c.textSoft, marginTop: space.xs }]}>
            {simplified
              ? needsApproval
                ? 'Your parent will approve this before it appears for the household.'
                : 'Adds to your Plan immediately.'
              : 'Assign responsibility and optionally schedule a local reminder.'}
          </Text>
        </View>

        <GlassCard>
          <OrbitInput
            label="Title"
            onChangeText={setTitle}
            placeholder={
              presetCategory === 'School'
                ? 'Math test, field trip…'
                : presetCategory === 'Activity'
                  ? 'Soccer practice, piano…'
                  : 'What is happening?'
            }
            value={title}
          />
          <Text style={[typography.caption1, { color: c.textMuted, marginBottom: 8 }]}>Date</Text>
          <EventDatePicker value={dateKey} onChange={setDateKey} />
          <OrbitInput label="Time" onChangeText={setTime} placeholder="5:30 PM" value={time} />
          <OrbitInput
            label={simplified ? 'Place (optional)' : 'Location'}
            onChangeText={setLocation}
            placeholder="School, field, or address"
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
              <View style={styles.targetBlock}>
                <Text style={[typography.caption1, { color: c.textMuted, marginBottom: space.sm }]}>
                  Who is this for?
                </Text>
                <Pressable
                  onPress={() => {
                    setHouseholdWide((value) => !value);
                    if (!householdWide) setAttendeeIds([]);
                  }}
                  style={[
                    styles.wideToggle,
                    {
                      borderColor: householdWide ? c.planPurple : glassBorder(0.12),
                      backgroundColor: householdWide ? `${c.planPurple}18` : glass(0.04),
                    },
                  ]}>
                  <Text style={[typography.subheadline, { color: householdWide ? c.planPurple : c.text }]}>
                    Household-wide
                  </Text>
                  <Text style={[typography.caption1, { color: c.textMuted }]}>
                    Everyone sees this on Plan
                  </Text>
                </Pressable>
                {!householdWide ? (
                  <View style={styles.chipRow}>
                    {activeMembers.map((member: HouseholdMember) => {
                      const active = attendeeIds.includes(member.id);
                      return (
                        <Pressable
                          key={member.id}
                          onPress={() => toggleAttendee(member.id)}
                          style={[
                            styles.memberChip,
                            {
                              borderColor: active ? c.planPurple : glassBorder(0.12),
                              backgroundColor: active ? `${c.planPurple}18` : glass(0.04),
                            },
                          ]}>
                          <Text style={{ fontSize: 14 }}>{memberDisplayEmoji(member)}</Text>
                          <Text
                            style={[
                              typography.caption1,
                              { color: active ? c.planPurple : c.text, fontWeight: '600' },
                            ]}>
                            {member.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
              <ChoiceRow label="Local reminder" onChange={setRemindMe} options={['Yes', 'No']} value={remindMe} />
            </>
          ) : null}
        </GlassCard>

        <OrbitButton disabled={!canSave || saving} onPress={handleSave}>
          {saving ? 'Saving…' : needsApproval ? 'Send for approval' : 'Add to Plan'}
        </OrbitButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  closeRow: {
    alignSelf: 'flex-start',
  },
  targetBlock: {
    marginTop: space.md,
  },
  wideToggle: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
