import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function JoinHouseholdScreen() {
  const { joinHousehold } = useOrbit();
  const [inviteCode, setInviteCode] = useState('ORBIT-7429');
  const [error, setError] = useState('');

  const handleJoinHousehold = async () => {
    if (!inviteCode.trim()) {
      setError('Enter an invite code to continue.');
      return;
    }

    setError('');
    await joinHousehold({ inviteCode });
    router.replace('/' as never);
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Join a household</Text>
        <Text style={orbitTypography.display}>Invite code</Text>
        <Text style={orbitTypography.body}>Mock join requests enter as pending adult members until an owner approves them.</Text>
      </View>

      <GlassCard elevated style={styles.form}>
        <StatusPill label="Pending role: Adult" tone="amber" />
        <OrbitInput label="Invite code" value={inviteCode} onChangeText={setInviteCode} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <OrbitButton onPress={handleJoinHousehold}>Join Household</OrbitButton>
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
