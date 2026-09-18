import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/orbit/avatar';
import { BrandLegalFooter } from '@/components/orbit/brand-legal-footer';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { PaletteWheel } from '@/components/orbit/palette-wheel';
import { PersonalizeLookSheet } from '@/components/orbit/personalize-look-sheet';
import { SegmentedControl } from '@/components/orbit/segmented-control';
import { SettingsGroup, SettingsNavRow } from '@/components/orbit/settings/grouped';
import { BUILD_INFO } from '@/constants/build-info';
import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
import { VOCAB } from '@/constants/vocabulary';
import { radius, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { findSharedDeviceForMember } from '@/lib/household/shared-device';
import { markNeedsProfilePick } from '@/lib/device/device-session';
import { resetToGetStarted } from '@/lib/navigation/reset-to-get-started';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

/**
 * Sidekick-safe Settings — profile, look, house rules, notifications.
 * Full household admin settings stay on adult profiles.
 */
export function SidekickSettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    accentTheme,
    appearanceMode,
    currentMember,
    household,
    orbitPalette,
    paletteId,
    signOut,
    updateAppearanceMode,
    updateMemberAvatar,
    updatePalette,
  } = useOrbit();
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const [personalizeOpen, setPersonalizeOpen] = useState(false);

  const sharedDevice = useMemo(
    () => findSharedDeviceForMember(currentMember?.id, household.members),
    [currentMember?.id, household.members]
  );

  if (!currentMember) return null;

  return (
    <>
      <View style={[styles.shell, { paddingTop: insets.top, backgroundColor: orbitPalette.backgroundSoft }]}>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: glassBorder(0.2) }]} />
        </View>

        <View style={styles.header}>
          <View style={styles.titleRow}>
            <LinearGradient colors={[accentTheme.primary, accentTheme.secondary]} style={styles.zapBox}>
              <MaterialIcons name="bolt" size={16} color={orbitPalette.ink} />
            </LinearGradient>
            <Text style={[styles.title, { color: orbitPalette.text }]}>Settings</Text>
          </View>
          <Pressable style={[styles.close, { backgroundColor: glass(0.08) }]} onPress={() => router.back()}>
            <MaterialIcons name="close" size={16} color={orbitPalette.textMuted} />
          </Pressable>
        </View>

        <KeyboardScreen offset={12} style={styles.scroll} contentContainerStyle={styles.content}>
          <Pressable
            onPress={() => setPersonalizeOpen(true)}
            style={[
              styles.identity,
              {
                backgroundColor: glassFill(isDark),
                borderColor: glassBorder(0.08),
              },
            ]}>
            <Avatar
              name={currentMember.name}
              emoji={memberDisplayEmoji(currentMember)}
              imageUri={isAvatarImageUri(currentMember.avatar) ? currentMember.avatar : undefined}
              size="m"
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.identityName, { color: c.text }]}>{currentMember.name}</Text>
              <Text style={[styles.caption, { color: c.textMuted }]}>
                {currentMember.xp} XP · {currentMember.streak ?? 0}-day streak
              </Text>
              <Text style={[styles.caption, { color: accentTheme.primary, fontWeight: '600' }]}>
                Tap to change your look
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
          </Pressable>

          <SettingsGroup header="Your space">
            <SettingsNavRow
              icon="menu-book"
              iconColor={accentTheme.primary}
              label={VOCAB.houseRules}
              subtitle="How chores, streaks, and rewards work"
              onPress={() => router.push('/house-rules' as never)}
            />
            <SettingsNavRow
              icon="inbox"
              iconColor="#38BDF8"
              label="Inbox"
              subtitle="Household alerts and Poppins activity"
              onPress={() => router.push('/notifications' as never)}
            />
            {sharedDevice ? (
              <SettingsNavRow
                icon="switch-account"
                iconColor="#A78BFA"
                label="Switch who's on"
                subtitle={`On ${sharedDevice.name}`}
                last
                onPress={() => {
                  void markNeedsProfilePick().then(() => router.push('/select-profile' as never));
                }}
              />
            ) : (
              <SettingsNavRow
                icon="lock"
                iconColor="#F59E0B"
                label="Lock app"
                subtitle="Splash screen before you jump back in"
                last
                onPress={() => {
                  void markNeedsProfilePick().then(() => router.replace('/select-profile' as never));
                }}
              />
            )}
          </SettingsGroup>

          <View
            style={[
              styles.lookCard,
              {
                backgroundColor: glassFill(isDark),
                borderColor: glassBorder(0.08),
              },
            ]}>
            <Text style={[styles.sectionTitle, { color: c.textMuted }]}>YOUR LOOK</Text>
            <Text style={[styles.caption, { color: c.textMuted, marginBottom: 10 }]}>
              Colors follow you on this device — Day and Night included.
            </Text>
            <PaletteWheel value={paletteId} onChange={updatePalette} label="Palette" />
            <View style={{ marginTop: 14 }}>
              <SegmentedControl
                label="Day / Night"
                value={appearanceMode}
                onChange={(mode) => updateAppearanceMode(mode)}
                options={[
                  { value: 'light', label: 'Day' },
                  { value: 'dark', label: 'Night' },
                  { value: 'system', label: 'System' },
                ]}
              />
            </View>
          </View>

          <SettingsGroup header="Choremaxx">
            <SettingsNavRow
              icon="shield"
              iconColor="#34D399"
              label="Privacy & legal"
              last
              onPress={() =>
                Alert.alert('Privacy & legal', 'Open Choremaxx legal pages', [
                  {
                    text: 'Privacy Policy',
                    onPress: () => void Linking.openURL(CHOREMAXX_LEGAL.privacyUrl),
                  },
                  {
                    text: 'Terms of Service',
                    onPress: () => void Linking.openURL(CHOREMAXX_LEGAL.termsUrl),
                  },
                  {
                    text: 'Contact support',
                    onPress: () => void Linking.openURL(`mailto:${CHOREMAXX_LEGAL.supportEmail}`),
                  },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            />
          </SettingsGroup>

          <Pressable
            style={[styles.signOutBtn, { backgroundColor: glass(0.06) }]}
            onPress={() => {
              Alert.alert(
                'Sign out?',
                'You will show as disconnected on the household roster. Tap Continue as you on the welcome screen to come back — your streak and tasks stay saved.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign out',
                    style: 'destructive',
                    onPress: () => {
                      void (async () => {
                        try {
                          await signOut();
                        } catch (error) {
                          console.warn('sidekickSettings.signOut', error);
                        } finally {
                          resetToGetStarted();
                        }
                      })();
                    },
                  },
                ]
              );
            }}>
            <Text style={[styles.signOutText, { color: orbitPalette.text }]}>Sign Out</Text>
          </Pressable>

          <Text style={[styles.caption, { color: c.textSubtle, textAlign: 'center', marginBottom: 8 }]}>
            {BUILD_INFO.label}
          </Text>
          <BrandLegalFooter />
        </KeyboardScreen>
      </View>

      <PersonalizeLookSheet
        visible={personalizeOpen}
        memberName={currentMember.name}
        currentAvatar={currentMember.avatar}
        onDismiss={() => setPersonalizeOpen(false)}
        onSelect={async (avatar) => {
          await updateMemberAvatar(currentMember.id, avatar);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  handleRow: { alignItems: 'center', paddingVertical: 8 },
  handle: { borderRadius: 999, height: 4, width: 36 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  zapBox: {
    alignItems: 'center',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  close: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  scroll: { flex: 1 },
  content: { gap: 16, paddingBottom: 40, paddingHorizontal: space.lg },
  identity: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
  },
  identityName: { fontSize: 17, fontWeight: '700' },
  caption: { fontSize: 13, lineHeight: 18 },
  lookCard: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  signOutBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    paddingVertical: 14,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
