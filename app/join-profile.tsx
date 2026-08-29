import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { PersonalizeLookSheet } from '@/components/orbit/personalize-look-sheet';
import { Avatar } from '@/components/orbit/avatar';
import { Pressable } from 'react-native';
import { normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import { userFacingMessage } from '@/lib/auth/auth-errors';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function JoinProfileScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { completeProfileJoin, lookupProfileInvite } = useOrbit();
  const { c } = useOrbitColors();
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [lookOpen, setLookOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const parsed =
      parseInvitePayload(rawCode ?? '') ??
      (rawCode?.trim() ? normalizeInviteCode(rawCode) : null);
    if (!parsed) return;
    setCode(parsed);
    void lookupProfileInvite(parsed).then((result) => {
      if (!result) return;
      setName(result.member.name?.trim() ?? '');
      setAvatar(result.member.avatar ?? '');
      setHouseholdName(result.householdName);
    });
  }, [rawCode, lookupProfileInvite]);

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
      const outcome = await completeProfileJoin({
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

  return (
    <AuthShell
      kicker="Profile invite"
      title="Join the household"
      subtitle={
        householdName
          ? `You're joining ${householdName}. No email or payment needed.`
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
        <OrbitButton disabled={busy} onPress={() => void handleContinue()}>
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
