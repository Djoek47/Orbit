import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function CreateProfileScreen() {
  const { createProfile, currentUser, isSignedIn } = useOrbit();
  const [name, setName] = useState(currentUser?.name || 'Jordan');
  const [error, setError] = useState('');

  if (!isSignedIn) {
    return <Redirect href={'/welcome' as never} />;
  }

  const handleCreateProfile = async () => {
    if (!name.trim()) {
      setError('Add your name to finish the profile.');
      return;
    }

    setError('');
    await createProfile({ name });
    router.replace('/household-setup' as never);
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Personal setup</Text>
        <Text style={orbitTypography.display}>Create profile</Text>
        <Text style={orbitTypography.body}>This name becomes your member identity inside a household.</Text>
      </View>

      <GlassCard elevated style={styles.form}>
        <OrbitInput label="Display name" value={name} onChangeText={setName} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <OrbitButton onPress={handleCreateProfile}>Continue</OrbitButton>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  error: {
    color: orbitColors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  form: {
    gap: orbitSpacing.md,
  },
});
