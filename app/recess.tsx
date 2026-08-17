/**
 * Recess admin screen — Revision D §3.4.
 * Admin-only. Everyone shortcut writes one period per member.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { VOCAB } from '@/constants/vocabulary';
import { space, typography } from '@/constants/orbit-theme';
import {
  createRecessForEveryone,
  createRecessPeriod,
  endRecessPeriod,
  isOnRecess,
  type RecessPeriod,
} from '@/lib/recess/recess-engine';
import { formatLocalDate } from '@/lib/streaks/local-date';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function RecessScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const { household, currentMember, permissions } = useOrbit();
  const [periods, setPeriods] = useState<RecessPeriod[]>([]);
  const today = formatLocalDate(new Date(), household.timezone);

  const members = useMemo(
    () => household.members.filter((m) => m.role !== 'shared-device' && m.status !== 'inactive'),
    [household.members]
  );

  if (!permissions.canManageHousehold) {
    return (
      <View style={[styles.shell, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <Text style={[typography.body, { color: c.text, margin: space.lg }]}>
          Only admins can manage {VOCAB.recess}.
        </Text>
      </View>
    );
  }

  const toggleMember = (memberId: string, on: boolean) => {
    if (!currentMember) return;
    if (on) {
      const result = createRecessPeriod({
        memberId,
        startDate: today,
        endDate: null,
        createdBy: currentMember.id,
        createdAt: new Date().toISOString(),
        todayLocal: today,
        isAdmin: true,
        existing: periods,
      });
      if ('error' in result) {
        Alert.alert(VOCAB.recess, result.error.message);
        return;
      }
      setPeriods(result.periods);
    } else {
      const open = periods.find((p) => p.memberId === memberId && (p.endDate == null || p.endDate >= today));
      if (open) setPeriods(endRecessPeriod(periods, open.id, today));
    }
  };

  const everyone = () => {
    if (!currentMember) return;
    const result = createRecessForEveryone({
      memberIds: members.map((m) => m.id),
      startDate: today,
      endDate: null,
      createdBy: currentMember.id,
      createdAt: new Date().toISOString(),
      todayLocal: today,
      isAdmin: true,
      existing: periods.filter((p) => p.endDate != null && p.endDate < today),
    });
    if ('error' in result) {
      Alert.alert(VOCAB.recess, result.error.message);
      return;
    }
    setPeriods(result.periods);
  };

  return (
    <View style={[styles.shell, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.subheadline, { color: c.accent }]}>‹ Settings</Text>
        </Pressable>
        <Text style={[typography.title3, { color: c.text }]}>{VOCAB.recess}</Text>
        <View style={{ width: 64 }} />
      </View>

      <PersistentScrollView contentContainerStyle={styles.content}>
        <Text style={[typography.body, { color: c.textSoft }]}>
          Pause tasks and freeze streaks while someone is away. Nothing is queued.
        </Text>

        <Pressable
          onPress={everyone}
          style={[styles.everyone, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}
        >
          <Text style={[typography.subheadline, { color: c.accent, fontWeight: '700' }]}>
            Everyone
          </Text>
          <Text style={[typography.caption1, { color: c.textMuted }]}>Family holiday shortcut</Text>
        </Pressable>

        {members.map((m) => {
          const on = isOnRecess(periods, m.id, today);
          return (
            <View
              key={m.id}
              style={[styles.row, { backgroundColor: glass(0.04), borderColor: glassBorder(0.08) }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: c.text, fontWeight: '600' }]}>{m.name}</Text>
                <Text style={[typography.caption1, { color: c.textMuted }]}>
                  {on ? VOCAB.onRecess : 'Active'}
                </Text>
              </View>
              <Switch value={on} onValueChange={(v) => toggleMember(m.id, v)} />
            </View>
          );
        })}
      </PersistentScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  content: {
    gap: space.md,
    paddingBottom: 40,
    paddingHorizontal: space.lg,
  },
  everyone: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
    padding: space.md,
  },
  row: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
