import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function CreateHouseholdScreen() {
  const { createHousehold } = useOrbit();
  const [name, setName] = useState('The Choremaxx Home');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreateHousehold = async () => {
    if (!name.trim()) {
      setError('Add a household name to continue.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      await createHousehold({ name: name.trim() });
      router.replace('/invite-household' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create household.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      showBack
      kicker="Owner setup"
      title="Create household"
      subtitle="Name your home. You will be owner — families can add a second co-parent admin after invite.">
      <OrbitInput label="Household name" value={name} onChangeText={setName} placeholder="e.g. The Millers" />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <OrbitButton disabled={busy} onPress={() => void handleCreateHousehold()}>
        {busy ? 'Creating…' : 'Create household'}
      </OrbitButton>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  error: {
    color: orbitColors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
});
