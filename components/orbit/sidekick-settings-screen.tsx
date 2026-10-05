import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
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
import { markNeedsProfilePick } from '@/lib/device/device-session';
import { SigningOutOverlay } from '@/components/orbit/signing-out-overlay';
import { isSignOutInFlight, signOutAndLeave } from '@/lib/auth/sign-out-and-leave';
import { closeSettingsModal } from '@/lib/navigation/close-settings-modal';
import { memberSettingsModel } from '@/lib/settings/member-settings-model';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';
import { orbitAlert } from '@/components/orbit/orbit-alert';

/**
 * Settings for everyone who isn't an admin — one screen, three shapes.
 *
 *   a Sidekick's own phone      · their look, their house rules, their way out
 *   a person on a shared device · the same, plus the device it lives on and who else is on it
 *   the shared device itself    · before anyone taps a face
 *
 * What differs between them is decided in lib/settings/member-settings-model (tested), so the
 * three never drift apart. Full household admin settings stay on adult profiles.
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
  const [signingOut, setSigningOut] = useState(false);

  const model = useMemo(
    () => memberSettingsModel({ member: currentMember, members: household.members }),
    [currentMember, household.members]
  );

  if (!currentMember || !model) return null;

  const runSignOut = () => {
    if (signingOut || isSignOutInFlight()) return;
    setPersonalizeOpen(false);
    setSigningOut(true);
    void signOutAndLeave(signOut).finally(() => setSigningOut(false));
  };

  const closeSidekickSettings = () => {
    setPersonalizeOpen(false);
    closeSettingsModal();
  };

  return (
    <>
      <View style={[styles.shell, { paddingTop: insets.top, backgroundColor: orbitPalette.backgroundSoft }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <SigningOutOverlay visible={signingOut} />

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
          <Pressable
            style={[styles.close, { backgroundColor: glass(0.08) }]}
            onPress={closeSidekickSettings}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
            hitSlop={12}>
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
                {model.kind === 'shared-device'
                  ? model.sharedWith.length
                    ? `Shared by ${model.sharedWith.join(', ')}`
                    : 'Nobody is set up on this device yet'
                  : `${currentMember.xp} XP · ${currentMember.streak ?? 0}-day streak`}
              </Text>
              <Text style={[styles.caption, { color: accentTheme.primary, fontWeight: '600' }]}>
                {model.kind === 'shared-device' ? 'Tap to change the look' : 'Tap to change your look'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
          </Pressable>

          {/* Handing the device on is the thing people reach for most, so it leads. */}
          {model.canSwitchProfiles ? (
            <SettingsGroup header={model.deviceName ?? 'This device'}>
              <SettingsNavRow
                icon="switch-account"
                iconColor="#A78BFA"
                label="Switch who's on"
                subtitle={
                  model.sharedWith.length
                    ? `Hand it to ${model.sharedWith.join(', ')}`
                    : 'Pick a face to carry on'
                }
                last
                onPress={() => {
                  void markNeedsProfilePick().then(() => router.replace('/select-profile' as never));
                }}
              />
            </SettingsGroup>
          ) : null}

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
              last
              onPress={() => router.push('/notifications' as never)}
            />
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
              {model.lookNote}
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
                orbitAlert('Privacy & legal', 'Open Choremaxx legal pages', [
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
            accessibilityRole="button"
            accessibilityLabel={model.signOut.label}
            accessibilityState={{ busy: signingOut, disabled: signingOut }}
            disabled={signingOut}
            style={[
              styles.signOutBtn,
              { backgroundColor: glass(0.06), opacity: signingOut ? 0.6 : 1 },
            ]}
            onPress={() => {
              if (signingOut || isSignOutInFlight()) return;
              orbitAlert(model.signOut.title, model.signOut.body, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: model.signOut.confirm,
                  style: 'destructive',
                  // orbitAlert defers this until the Modal has fully dismissed.
                  onPress: runSignOut,
                },
              ]);
            }}>
            <Text style={[styles.signOutText, { color: orbitPalette.text }]}>
              {signingOut ? 'Signing out…' : model.signOut.label}
            </Text>
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
