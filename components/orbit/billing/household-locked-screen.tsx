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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
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
  const { c, glass, glassBorder } = useOrbitColors();
  const [checking, setChecking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const closeThen = (fn: () => void) => {
    setMenuOpen(false);
    // Let the sheet finish closing first — navigating under a closing Modal freezes iOS.
    setTimeout(fn, 280);
  };

  const rows: { key: string; icon: keyof typeof MaterialIcons.glyphMap; label: string; onPress: () => void }[] = [
    ...(canSwitchProfile
      ? [{ key: 'switch', icon: 'people' as const, label: 'Switch profile', onPress: () => closeThen(() => router.replace('/select-profile' as never)) }]
      : []),
    { key: 'help', icon: 'support-agent', label: 'Get help', onPress: () => closeThen(() => router.push('/support' as never)) },
    { key: 'terms', icon: 'description', label: 'Terms of Use', onPress: () => void Linking.openURL(CHOREMAXX_LEGAL.termsUrl) },
    { key: 'privacy', icon: 'privacy-tip', label: 'Privacy Policy', onPress: () => void Linking.openURL(CHOREMAXX_LEGAL.privacyUrl) },
    { key: 'signout', icon: 'logout', label: 'Sign out', onPress: () => closeThen(onSignOut) },
  ];

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: c.background, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
      ]}>
      <LinearGradient
        colors={[`${c.primary}26`, 'transparent']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Pressable
        onPress={() => setMenuOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Account and settings"
        style={({ pressed }) => [
          styles.accountChip,
          { top: insets.top + 10, backgroundColor: glass(0.06), borderColor: glassBorder(0.16), opacity: pressed ? 0.7 : 1 },
        ]}>
        <MaterialIcons name="settings" size={18} color={c.primary} />
        <Text style={[styles.accountText, { color: c.text }]}>Account</Text>
      </Pressable>

      <View style={styles.body}>
        <Animated.View entering={FadeIn.duration(400)} style={[styles.lockWell, { backgroundColor: glass(0.06), borderColor: glassBorder(0.14) }]}>
          <ChoremaxxBadge size="lg" />
          <View style={[styles.lockBadge, { backgroundColor: c.background, borderColor: glassBorder(0.2) }]}>
            <MaterialIcons name="lock" size={16} color={c.primary} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(420)} style={styles.copy}>
          <Text style={[styles.kicker, { color: c.primary }]}>{house}</Text>
          <Text style={[styles.title, { color: c.text }]}>ChoreMaxx is paused</Text>
          <Text style={[styles.body1, { color: c.textMuted }]}>
            {house}&apos;s Premium isn&apos;t active, so this device can&apos;t open right now.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(140).duration(420)}
          style={[styles.card, { backgroundColor: glass(0.05), borderColor: glassBorder(0.12) }]}>
          <MaterialIcons name="admin-panel-settings" size={22} color={c.primary} />
          <Text style={[styles.cardText, { color: c.text }]}>
            Only {who} can renew Premium, from their own phone. As soon as they do, this device
            opens again by itself — everything is saved.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(420)} style={styles.actions}>
          <OrbitButton onPress={() => void check()} loading={checking} disabled={checking}>
            Check again
          </OrbitButton>
          {canSwitchProfile ? (
            <Pressable
              onPress={() => router.replace('/select-profile' as never)}
              hitSlop={12}
              accessibilityRole="button"
              style={styles.linkWrap}>
              <Text style={[styles.link, { color: c.textMuted }]}>Switch profile</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </View>

      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setMenuOpen(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: c.background, borderColor: glassBorder(0.12), paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.grabber, { backgroundColor: glassBorder(0.3) }]} />
          <Text style={[styles.sheetTitle, { color: c.text }]}>Account</Text>
          {rows.map((row) => (
            <Pressable
              key={row.key}
              onPress={row.onPress}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, { backgroundColor: glass(0.05), borderColor: glassBorder(0.1), opacity: pressed ? 0.7 : 1 }]}>
              <MaterialIcons name={row.icon} size={20} color={c.textMuted} />
              <Text style={[styles.rowText, { color: c.text }]}>{row.label}</Text>
              <MaterialIcons name="chevron-right" size={20} color={c.textSubtle} />
            </Pressable>
          ))}
        </View>
      </Modal>
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
  kicker: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  lockWell: { alignItems: 'center', borderRadius: 36, borderWidth: 1, height: 112, justifyContent: 'center', width: 112 },
  lockBadge: { alignItems: 'center', borderRadius: 16, borderWidth: 1, bottom: -6, height: 32, justifyContent: 'center', position: 'absolute', right: -6, width: 32 },
  card: { alignItems: 'flex-start', alignSelf: 'stretch', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 16 },
  cardText: { flex: 1, fontSize: 15, lineHeight: 21 },
  accountChip: { alignItems: 'center', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 40, paddingHorizontal: 14, position: 'absolute', right: space.lg, zIndex: 2 },
  accountText: { fontSize: 15, fontWeight: '700' },
  linkWrap: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  scrim: { backgroundColor: 'rgba(0,0,0,0.45)', flex: 1 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, gap: 10, paddingHorizontal: 20, paddingTop: 10 },
  grabber: { alignSelf: 'center', borderRadius: 3, height: 5, marginBottom: 6, width: 40 },
  sheetTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  row: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 54, paddingHorizontal: 14 },
  rowText: { flex: 1, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  body1: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 16 },
  links: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center' },
  link: { fontSize: 14, fontWeight: '700' },
  dot: { fontSize: 14 },
});
