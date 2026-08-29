import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { blocksPreviousDisplayName } from '@/lib/household/member-connection';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

/**
 * After join approval — pick the name this household should use.
 * Blocks reusing the previous signed-in account name when switching homes.
 */
export default function JoinDisplayNameScreen() {
  const { c } = useOrbitColors();
  const { currentMember, currentUser, household, updateMemberDisplayName } = useOrbit();
  const [name, setName] = useState(currentMember?.name ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const previousName = currentUser?.name ?? '';

  const handleContinue = async () => {
    const trimmed = name.trim();
    if (!currentMember?.id) {
      router.replace('/(tabs)/tasks' as never);
      return;
    }
    if (trimmed.length < 2) {
      setError('Enter a name your household will recognize.');
      return;
    }
    if (blocksPreviousDisplayName(previousName, trimmed)) {
      setError('Choose a different name than your previous account.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await updateMemberDisplayName(currentMember.id, trimmed);
      router.replace('/(tabs)/tasks' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your name.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      kicker="You're in"
      title="Choose your name"
      subtitle={`How should ${household.householdName} know you? You can change this later in Settings.`}>
      <View style={{ gap: 12 }}>
        <OrbitInput
          label="Display name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          placeholder="Your name"
        />
        {error ? (
          <Text style={{ color: c.danger, fontSize: 14 }} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <OrbitButton disabled={busy} onPress={() => void handleContinue()}>
          {busy ? 'Saving…' : 'Continue to Tasks'}
        </OrbitButton>
      </View>
    </AuthShell>
  );
}
