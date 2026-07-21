import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function SpecialRewardRequestScreen() {
  const insets = useSafeAreaInsets();
  const { requestSpecialReward } = useOrbit();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [cost, setCost] = useState('150');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await requestSpecialReward(title.trim(), note.trim() || undefined, Number(cost) || 150);
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={orbitScreen.header}>
        <ChoremaxxBadge />
        <Text style={[orbitTypography.caption, { marginTop: 8 }]}>Anyone can ask</Text>
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
          placeholder="Ice cream after dinner"
        />
        <OrbitInput
          label="Note for admins"
          value={note}
          onChangeText={setNote}
          placeholder="I finished laundry early"
        />
        <OrbitInput
          keyboardType="number-pad"
          label="Suggested XP cost"
          value={cost}
          onChangeText={setCost}
        />
      </GlassCard>

      <OrbitButton disabled={busy || !title.trim()} onPress={() => void handleSubmit()}>
        {busy ? 'Sending…' : 'Send request'}
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Cancel
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { gap: orbitSpacing.md },
});
