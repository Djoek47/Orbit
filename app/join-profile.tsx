import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { AuthShell } from '@/components/orbit/auth-shell';
import { SharedDeviceWelcomeCard } from '@/components/orbit/device/shared-device-welcome-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { PersonalizeLookSheet } from '@/components/orbit/personalize-look-sheet';
import { Avatar } from '@/components/orbit/avatar';
import { setupSharedDeviceSession } from '@/lib/device/device-session';
import { sharedDeviceWelcome } from '@/lib/device/shared-device-welcome';
import { findSharedDeviceForMember } from '@/lib/household/shared-device';
import { normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import { memberIsOnSharedShell } from '@/lib/invites/route-invite-payload';
import { userFacingMessage } from '@/lib/auth/auth-errors';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function JoinProfileScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { completeProfileJoin, lookupProfileInvite, household } = useOrbit();
  const { c } = useOrbitColors();
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [lookOpen, setLookOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** When this CMX is also on a shared device shell, the welcome card is shown instead. */
  const [sharedShellChooser, setSharedShellChooser] = useState(false);
  const [chooserDismissed, setChooserDismissed] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [joiningDevice, setJoiningDevice] = useState(false);

  useEffect(() => {
    const parsed =
      parseInvitePayload(rawCode ?? '') ??
      (rawCode?.trim() ? normalizeInviteCode(rawCode) : null);
    if (!parsed) return;
    setCode(parsed);
    void lookupProfileInvite(parsed).then((result) => {
      if (!result) return;
      setMemberId(result.member.id);
      setName(result.member.name?.trim() ?? '');
      setAvatar(result.member.avatar ?? '');
      setHouseholdName(result.householdName);
      const onShell =
        Boolean(result.onSharedShell) ||
        memberIsOnSharedShell(result.member.id, household.members);
      setSharedShellChooser(onShell && !chooserDismissed);
    });
  }, [rawCode, lookupProfileInvite, household.members, chooserDismissed]);

  const welcome = sharedDeviceWelcome({
    householdId: household.id,
    householdName: householdName || household.householdName,
    shell: findSharedDeviceForMember(memberId ?? undefined, household.members),
    members: household.members,
  });

  const handleContinue = async () => {
    const parsed = parseInvitePayload(code) ?? (code.trim() ? normalizeInviteCode(code) : null);
    if (!parsed) {
      setError('Enter or scan a valid profile invite code.');
      return;
    }
    if (name.trim().length < 2) {
      setError('Add your name to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await completeProfileJoin({
        code: parsed,
        displayName: name.trim(),
        avatar: avatar.trim() || undefined,
      });
      router.replace('/' as never);
    } catch (err) {
      setError(userFacingMessage(err, 'Could not join with this invite.'));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Bind this device to the whole shell, then hand over to the face picker. The QR already
   * said this is a shared device, so nothing is asked — the card confirms and goes in.
   */
  const joinSharedDevice = async () => {
    const shell = findSharedDeviceForMember(memberId ?? undefined, household.members);
    const people = welcome.people.map((person) => person.id);
    setJoiningDevice(true);
    try {
      await setupSharedDeviceSession({
        profileMemberIds: people.length > 0 ? people : memberId ? [memberId] : [],
        deviceLabel: welcome.deviceLabel,
        sharedDeviceId: shell?.id ?? null,
        hostKind: 'shared-tablet',
      });
      router.replace('/select-profile' as never);
    } catch (err) {
      setJoiningDevice(false);
      setError(userFacingMessage(err, 'Could not join this device.'));
    }
  };

  if (sharedShellChooser && !chooserDismissed) {
    return (
      <AuthShell
        kicker="Shared device"
        title={`Welcome to ${welcome.householdName}`}
        subtitle="Check the code below matches your admin's screen, then go in.">
        <SharedDeviceWelcomeCard
          welcome={welcome}
          busy={joiningDevice}
          onJoin={() => void joinSharedDevice()}
          personalName={name.trim().split(/\s+/)[0] || undefined}
          onUseAsPersonal={() => {
            setChooserDismissed(true);
            setSharedShellChooser(false);
          }}
        />
        {error ? (
          <Text
            style={{ color: c.danger, fontSize: 14, marginTop: 12, textAlign: 'center' }}
            accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      kicker="Profile invite"
      title="Join the household"
      subtitle={
        householdName
          ? `You're joining ${householdName}. Pick your name and look — you'll connect right away.`
          : 'Pick your name and look. No email or payment needed.'
      }>
      <View style={{ gap: 14 }}>
        <OrbitInput
          label="Profile code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="CMX-EMMA"
        />
        <OrbitInput
          label="Your name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          placeholder="How should the household know you?"
        />
        <Pressable
          onPress={() => setLookOpen(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={name || 'You'} emoji={avatar || undefined} size="l" />
          <Text style={{ color: c.textMuted, fontSize: 14 }}>Choose profile picture</Text>
        </Pressable>
        {error ? (
          <Text style={{ color: c.danger, fontSize: 14 }} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <OrbitButton disabled={busy} loading={busy} onPress={() => void handleContinue()}>
          {busy ? 'Joining…' : 'Join household'}
        </OrbitButton>
      </View>
      <PersonalizeLookSheet
        visible={lookOpen}
        memberName={name.trim() || 'you'}
        currentAvatar={avatar || undefined}
        onDismiss={() => setLookOpen(false)}
        onSelect={(next) => setAvatar(next)}
      />
    </AuthShell>
  );
}
