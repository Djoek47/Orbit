import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import { useOrbit } from '@/store/orbit-store';

export default function SpecialRewardRequestScreen() {
  const insets = useSafeAreaInsets();
  const { household, permissions, requestSpecialReward } = useOrbit();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [cost, setCost] = useState('150');
  const [busy, setBusy] = useState(false);

  const caps = resolveMemberCapabilities(household);
  const allowed = permissions.canManageHousehold || caps.allowSpecialRewardRequest;

  const handleSubmit = async () => {
    if (!title.trim() || !allowed) return;
    setBusy(true);
    try {
      await requestSpecialReward(title.trim(), note.trim() || undefined, Number(cost) || 150);
      router.back();
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return (
      <ScrollView
        style={orbitScreen.container}
        contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={orbitScreen.header}>
          <ChoremaxxBadge />
          <Text style={[orbitTypography.caption, { marginTop: 8 }]}>Rewards</Text>
          <Text style={orbitTypography.display}>Special requests off</Text>
          <Text style={orbitTypography.body}>
            An admin needs to enable special reward requests in Settings → Member permissions.
          </Text>
        </View>
        <OrbitButton onPress={() => router.back()}>Go back</OrbitButton>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={orbitScreen.header}>
        <ChoremaxxBadge />
        <Text style={[orbitTypography.caption, { marginTop: 8 }]}>Ask the household</Text>
        <Text style={orbitTypography.display}>Special reward</Text>
        <Text style={orbitTypography.body}>
          Send a one-off ask. Admins see it as a special-request origin in the redeem tally.
        </Text>
      </View>

      <GlassCard style={styles.card}>
        <OrbitInput
          label="What do you want?"
          value={title}
          onChangeText={setTitle}
          placeholder="Extra screen time"
        />
        <OrbitInput
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Why this matters"
        />
        <OrbitInput
          label="Suggested XP cost"
          value={cost}
          onChangeText={setCost}
          keyboardType="number-pad"
        />
      </GlassCard>

      <OrbitButton disabled={!title.trim() || busy} onPress={() => void handleSubmit()}>
        {busy ? 'Sending…' : 'Send request'}
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { gap: orbitSpacing.md },
});
