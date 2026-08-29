import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { StatusPill } from '@/components/orbit/status-pill';
import { radius, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdEvent } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

const CATEGORIES: HouseholdEvent['category'][] = ['School', 'Activity', 'Appointment', 'Family', 'Routine'];

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accentTheme, deleteEvent, household, orbitPalette, remindAboutEvent, updateEvent } =
    useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const event = household.events.find((item) => item.id === id);
  const memberNames = useMemo(
    () =>
      household.members
        .filter((member) => member.status === 'active' && member.role !== 'shared-device')
        .map((member) => member.name),
    [household.members]
  );

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
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
            backgroundColor: orbitPalette.backgroundSoft,
          },
        ]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={[styles.missingTitle, { color: c.text }]}>Event not found</Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.secondaryBtn, { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) }]}>
          <Text style={[styles.secondaryText, { color: accentTheme.primary }]}>Back</Text>
        </Pressable>
      </View>
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
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, backgroundColor: orbitPalette.backgroundSoft },
      ]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.handle, { backgroundColor: glass(0.18) }]} />
      <View style={[styles.header, { borderBottomColor: glassBorder(0.08) }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: glass(0.06) }]}
          hitSlop={8}
          accessibilityLabel="Close">
          <MaterialIcons name="close" size={18} color={c.textMuted} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.kicker, { color: c.textMuted }]}>Calendar</Text>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
            {editing ? 'Edit event' : 'Event'}
          </Text>
        </View>
        {!editing ? (
          <Pressable
            onPress={() => setEditing(true)}
            style={[styles.iconBtn, { backgroundColor: glass(0.06) }]}
            hitSlop={8}
            accessibilityLabel="Edit event">
            <MaterialIcons name="edit" size={16} color={accentTheme.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {!editing ? (
          <Text style={[styles.heroTitle, { color: c.text }]}>{event.title}</Text>
        ) : null}
        <StatusPill label={event.category} tone="cyan" />

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
            <ChoiceRow
              label="Responsible"
              options={memberNames}
              value={responsible}
              onChange={setResponsible}
            />
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
            <Pressable
              disabled={busy || title.trim().length < 2}
              onPress={() => void handleSave()}
              style={styles.ctaWrap}>
              <LinearGradient
                colors={[accentTheme.primary, accentTheme.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cta, { opacity: busy || title.trim().length < 2 ? 0.45 : 1 }]}>
                <Text style={[styles.ctaText, { color: c.ink }]}>
                  {busy ? 'Saving…' : 'Save changes'}
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={() => setEditing(false)}
              style={[styles.secondaryBtn, { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) }]}>
              <Text style={[styles.secondaryText, { color: accentTheme.primary }]}>Cancel edit</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => setEditing(true)}
              style={[
                styles.assignBtn,
                { backgroundColor: accentTheme.primary },
              ]}>
              <Text style={[typography.headline, { color: c.ink, fontWeight: '700' }]}>
                Edit event
              </Text>
            </Pressable>
            <Pressable
              onPress={() => remindAboutEvent(event.id)}
              style={[styles.secondaryBtn, { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) }]}>
              <Text style={[styles.secondaryText, { color: accentTheme.primary }]}>
                Notify household
              </Text>
            </Pressable>
            <Pressable
              onPress={handleDelete}
              style={[
                styles.secondaryBtn,
                { borderColor: 'rgba(248,113,113,0.35)', backgroundColor: 'rgba(248,113,113,0.08)' },
              ]}>
              <Text style={styles.dangerText}>Delete event</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { c } = useOrbitColors();
  return (
    <View style={styles.row}>
      <Text style={[typography.footnote, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  handle: {
    alignSelf: 'center',
    borderRadius: 99,
    height: 4,
    marginBottom: 8,
    width: 36,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerCopy: { flex: 1 },
  iconBtn: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { fontSize: 16, fontWeight: '700' },
  content: { gap: space.md, paddingHorizontal: 16, paddingTop: 16 },
  heroTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  card: { gap: space.md },
  row: { gap: 4 },
  value: { fontSize: 16, fontWeight: '700' },
  ctaWrap: { borderRadius: 18, overflow: 'hidden' },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  ctaText: { fontSize: 14, fontWeight: '800' },
  assignBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    paddingVertical: 16,
  },
  secondaryBtn: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 13,
  },
  secondaryText: { fontSize: 14, fontWeight: '700' },
  dangerText: { color: '#F87171', fontSize: 14, fontWeight: '700' },
  missingTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
});
