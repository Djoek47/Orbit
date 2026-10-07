import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import {
  findSharedDeviceForMember,
  resolveSharedDevicePeople,
} from '@/lib/household/shared-device';
import { normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import { userFacingMessage } from '@/lib/auth/auth-errors';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';

export default function JoinProfileScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { completeProfileJoin, lookupProfileInvite, household } = useOrbit();
  const { c } = useOrbitColors();
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [householdName, setHouseholdName] = useState('');
  /** Invite's household — not the store's (which can still be mock Rivera before join). */
  const [inviteHouseholdId, setInviteHouseholdId] = useState<string | null>(null);
  const [lookOpen, setLookOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** When this CMX is also on a shared device shell, the welcome card is shown instead. */
  const [sharedShellChooser, setSharedShellChooser] = useState(false);
  const [chooserDismissed, setChooserDismissed] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [joiningDevice, setJoiningDevice] = useState(false);
  /** Bumped on failure so the welcome card can come back from its exit animation. */
  const [joinFailed, setJoinFailed] = useState(0);
  const chooserDismissedRef = useRef(false);
  chooserDismissedRef.current = chooserDismissed;
  /** Avoid re-lookup when post-join `setHousehold` would otherwise re-fire this effect. */
  const lookedUpCodeRef = useRef<string | null>(null);

  useEffect(() => {
    const parsed =
      parseInvitePayload(rawCode ?? '') ??
      (rawCode?.trim() ? normalizeInviteCode(rawCode) : null);
    if (!parsed) return;
    if (lookedUpCodeRef.current === parsed) return;
    lookedUpCodeRef.current = parsed;
    setCode(parsed);
    void lookupProfileInvite(parsed).then((result) => {
      if (!result) return;
      setMemberId(result.member.id);
      setName(result.member.name?.trim() ?? '');
      setAvatar(result.member.avatar ?? '');
      setHouseholdName(result.householdName);
      setInviteHouseholdId(result.householdId);
      setSharedShellChooser(Boolean(result.onSharedShell) && !chooserDismissedRef.current);
    });
  }, [rawCode, lookupProfileInvite]);

  const welcome = sharedDeviceWelcome({
    householdId: inviteHouseholdId ?? household.id,
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
    setJoiningDevice(true);
    setError('');
    try {
      const parsed = parseInvitePayload(code) ?? (code.trim() ? normalizeInviteCode(code) : null);
      if (!parsed) {
        throw new Error('Enter or scan a valid profile invite code.');
      }

      // Join as this person first. Without it there is no session, and /select-profile sends
      // an unauthenticated Sidekick to the admin sign-in screen with no password to type.
      const joined = await completeProfileJoin({
        code: parsed,
        displayName: name.trim() || name || 'Me',
        avatar: avatar.trim() || undefined,
      });

      // Post-join roster — never the pre-join React closure (often empty on a fresh tablet).
      const members: HouseholdMember[] = joined.members.length
        ? joined.members
        : household.members;
      const shell = findSharedDeviceForMember(joined.member.id, members);
      const onShell = resolveSharedDevicePeople(shell, members).map((person) => person.id);
      const welcomeIds = welcome.people.map((person) => person.id);
      const roster =
        onShell.length > 0
          ? onShell
          : welcomeIds.length > 0
            ? welcomeIds
            : [joined.member.id];
      if (roster.length === 0) {
        // Binding a device to nobody leaves a tablet that opens on an empty picker.
        throw new Error('This code is not on a shared device yet. Ask an admin to add you.');
      }

      await setupSharedDeviceSession({
        profileMemberIds: roster,
        deviceLabel: welcome.deviceLabel || shell?.name || 'Family device',
        sharedDeviceId: shell?.id ?? null,
        hostKind: 'shared-tablet',
      });
      router.replace('/select-profile' as never);
    } catch (err) {
      setJoiningDevice(false);
      setJoinFailed((n) => n + 1);
      setError(userFacingMessage(err, 'Could not join this device.'));
    }
  };

  if (sharedShellChooser && !chooserDismissed) {
    return (
      <AuthShell
        kicker="Shared device"
        title={`Welcome to ${welcome.householdName}`}
        subtitle={
          welcome.hasMatchCode
            ? "Check the code below matches your admin's screen, then go in."
            : 'Confirm this is your household, then go in.'
        }>
        <SharedDeviceWelcomeCard
          welcome={welcome}
          busy={joiningDevice}
          resetToken={joinFailed}
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
