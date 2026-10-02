import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { GlassCard } from '@/components/orbit/glass-card';
import { orbitColors, radius, space, typography } from '@/constants/orbit-theme';
import { onTourEvent } from '@/lib/tour/tour-events';
import type { ChecklistItemId } from '@/lib/tour/tour-types';
import { showRewards } from '@/lib/tour/tour-conditions';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import {
  sidekickSetupRoute,
  sidekickSetupTarget,
} from '@/lib/household/sidekick-setup-target';
import { trackAnalytics } from '@/lib/analytics';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useMajordomoName } from '@/lib/ai/use-majordomo-name';
import { useOrbit } from '@/store/orbit-store';

const PROOF_SEEN_KEY = 'choremaxx.proofWalkthroughSeen.v1';

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
  const majordomoName = useMajordomoName();
  const analyticsContext = {
    householdId: household.id,
    userId: currentMember?.userId ?? currentMember?.id,
  };
  const { c } = useOrbitColors();
  const [tick, setTick] = useState(0);

  const [poppinsDone, setPoppinsDone] = useState(false);
  // Seen-once, kept on the device: the walkthrough creates nothing, so there's nothing
  // in the household to read it back from.
  const [proofSeen, setProofSeen] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(PROOF_SEEN_KEY).then((value) => {
      if (value === '1') setProofSeen(true);
    });
  }, []);

  const markProofWalkthroughSeen = () => {
    setProofSeen(true);
    void AsyncStorage.setItem(PROOF_SEEN_KEY, '1').catch(() => undefined);
  };

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
        label: `Ask ${majordomoName} to do something`,
        done: poppinsDone,
        onPress: () => router.push('/(tabs)/poppins' as never),
      },
      // Straight to Members with Add someone already open — this used to land on the
      // Settings root and leave you to find it.
      {
        id: 'add_sidekick',
        label: 'Add a Sidekick',
        done: hasChildBeyondOwner,
        onPress: () => router.push('/settings?section=members&add=1' as never),
      },
      {
        id: 'see_proof',
        label: 'See how photo proof works',
        done: proofSeen,
        onPress: () => {
          markProofWalkthroughSeen();
          router.push('/tour/proof-walkthrough?kind=chore' as never);
        },
      },
      // One Sidekick waiting for a device → their QR opens straight away. Several → the
      // roster, to pick. None yet → Add someone first.
      {
        id: 'setup_device',
        label: 'Set up a device for a Sidekick',
        done: hasDevice,
        onPress: () =>
          router.push(sidekickSetupRoute(sidekickSetupTarget(household.members)) as never),
      }
    );

    return list;
  }, [household, majordomoName, tick, poppinsDone, proofSeen]);

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length && items.length > 0;

  const allDoneSeen = useRef(false);
  useEffect(() => {
    if (allDone && !allDoneSeen.current) {
      allDoneSeen.current = true;
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
            <ChecklistRow key={item.id} item={item} />
          ))}
        </View>
      )}
    </GlassCard>
  );
}

/** One line of the checklist. It dips under the finger so a tap feels like it landed. */
function ChecklistRow({ item }: { item: Item }) {
  const { c } = useOrbitColors();
  const press = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.get() * 0.025 }, { translateX: press.get() * 4 }],
    opacity: 1 - press.get() * 0.25,
  }));

  return (
    <Animated.View style={anim}>
      <Pressable
        onPress={item.onPress}
        onPressIn={() => press.set(withTiming(1, { duration: 90 }))}
        onPressOut={() => press.set(withSpring(0, { damping: 16, stiffness: 320 }))}
        style={styles.row}
        accessibilityRole="button"
        accessibilityState={{ checked: item.done }}>
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
        {item.done ? null : (
          <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
        )}
      </Pressable>
    </Animated.View>
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
