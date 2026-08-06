import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, space, typography } from '@/constants/orbit-theme';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

/**
 * Q1 = B — Admin may allow members to ask for something not yet minted.
 * At most one pending request per member (enforced in repository).
 */
export default function SpecialRewardRequestScreen() {
  const insets = useSafeAreaInsets();
  const { household, orbitPalette, permissions, requestSpecialReward } = useOrbit();
  const { c } = useOrbitColors();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const caps = resolveMemberCapabilities(household);
  const allowed = permissions.canManageHousehold || caps.allowSpecialRewardRequest;

  const handleSubmit = async () => {
    if (!title.trim() || !allowed) return;
    setBusy(true);
    try {
      await requestSpecialReward(title.trim(), note.trim() || undefined, 0);
      router.back();
    } catch (error) {
      Alert.alert(
        'Couldn’t send',
        error instanceof Error ? error.message : 'Try again in a moment.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return (
      <ScrollView
        style={[orbitScreen.container, { backgroundColor: orbitPalette.background }]}
        contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={orbitScreen.header}>
          <ChoremaxxBadge />
          <Text style={[typography.footnote, { marginTop: 8, color: c.textMuted }]}>Rewards</Text>
          <Text style={[typography.title1, { color: c.text }]}>Requests are off</Text>
          <Text style={[typography.body, { color: c.textSoft }]}>
            A grown-up can allow reward requests that are not in the catalogue yet — Settings →
            Member permissions.
          </Text>
        </View>
        <OrbitButton onPress={() => router.back()}>Go back</OrbitButton>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[orbitScreen.container, { backgroundColor: orbitPalette.background }]}
      contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={orbitScreen.header}>
        <ChoremaxxBadge />
        <Text style={[typography.footnote, { marginTop: 8, color: c.textMuted }]}>Rewards</Text>
        <Text style={[typography.title1, { color: c.text }]}>Ask for a reward</Text>
        <Text style={[typography.body, { color: c.textSoft }]}>
          Ask for something that is not in the catalogue yet. A grown-up decides. You can only have
          one waiting request at a time.
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
      </GlassCard>

      <OrbitButton disabled={!title.trim() || busy} onPress={() => void handleSubmit()}>
        {busy ? 'Sending…' : 'Send request'}
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Cancel
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
});
