import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { EventPreviewCard, type PreviewChip } from '@/components/orbit/event/event-preview-card';
import { EventDatePicker } from '@/components/orbit/event-date-picker';
import { MemberGlyph } from '@/components/orbit/member-glyph';
import { Moji } from '@/components/orbit/moji/moji';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { STAGE, stageBorder, stageFaint, stageMuted } from '@/constants/iui-stage';
import { orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import { sidekickEventNeedsApproval } from '@/lib/calendar/event-approval';
import { buildStartsAtIso, formatStoredDateLabel, todayKey } from '@/lib/calendar/event-date';
import { dayStripItems, hhmmToMinutes, layoutDayStrip, timeRangeLabel } from '@/lib/calendar/day-strip';
import { readEventSentence } from '@/lib/calendar/event-sentence';
import { categoryForPlanAddKind, planAddScreenTitle } from '@/lib/calendar/sidekick-plan-add';
import { isSharedDeviceAccount } from '@/lib/household/shared-device';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import { eventLeaveByLine } from '@/lib/poppins/event-leave-by';
import { addMinutesToTime, dateKey as toKey, formatTime12, friendlyDay, parseDateKey } from '@/lib/poppins/when-parse';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdEvent, HouseholdMember, SavedPlace } from '@/types/orbit';

const CATEGORIES: HouseholdEvent['category'][] = ['School', 'Activity', 'Appointment', 'Family'];
const TIME_CHIPS = ['08:00', '09:00', '12:00', '15:30', '16:00', '17:30', '18:00'];
const DURATIONS: { minutes: number; label: string }[] = [
  { minutes: 30, label: '30m' },
  { minutes: 45, label: '45m' },
  { minutes: 60, label: '1h' },
  { minutes: 90, label: '1h30' },
  { minutes: 120, label: '2h' },
];
const HOURS_12 = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
const MINUTES = [0, 15, 30, 45];
const ADULT_ROLES = new Set(['owner', 'admin', 'adult']);

type ManualField = 'title' | 'day' | 'time' | 'duration' | 'who';

