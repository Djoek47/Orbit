import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChoiceRow } from '@/components/orbit/choice-row';
import { EventDatePicker } from '@/components/orbit/event-date-picker';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import {
  buildStartsAtIso,
  formatStoredDateLabel,
  todayKey,
} from '@/lib/calendar/event-date';
import { eventDateKey, eventTypeConfig } from '@/lib/calendar/make-calendar';
import { memberDisplayEmoji } from '@/lib/game-levels';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdEvent, HouseholdMember } from '@/types/orbit';

const CATEGORIES: HouseholdEvent['category'][] = ['School', 'Activity', 'Appointment', 'Family', 'Routine'];

function defaultNotifyMemberIds(event: HouseholdEvent, members: HouseholdMember[]): string[] {
  if (event.attendeeMemberIds?.length) {
    return event.attendeeMemberIds;
  }
  const responsibleId =
    event.responsibleMemberId ?? members.find((member) => member.name === event.responsible)?.id;
  return responsibleId ? [responsibleId] : [];
}

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    accentTheme,
    approveEvent,
    currentMember,
    deleteEvent,
    household,
    orbitPalette,
    permissions,
    rejectEvent,
    remindAboutEvent,
    updateEvent,
  } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();

  const event = household.events.find((item) => item.id === id);
  const activeMembers = useMemo(
    () =>
      household.members.filter(
        (member) => member.status === 'active' && member.role !== 'shared-device'
      ),
    [household.members]
  );
  const memberNames = useMemo(() => activeMembers.map((member) => member.name), [activeMembers]);
  const responsibleMember = useMemo(
    () =>
      activeMembers.find(
        (member) =>
          member.id === event?.responsibleMemberId || member.name === event?.responsible
      ) ?? null,
    [activeMembers, event?.responsible, event?.responsibleMemberId]
  );
  const typeStyle = event ? eventTypeConfig(event.category) : null;

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event?.title ?? '');
  const [dateKey, setDateKey] = useState(
    () => (event ? eventDateKey(event) ?? todayKey() : todayKey())
  );
  const [time, setTime] = useState(event?.time ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [category, setCategory] = useState<HouseholdEvent['category']>(event?.category ?? 'Family');
  const [responsible, setResponsible] = useState(event?.responsible ?? '');
  const [notifyIds, setNotifyIds] = useState<string[]>(() =>
    event ? defaultNotifyMemberIds(event, activeMembers) : []
  );
  const [busy, setBusy] = useState(false);
  const [approveBusy, setApproveBusy] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyPulse, setNotifyPulse] = useState(false);

  useEffect(() => {
    if (!event) return;
    setTitle(event.title);
    setDateKey(eventDateKey(event) ?? todayKey());
    setTime(event.time);
    setLocation(event.location);
    setCategory(event.category);
    setResponsible(event.responsible);
    setNotifyIds(defaultNotifyMemberIds(event, activeMembers));
  }, [activeMembers, event]);

  if (!event) {
    return (
      <ScrollView
        style={orbitScreen.container}
        contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={22} color={accentTheme.primary} />
          <Text style={[styles.backLabel, { color: accentTheme.primary }]}>Plan</Text>
        </Pressable>
        <Text style={[typography.title2, { color: c.text }]}>Event not found</Text>
        <Text style={[typography.body, { color: c.textMuted }]}>
          It may have been removed from the household calendar.
        </Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back to Plan
        </OrbitButton>
      </ScrollView>
    );
  }

  const dateLabel = formatStoredDateLabel(dateKey);
  const canSave = title.trim().length > 1 && time.trim().length > 1 && responsible.trim().length > 0;
  const notifyReady = notifyIds.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const responsibleMemberId =
        activeMembers.find((member) => member.name === responsible)?.id ?? event.responsibleMemberId;
      await updateEvent({
        ...event,
        title: title.trim(),
        date: dateLabel,
        startsAt: buildStartsAtIso(dateKey, time),
        time,
        location: location.trim(),
        category,
        responsible,
        responsibleMemberId: responsibleMemberId ?? null,
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

  const toggleNotifyMember = (memberId: string) => {
    setNotifyIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  };

  const handleNotify = async () => {
    if (!notifyReady || notifyBusy) return;
    setNotifyBusy(true);
    try {
      const ok = await remindAboutEvent(event.id, notifyIds);
      if (ok) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setNotifyPulse(true);
        setTimeout(() => setNotifyPulse(false), 1200);
      }
    } finally {
      setNotifyBusy(false);
    }
  };

  const themedBack = (
    <Pressable
      onPress={() => (editing ? setEditing(false) : router.back())}
      style={styles.backBtn}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={editing ? 'Cancel edit' : 'Back to Plan'}>
      <MaterialIcons
        name={editing ? 'close' : 'chevron-left'}
        size={editing ? 20 : 22}
        color={editing ? c.textMuted : accentTheme.primary}
      />
      {!editing ? <Text style={[styles.backLabel, { color: accentTheme.primary }]}>Plan</Text> : null}
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[orbitScreen.container, { backgroundColor: orbitPalette.backgroundSoft }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[
          orbitScreen.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          {themedBack}
          {!editing ? (
            <Pressable
              onPress={() => setEditing(true)}
              style={[styles.iconBtn, { backgroundColor: glass(0.06) }]}
              hitSlop={8}
              accessibilityLabel="Edit event">
              <MaterialIcons name="edit" size={18} color={accentTheme.primary} />
            </Pressable>
          ) : (
            <Pressable
              disabled={!canSave || busy}
              onPress={() => void handleSave()}
              style={[styles.saveChip, { opacity: !canSave || busy ? 0.45 : 1 }]}
              hitSlop={8}
              accessibilityLabel="Save changes">
              <Text style={[typography.subheadline, { color: accentTheme.primary, fontWeight: '700' }]}>
                {busy ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.header}>
          <PageEyebrow>
            Calendar · {event.category}
          </PageEyebrow>
          {!editing ? (
            <Text style={[typography.title1, { color: c.text }]} accessibilityRole="header">
              {event.title}
            </Text>
          ) : (
            <Text style={[typography.title1, { color: c.text }]} accessibilityRole="header">
              Edit event
            </Text>
          )}
          {!editing && typeStyle ? (
            <View style={styles.metaRow}>
              <View
                style={[
                  styles.categoryChip,
                  { backgroundColor: typeStyle.bg, borderColor: `${typeStyle.color}44` },
                ]}>
                <Text style={styles.categoryEmoji}>{typeStyle.emoji}</Text>
                <Text style={[typography.caption1, { color: typeStyle.color, fontWeight: '700' }]}>
                  {event.category}
                </Text>
              </View>
              {event.approvalStatus === 'pending' ? (
                <StatusPill label="Pending approval" tone="amber" />
              ) : null}
            </View>
          ) : null}
        </View>

        {event.approvalStatus === 'pending' && permissions.canManageHousehold && !editing ? (
          <View style={styles.approvalRow}>
            <OrbitButton
              loading={approveBusy}
              disabled={approveBusy}
              onPress={() => {
                if (approveBusy) return;
                setApproveBusy(true);
                void approveEvent(event.id)
                  .then(() => router.back())
                  .finally(() => setApproveBusy(false));
              }}>
              Approve
            </OrbitButton>
            <OrbitButton
              tone="secondary"
              disabled={approveBusy}
              onPress={() =>
                Alert.alert('Decline event', `Remove “${event.title}” from the calendar?`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: () => {
                      setApproveBusy(true);
                      void rejectEvent(event.id)
                        .then(() => router.back())
                        .finally(() => setApproveBusy(false));
                    },
                  },
                ])
              }>
              Decline
            </OrbitButton>
          </View>
        ) : null}

        {editing ? (
          <GlassCard>
            <OrbitInput label="Title" value={title} onChangeText={setTitle} />
            <Text style={[typography.caption1, { color: c.textMuted, marginBottom: 8 }]}>Date</Text>
            <EventDatePicker value={dateKey} onChange={setDateKey} />
            <OrbitInput label="Time" value={time} onChangeText={setTime} placeholder="5:30 PM" />
            <OrbitInput
              label="Location"
              value={location}
              onChangeText={setLocation}
              placeholder="School, field, or address"
            />
            <ChoiceRow
              label="Category"
              options={CATEGORIES}
              value={category}
              onChange={(value) => setCategory(value as HouseholdEvent['category'])}
            />
            <ChoiceRow label="Responsible" options={memberNames} value={responsible} onChange={setResponsible} />
          </GlassCard>
        ) : (
          <>
            <GlassCard elevated style={styles.detailsCard}>
              <DetailRow
                icon="event"
                label="Date"
                value={event.date}
                accent={typeStyle?.color ?? accentTheme.primary}
              />
              <DetailRow
                icon="schedule"
                label="Time"
                value={event.time}
                accent={typeStyle?.color ?? accentTheme.primary}
              />
              <DetailRow
                icon="place"
                label="Location"
                value={event.location?.trim() ? event.location : 'No location'}
                accent={typeStyle?.color ?? accentTheme.primary}
                muted={!event.location?.trim()}
              />
              <DetailRow
                icon="person"
                label="Responsible"
                value={responsibleMember?.name ?? event.responsible}
                accent={typeStyle?.color ?? accentTheme.primary}
                leading={
                  responsibleMember ? (
                    <View style={[styles.avatar, { backgroundColor: glass(0.08) }]}>
                      <Text style={styles.avatarEmoji}>{memberDisplayEmoji(responsibleMember)}</Text>
                    </View>
                  ) : undefined
                }
              />
            </GlassCard>

            <GlassCard style={styles.notifyCard}>
              <View style={styles.notifyHeader}>
                <View style={styles.notifyCopy}>
                  <Text style={[typography.headline, { color: c.text }]}>Remind</Text>
                  <Text style={[typography.footnote, { color: c.textMuted }]}>
                    Choose who gets a push. Sends immediately — no extra confirmation.
                  </Text>
                </View>
                {notifyPulse ? (
                  <MaterialIcons name="check-circle" size={20} color={c.success} />
                ) : null}
              </View>

              <View style={styles.memberRow}>
                {activeMembers.map((member) => {
                  const selected = notifyIds.includes(member.id);
                  const isSelf = member.id === currentMember?.id;
                  return (
                    <Pressable
                      key={member.id}
                      onPress={() => toggleNotifyMember(member.id)}
                      style={[
                        styles.memberChip,
                        {
                          borderColor: selected ? accentTheme.primary : glassBorder(0.12),
                          backgroundColor: selected ? `${accentTheme.primary}18` : glass(0.04),
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${member.name}${isSelf ? ', you' : ''}`}>
                      <Text style={styles.memberEmoji}>{memberDisplayEmoji(member)}</Text>
                      <Text
                        style={[
                          typography.caption1,
                          {
                            color: selected ? accentTheme.primary : c.text,
                            fontWeight: selected ? '700' : '600',
                          },
                        ]}
                        numberOfLines={1}>
                        {member.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <OrbitButton
                disabled={!notifyReady || notifyBusy}
                loading={notifyBusy}
                onPress={() => void handleNotify()}
                tone="secondary">
                {notifyBusy
                  ? 'Sending…'
                  : notifyReady
                    ? `Notify ${notifyIds.length === 1 ? activeMembers.find((m) => m.id === notifyIds[0])?.name ?? 'member' : `${notifyIds.length} people`}`
                    : 'Select someone to notify'}
              </OrbitButton>
            </GlassCard>

            <View style={styles.footerActions}>
              <OrbitButton onPress={() => setEditing(true)}>Edit event</OrbitButton>
              <Pressable onPress={handleDelete} hitSlop={8} style={styles.deleteLink}>
                <Text style={[typography.subheadline, styles.deleteText]}>Delete event</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DetailRow({
  accent,
  icon,
  label,
  leading,
  muted = false,
  value,
}: {
  accent: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  leading?: React.ReactNode;
  muted?: boolean;
  value: string;
}) {
  const { c } = useOrbitColors();

  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIconWrap, { backgroundColor: `${accent}14` }]}>
        <MaterialIcons name={icon} size={16} color={accent} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={[typography.caption1, { color: c.textMuted }]}>{label}</Text>
        <View style={styles.detailValueRow}>
          {leading}
          <Text
            style={[
              typography.headline,
              { color: muted ? c.textMuted : c.text, fontWeight: '700' },
            ]}>
            {value}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backBtn: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    minHeight: 40,
    paddingRight: 8,
  },
  backLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  iconBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  saveChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  header: {
    gap: space.xs,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: space.xs,
  },
  categoryChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryEmoji: {
    fontSize: 13,
  },
  approvalRow: {
    gap: 10,
  },
  detailsCard: {
    gap: space.md,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
  },
  detailIconWrap: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  detailCopy: {
    flex: 1,
    gap: 2,
  },
  detailValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  avatar: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  avatarEmoji: {
    fontSize: 15,
  },
  notifyCard: {
    gap: space.md,
  },
  notifyHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: space.sm,
    justifyContent: 'space-between',
  },
  notifyCopy: {
    flex: 1,
    gap: 4,
  },
  memberRow: {
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
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  memberEmoji: {
    fontSize: 14,
  },
  footerActions: {
    gap: space.md,
    marginTop: space.xs,
  },
  deleteLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  deleteText: {
    color: '#F87171',
    fontWeight: '600',
  },
});
