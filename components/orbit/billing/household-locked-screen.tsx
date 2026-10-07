/**
 * What a Sidekick phone or shared tablet shows when the household's Premium has ended.
 *
 *   ┌──────────────────────────────────┐
 *   │          (choremaxx badge)       │
 *   │    ChoreMaxx is paused for now   │
 *   │   The Mugabos' Premium ended.    │
 *   │  Ask Nero to renew it, and this  │
 *   │  device opens again by itself.   │
 *   │        [ Check again ]           │
 *   │     Switch profile · Sign out    │
 *   └──────────────────────────────────┘
 *
 * There is no purchase button here, by design. This screen is seen by children; a child must
 * never be shown a way to buy a subscription. The admin renews on their own phone, the
 * household row updates, and the next check here lets everyone back in.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { space } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';

type Props = {
  householdName: string;
  members: HouseholdMember[];
  /** Pull the household again — the admin may have just renewed. */
  onCheckAgain: () => Promise<void> | void;
  onSignOut: () => void;
  /** Shown only on a shared device, where the people taking turns may want a different face. */
  canSwitchProfile?: boolean;
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

export function HouseholdLockedScreen({
  householdName,
  members,
  onCheckAgain,
  onSignOut,
  canSwitchProfile,
}: Props) {
  const insets = useSafeAreaInsets();
  const { c } = useOrbitColors();
  const [checking, setChecking] = useState(false);

  // Name the person who can actually fix it. "Ask an admin" leaves a child guessing who.
  const owner =
    members.find((m) => m.role === 'owner' && m.status === 'active') ??
    members.find((m) => m.role === 'admin' && m.status === 'active');
  const who = owner ? firstName(owner.name) : 'a grown-up';
  const house = householdName.trim() || 'Your household';

  const check = async () => {
    setChecking(true);
    try {
      await onCheckAgain();
    } finally {
      setChecking(false);
    }
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: c.background, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
      ]}>
      <View style={styles.body}>
        <Animated.View entering={FadeIn.duration(400)}>
          <ChoremaxxBadge size="lg" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(420)} style={styles.copy}>
          <Text style={[styles.title, { color: c.text }]}>ChoreMaxx is paused for now</Text>
          <Text style={[styles.body1, { color: c.textMuted }]}>
            {house}&apos;s Premium has ended.
          </Text>
          <Text style={[styles.body1, { color: c.textMuted }]}>
            Ask {who} to renew it, and this device opens again by itself.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(420)} style={styles.actions}>
          <OrbitButton onPress={() => void check()} loading={checking} disabled={checking}>
            Check again
          </OrbitButton>

          <View style={styles.links}>
            {canSwitchProfile ? (
              <>
                <Pressable
                  onPress={() => router.replace('/select-profile' as never)}
                  hitSlop={12}
                  accessibilityRole="button">
                  <Text style={[styles.link, { color: c.textMuted }]}>Switch profile</Text>
                </Pressable>
                <Text style={[styles.dot, { color: c.textSubtle }]}>·</Text>
              </>
            ) : null}
            <Pressable onPress={onSignOut} hitSlop={12} accessibilityRole="button">
              <Text style={[styles.link, { color: c.textMuted }]}>Sign out</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: {
    alignItems: 'center',
    flex: 1,
    gap: space.xl,
    justifyContent: 'center',
    // Wide screens (iPad) keep the message at a readable measure instead of spanning the glass.
    alignSelf: 'center',
    maxWidth: 440,
    paddingHorizontal: space.xl,
    width: '100%',
  },
  copy: { alignItems: 'center', gap: 10 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  body1: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 16 },
  links: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center' },
  link: { fontSize: 14, fontWeight: '700' },
  dot: { fontSize: 14 },
});
