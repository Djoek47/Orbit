import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { GlassCard } from '@/components/orbit/glass-card';
import { orbitColors, radius, space, typography } from '@/constants/orbit-theme';
import { onTourEvent } from '@/lib/tour/tour-events';
import type { ChecklistItemId } from '@/lib/tour/tour-types';
import { showRewards } from '@/lib/tour/tour-conditions';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import { trackAnalytics } from '@/lib/analytics';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

type Item = {
  id: ChecklistItemId;
  label: string;
  done: boolean;
  onPress: () => void;
};

type Props = {
  hidden: boolean;
  onHide: () => void;
  onAllDoneSeen: () => void;
};

export function GettingStartedCard({ hidden, onHide, onAllDoneSeen }: Props) {
  const { household, currentMember, permissions } = useOrbit();
  const analyticsContext = {
    householdId: household.id,
    userId: currentMember?.userId ?? currentMember?.id,
  };
  const { c } = useOrbitColors();
  const [tick, setTick] = useState(0);

  const [poppinsDone, setPoppinsDone] = useState(false);

  useEffect(() => {
    const offs = [
      onTourEvent('task_created', () => setTick((n) => n + 1)),
      onTourEvent('homework_created', () => setTick((n) => n + 1)),
      onTourEvent('grocery_added', () => setTick((n) => n + 1)),
      onTourEvent('event_created', () => setTick((n) => n + 1)),
      onTourEvent('reward_created', () => setTick((n) => n + 1)),
      onTourEvent('poppins_act_committed', () => {
        setPoppinsDone(true);
        setTick((n) => n + 1);
      }),
      onTourEvent('member_created', () => setTick((n) => n + 1)),
      onTourEvent('shared_device_set_up', () => setTick((n) => n + 1)),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const items = useMemo((): Item[] => {
    void tick;
    const kids = household.members.filter(
      (m) => m.role === 'child' && m.status === 'active' && !isSharedDeviceRole(m.role)
    );
    const hasChildBeyondOwner = kids.length > 0;
    const hasDevice =
      household.members.some((m) => m.role === 'shared-device') ||
      kids.some((m) => Boolean(m.profileInviteCode));

    const choresDone = household.tasks.some(
      (t) => t.category !== 'homework_education' && !/homework/i.test(t.category ?? '')
    );
    const homeworkDone = household.tasks.some(
      (t) => t.category === 'homework_education' || /homework/i.test(t.category ?? '')
    );
    const groceryDone = (household.groceries?.length ?? 0) > 0;
    const eventDone = (household.events?.length ?? 0) > 0;
    const rewardDone = (household.rewards?.length ?? 0) > 0;

    const list: Item[] = [
      {
        id: 'assign_chore',
        label: 'Assign a chore',
        done: choresDone,
        onPress: () => router.push('/assign-task' as never),
      },
      {
        id: 'assign_homework',
        label: 'Assign homework',
        done: homeworkDone,
        onPress: () => router.push('/assign-homework' as never),
      },
      {
        id: 'add_grocery',
        label: 'Add a grocery',
        done: groceryDone,
        onPress: () => router.push('/(tabs)/groceries' as never),
      },
      {
        id: 'calendar_event',
        label: 'Put something on the calendar',
        done: eventDone,
        onPress: () => router.push('/(tabs)/plan' as never),
      },
    ];

    if (showRewards(household)) {
      list.push({
        id: 'create_reward',
        label: 'Create a reward',
        done: rewardDone,
        onPress: () => router.push('/create-reward' as never),
      });
    }

    list.push(
      {
        id: 'ask_poppins',
        label: 'Ask Poppins to do something',
        done: poppinsDone,
        onPress: () => router.push('/(tabs)/poppins' as never),
      },
      {
        id: 'add_sidekick',
        label: 'Add a Sidekick',
        done: hasChildBeyondOwner,
        onPress: () => router.push('/settings' as never),
      },
      {
        id: 'setup_device',
        label: 'Set up a device for a Sidekick',
        done: hasDevice,
        onPress: () => router.push('/settings' as never),
      }
    );

    return list;
  }, [household, tick, poppinsDone]);

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length && items.length > 0;

  useEffect(() => {
    if (allDone) {
      onAllDoneSeen();
    }
  }, [allDone, onAllDoneSeen]);

  useEffect(() => {
    for (const item of items) {
      if (item.done) {
        void trackAnalytics('checklist.item_done', { item: item.id }, analyticsContext);
      }
    }
    // Only fire when tick changes (new events), not on every render of done items.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  if (hidden) return null;
  if (!permissions.canManageHousehold) return null;
  if (currentMember?.role === 'child') return null;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.title3, { color: c.text }]}>Getting started</Text>
          <Text style={[typography.caption1, { color: c.textSubtle }]}>
            {doneCount} of {items.length} done
          </Text>
        </View>
        <Pressable
          onPress={() => {
            void trackAnalytics('checklist.hidden', {}, analyticsContext);
            onHide();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Hide checklist"
          style={styles.close}>
          <MaterialIcons name="close" size={18} color={c.textSubtle} />
        </Pressable>
      </View>
      {allDone ? (
        <Text style={[typography.body, { color: c.textMuted }]}>
          You are set. Hide this checklist anytime.
        </Text>
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={item.onPress}
              style={styles.row}
              accessibilityRole="button">
              <MaterialIcons
                name={item.done ? 'check-circle' : 'radio-button-unchecked'}
                size={20}
                color={item.done ? orbitColors.success ?? '#34D399' : c.textSubtle}
              />
              <Text
                style={[
                  typography.subheadline,
                  {
                    color: item.done ? c.textSubtle : c.text,
                    textDecorationLine: item.done ? 'line-through' : 'none',
                    flex: 1,
                  },
                ]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
  },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  close: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  list: {
    gap: 10,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 44,
  },
});