function durationLabel(minutes: number) {
  const known = DURATIONS.find((d) => d.minutes === minutes);
  if (known) return known.label;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m}m`;
}

function matchSavedPlace(places: SavedPlace[], text: string): SavedPlace | null {
  const q = text.trim().toLowerCase();
  if (q.length < 2) return null;
  return places.find((p) => p.name.trim().toLowerCase() === q) ?? null;
}

export default function CreateEventScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const { createEvent, household, currentMember, orbitPalette, permissions } = useOrbit();
  const { c, isDark } = useOrbitColors();
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

  const [sentence, setSentence] = useState('');
  const [title, setTitle] = useState('');
  const [dateKey, setDateKey] = useState(todayKey());
  const [time, setTime] = useState('17:30');
  const [allDay, setAllDay] = useState(false);
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<HouseholdEvent['category']>(presetCategory);
  const [responsible, setResponsible] = useState(
    currentMember?.name ?? household.members[0]?.name ?? '',
  );
  const [remindMe, setRemindMe] = useState(true);
  const [householdWide, setHouseholdWide] = useState(false);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [manual, setManual] = useState<Partial<Record<ManualField, true>>>({});
  const placeRef = useRef<TextInput>(null);

  const accentText = isDark ? STAGE.domain.plan : STAGE.domainLight.plan;
  const fill = STAGE.domain.plan;
  const muted = stageMuted(isDark);
  const screenTitle = simplified ? planAddScreenTitle(kind) : 'New event';

  const activeMembers = useMemo(
    () => household.members.filter((member) => member.status === 'active'),
    [household.members]
  );
  const responsibleMember = useMemo(
    () => activeMembers.find((member) => member.name === responsible) ?? null,
    [activeMembers, responsible]
  );
  const whoMember = simplified ? currentMember ?? responsibleMember : responsibleMember;
  const whoName = simplified ? currentMember?.name ?? responsible : responsible;
  const savedPlaces = useMemo(() => household.savedPlaces ?? [], [household.savedPlaces]);
  const matchedPlace = useMemo(() => matchSavedPlace(savedPlaces, location), [savedPlaces, location]);
  const placeSuggestions = useMemo(() => {
    const q = location.trim().toLowerCase();
    return savedPlaces
      .filter((p) => (q ? p.name.toLowerCase().includes(q) && p.name.toLowerCase() !== q : true))
      .slice(0, 4);
  }, [savedPlaces, location]);
  /** The grown-up a "Tell …" chip adds to the event — never the person making it. */
  const tellAdult = useMemo(
    () =>
      activeMembers.find(
        (m) => ADULT_ROLES.has(m.role) && m.id !== currentMember?.id && m.id !== responsibleMember?.id
      ) ?? null,
    [activeMembers, currentMember?.id, responsibleMember?.id]
  );

  const endTime = allDay ? undefined : addMinutesToTime(time, duration);
  const timeLine = allDay ? 'All day' : timeRangeLabel(time, endTime);
  const detail = [householdWide && !simplified ? 'Everyone' : whoName, timeLine].filter(Boolean).join(' · ');
  const leaveBy = !allDay && location.trim() ? eventLeaveByLine({ time, location }) : null;

  const layout = useMemo(() => {
    const others = dayStripItems(household.events, dateKey);
    const start = hhmmToMinutes(time) ?? undefined;
    return layoutDayStrip(
      { title, allDay, start, end: start != null ? start + duration : undefined },
      others
    );
  }, [household.events, dateKey, time, duration, allDay, title]);

  const dayChips = useMemo(() => {
    const today = new Date();
    const keys: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      keys.push(toKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)));
    }
    return keys;
  }, []);
  const dayLabel = (key: string, index: number) => {
    if (index < 2) return friendlyDay(key);
    const d = parseDateKey(key);
    return d ? `${d.toLocaleString('en', { weekday: 'short' })} ${d.getDate()}` : key;
  };
  const timeChips = TIME_CHIPS.includes(time) ? TIME_CHIPS : [time, ...TIME_CHIPS];
  const durationChips = DURATIONS.some((d) => d.minutes === duration)
    ? DURATIONS
    : [{ minutes: duration, label: durationLabel(duration) }, ...DURATIONS];

  const canSave =
    canCreate &&
    title.trim().length > 1 &&
    dateKey.trim().length > 1 &&
    (allDay || time.trim().length > 1) &&
    !!responsible;

  const mark = (field: ManualField) =>
    setManual((current) => (current[field] ? current : { ...current, [field]: true }));
  const focusPlace = () => placeRef.current?.focus();

  const onSentence = (text: string) => {
    setSentence(text);
    const read = readEventSentence(text, activeMembers, new Date());
    if (!manual.title) setTitle(read.title);
    if (read.dateKey && !manual.day) setDateKey(read.dateKey);
    if (!manual.time) {
      if (read.allDay) setAllDay(true);
      else if (read.time) {
        setAllDay(false);
        setTime(read.time);
      }
    }
    if (read.durationMin && read.durationMin > 0 && !manual.duration) {
      setDuration(read.durationMin);
    }
    if (read.memberId && !simplified && !manual.who) {
      const member = activeMembers.find((m) => m.id === read.memberId);
      if (member) setResponsible(member.name);
    }
  };

  const toggleAttendee = (memberId: string) => {
    setAttendeeIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  };

  const setClock = (hour12: number, minute: number, pm: boolean) => {
    const h = hour12 % 12 + (pm ? 12 : 0);
    mark('time');
    setAllDay(false);
    setTime(`${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };
  const [clockH, clockM] = time.split(':').map(Number) as [number, number];
  const clockPm = clockH >= 12;
  const clockHour12 = clockH % 12 === 0 ? 12 : clockH % 12;

  const previewChips: PreviewChip[] = [];
  if (!simplified) {
    previewChips.push({
      id: 'remind',
      label: 'Remind 1h before',
      selected: remindMe,
    });
  }
  if (!location.trim()) {
    previewChips.push({ id: 'place', label: 'Add place' });
  }
  if (!simplified && !householdWide && tellAdult) {
    previewChips.push({
      id: 'tell',
      label: `Tell ${tellAdult.name}`,
      selected: attendeeIds.includes(tellAdult.id),
    });
  }
  const handlePreviewChip = (id: string) => {
    if (id === 'remind') setRemindMe((v) => !v);
    else if (id === 'place') focusPlace();
    else if (id === 'tell' && tellAdult) toggleAttendee(tellAdult.id);
  };

  const handleSave = async () => {
    if (!canSave || saving) return;

    const resolvedResponsible = simplified ? currentMember?.name ?? responsible : responsible;
    const resolvedResponsibleMember =
      simplified && currentMember ? currentMember : responsibleMember;
    const resolvedCategory = simplified ? presetCategory : category;
    // Whoever it's for always sees it; "Tell …" / extra people are added alongside.
    const targetedIds =
      householdWide || simplified
        ? undefined
        : attendeeIds.length > 0
          ? Array.from(
              new Set([
                ...(resolvedResponsibleMember ? [resolvedResponsibleMember.id] : []),
                ...attendeeIds,
              ])
            )
          : resolvedResponsibleMember
            ? [resolvedResponsibleMember.id]
            : undefined;
    const storedTime = allDay ? 'All day' : time;

    setSaving(true);
    try {
      const created = await createEvent({
        title: title.trim(),
        date: formatStoredDateLabel(dateKey),
        dateKey,
        // All-day rows sit at local noon so the day never slips across a UTC boundary.
        startsAt: buildStartsAtIso(dateKey, allDay ? '12:00' : time),
        time: storedTime,
        location: simplified ? location.trim() : location,
        responsible: resolvedResponsible,
        responsibleMemberId: resolvedResponsibleMember?.id ?? null,
        attendeeMemberIds: targetedIds,
        householdWide: !simplified && householdWide,
        category: resolvedCategory,
        remindMe: !simplified && remindMe,
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

  const chip = (
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
    leading?: ReactNode
  ) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: `${fill}26`, borderColor: fill }
          : { borderColor: stageBorder(isDark, true) },
        pressed && styles.pressed,
      ]}>
      {leading}
      <Text style={[typography.footnote, styles.chipLabel, { color: selected ? accentText : c.text }]}>
        {label}
      </Text>
    </Pressable>
  );

  const titlePlaceholder =
    presetCategory === 'School'
      ? 'Math test, field trip…'
      : presetCategory === 'Activity'
        ? 'Soccer practice, piano…'
        : 'What is happening?';
  const sentencePlaceholder =
    presetCategory === 'School'
      ? 'Field trip Friday, all day'
      : presetCategory === 'Activity'
        ? 'Soccer practice Saturday at 10'
        : 'Dentist for Noah next Thursday at half four';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[orbitScreen.container, { backgroundColor: orbitPalette.backgroundSoft, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close" accessibilityRole="button">
          <MaterialIcons name="close" size={22} color={c.textMuted} />
        </Pressable>
        <View style={styles.topBarTitle}>
          <Moji name="calendar" size={18} />
          <Text style={[typography.caption2, styles.kicker, { color: muted }]}>
            {`PLAN · ${screenTitle.toUpperCase()}`}
          </Text>
        </View>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        <View style={styles.sentenceBlock}>
          <TextInput
            value={sentence}
            onChangeText={onSentence}
            placeholder={sentencePlaceholder}
            placeholderTextColor={stageFaint(isDark)}
            style={[styles.sentence, { color: c.text }]}
            multiline
            blurOnSubmit
            returnKeyType="done"
            autoCapitalize="sentences"
            accessibilityLabel="Describe the event"
          />
          <Text style={[typography.caption1, { color: muted }]}>
            {simplified
              ? needsApproval
                ? 'Your parent will approve this before it appears for the household.'
                : 'Adds to your Plan immediately.'
              : 'Say it the way you would to a person — the details fill in below.'}
          </Text>
        </View>

        <EventPreviewCard
          title={title}
          placeholderTitle={titlePlaceholder.replace('…', '')}
          dateKey={dateKey}
          detail={detail}
          member={householdWide && !simplified ? null : whoMember}
          place={location.trim() || undefined}
          placeAddress={matchedPlace?.address}
          leaveBy={leaveBy}
          chips={previewChips}
          onChipPress={handlePreviewChip}
          layout={layout}
        />

        <View style={[styles.fields, { borderColor: stageBorder(isDark), backgroundColor: isDark ? STAGE.surface.row : STAGE.surfaceLight.card }]}>
          <Field label="Title" muted={muted}>
            <TextInput
              value={title}
              onChangeText={(t) => {
                mark('title');
                setTitle(t);
              }}
              placeholder={titlePlaceholder}
              placeholderTextColor={stageFaint(isDark)}
              style={[styles.input, { color: c.text, borderColor: stageBorder(isDark, true) }]}
              returnKeyType="done"
            />
          </Field>

          <Field label="Day" muted={muted}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {!dayChips.includes(dateKey)
                ? chip('picked', friendlyDay(dateKey), true, () => setShowCalendar(true))
                : null}
              {dayChips.map((key, i) =>
                chip(key, dayLabel(key, i), key === dateKey, () => {
                  mark('day');
                  setDateKey(key);
                })
              )}
              {chip(
                'pick',
                'Pick a date',
                showCalendar,
                () => setShowCalendar((v) => !v),
                <MaterialIcons name="calendar-today" size={14} color={showCalendar ? accentText : muted} />
              )}
            </ScrollView>
            {showCalendar ? (
              <View style={styles.calendar}>
                <EventDatePicker
                  value={dateKey}
                  onChange={(key) => {
                    mark('day');
                    setDateKey(key);
                  }}
                />
              </View>
            ) : null}
          </Field>

          <Field label="Time" muted={muted}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {chip('allday', 'All day', allDay, () => {
                mark('time');
                setAllDay((v) => !v);
              })}
              {timeChips.map((t) =>
                chip(t, formatTime12(t, { compact: true }), !allDay && t === time, () => {
                  mark('time');
                  setAllDay(false);
                  setTime(t);
                })
              )}
              {chip(
                'clock',
                'Other time',
                showClock,
                () => setShowClock((v) => !v),
                <MaterialIcons name="schedule" size={14} color={showClock ? accentText : muted} />
              )}
            </ScrollView>
            {showClock ? (
              <View style={styles.clock}>
                <View style={styles.wrapRow}>
                  {HOURS_12.map((h) =>
                    chip(`h${h}`, String(h), !allDay && clockHour12 === h, () => setClock(h, clockM, clockPm))
                  )}
                </View>
                <View style={styles.wrapRow}>
                  {MINUTES.map((m) =>
                    chip(`m${m}`, `:${String(m).padStart(2, '0')}`, !allDay && clockM === m, () =>
                      setClock(clockHour12, m, clockPm)
                    )
                  )}
                  {chip('am', 'AM', !allDay && !clockPm, () => setClock(clockHour12, clockM, false))}
                  {chip('pm', 'PM', !allDay && clockPm, () => setClock(clockHour12, clockM, true))}
                </View>
              </View>
            ) : null}
          </Field>

          {!allDay ? (
            <Field label="How long" muted={muted} hint={endTime ? `Ends ${formatTime12(endTime)}` : undefined}>
              <View style={styles.wrapRow}>
                {durationChips.map((d) =>
                  chip(`d${d.minutes}`, d.label, d.minutes === duration, () => {
                    mark('duration');
                    setDuration(d.minutes);
                  })
                )}
              </View>
            </Field>
          ) : null}

          {!simplified ? (
            <Field label="Who it's for" muted={muted}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberRow}>
                {activeMembers.map((member: HouseholdMember) => {
                  const active = member.name === responsible;
                  return (
                    <Pressable
                      key={member.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={member.name}
                      onPress={() => {
                        mark('who');
                        setResponsible(member.name);
                      }}
                      style={({ pressed }) => [styles.member, pressed && styles.pressed]}>
                      <View
                        style={[
                          styles.avatar,
                          {
                            borderColor: active ? fill : stageBorder(isDark, true),
                            backgroundColor: active ? `${fill}26` : 'transparent',
                          },
                        ]}>
                        <MemberGlyph member={member} size={22} />
                      </View>
                      <Text
                        style={[typography.caption1, { color: active ? accentText : muted }]}
                        numberOfLines={1}>
                        {member.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Field>
          ) : null}

          {!simplified ? (
            <Field label="On whose calendar" muted={muted}>
              <View style={styles.wrapRow}>
                {chip('everyone', 'Everyone', householdWide, () => {
                  setHouseholdWide((value) => !value);
                  if (!householdWide) setAttendeeIds([]);
                })}
                {!householdWide
                  ? activeMembers
                      .filter((m) => m.id !== responsibleMember?.id)
                      .map((member) =>
                        chip(
                          `a${member.id}`,
                          member.name,
                          attendeeIds.includes(member.id),
                          () => toggleAttendee(member.id),
                          <MemberGlyph member={member} size={13} />
                        )
                      )
                  : null}
              </View>
            </Field>
          ) : null}

          <Field
            label={simplified ? 'Place (optional)' : 'Place'}
            muted={muted}
            hint={matchedPlace?.address}>
            <TextInput
              ref={placeRef}
              value={location}
              onChangeText={setLocation}
              placeholder="School, field, or address"
              placeholderTextColor={stageFaint(isDark)}
              style={[styles.input, { color: c.text, borderColor: stageBorder(isDark, true) }]}
              returnKeyType="done"
            />
            {placeSuggestions.length && !matchedPlace ? (
              <View style={styles.wrapRow}>
                {placeSuggestions.map((p) =>
                  chip(`p${p.id}`, p.name, false, () => setLocation(p.name), <Moji emoji={p.emoji} fallback="pin" size={14} />)
                )}
              </View>
            ) : null}
          </Field>

          {!simplified ? (
            <Field label="Category" muted={muted}>
              <View style={styles.wrapRow}>
                {CATEGORIES.map((cat) => chip(cat, cat, cat === category, () => setCategory(cat)))}
              </View>
            </Field>
          ) : null}

          {!simplified ? (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: remindMe }}
              onPress={() => setRemindMe((v) => !v)}
              style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}>
              <Moji name="bell" size={20} />
              <View style={styles.toggleBody}>
                <Text style={[typography.subheadline, { color: c.text }]}>Remind 1h before</Text>
                <Text style={[typography.caption1, { color: muted }]}>A reminder on this phone</Text>
              </View>
              <View
                style={[
                  styles.switchTrack,
                  { backgroundColor: remindMe ? fill : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,28,42,0.12)' },
                ]}>
                <View style={[styles.switchKnob, remindMe ? styles.switchOn : null]} />
              </View>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, space.md),
            borderTopColor: stageBorder(isDark),
            backgroundColor: orbitPalette.backgroundSoft,
          },
        ]}>
        <OrbitButton disabled={!canSave || saving} loading={saving} onPress={handleSave}>
          {saving ? 'Saving…' : needsApproval ? 'Send for approval' : 'Add to family calendar'}
        </OrbitButton>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  hint,
  muted,
  children,
}: {
  label: string;
  hint?: string;
  muted: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={[typography.caption2, styles.kicker, { color: muted }]}>{label.toUpperCase()}</Text>
        {hint ? (
          <Text style={[typography.caption1, { color: muted, flexShrink: 1 }]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  topBarTitle: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: space.xs,
    justifyContent: 'center',
  },
  topBarSpacer: { width: 22 },
  kicker: { letterSpacing: 1.2 },
  content: {
    gap: space.lg,
    paddingBottom: space.xxl,
    paddingHorizontal: space.md,
    paddingTop: space.xs,
  },
  sentenceBlock: { gap: space.xs },
  sentence: {
    ...typography.title3,
    minHeight: 56,
    paddingVertical: space.xs,
    textAlignVertical: 'top',
  },
  fields: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.lg,
    padding: space.md,
  },
  field: { gap: space.xs },
  fieldHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: space.xs,
    justifyContent: 'space-between',
  },
  input: {
    ...typography.body,
    borderCurve: 'continuous',
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.sm,
    paddingVertical: 10,
  },
  chipRow: { gap: space.xs, paddingRight: space.md },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: space.sm,
    paddingVertical: 7,
  },
  chipLabel: { fontWeight: '600' },
  calendar: { marginTop: space.xs },
  clock: { gap: space.xs, marginTop: space.xs },
  memberRow: { gap: space.sm, paddingRight: space.md },
  member: { alignItems: 'center', gap: space.xxs, width: 56 },
  avatar: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1.5,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 46,
  },
  toggleRow: { alignItems: 'center', flexDirection: 'row', gap: space.sm },
  toggleBody: { flex: 1 },
  switchTrack: {
    borderRadius: radius.full,
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 3,
    width: 48,
  },
  switchKnob: { backgroundColor: '#FFFFFF', borderRadius: radius.full, height: 22, width: 22 },
  switchOn: { alignSelf: 'flex-end' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  pressed: { opacity: 0.7 },
});
