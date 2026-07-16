import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function SpecialRewardRequestScreen() {
  const { requestSpecialReward } = useOrbit();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [cost, setCost] = useState('150');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      return;
    }
    setBusy(true);
    try {
      await requestSpecialReward(title.trim(), note.trim() || undefined, Number(cost) || 150);
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Special request</Text>
        <Text style={orbitTypography.display}>Ask for a reward</Text>
        <Text style={orbitTypography.body}>Nova will notify an admin to approve your one-off request.</Text>
      </View>
      <GlassCard>
        <OrbitInput label="What do you want?" value={title} onChangeText={setTitle} placeholder="Ice cream after dinner" />
        <OrbitInput label="Note for parents" value={note} onChangeText={setNote} placeholder="I finished laundry early" />
        <OrbitInput keyboardType="number-pad" label="Suggested XP cost" value={cost} onChangeText={setCost} />
      </GlassCard>
      <OrbitButton disabled={busy || !title.trim()} onPress={handleSubmit}>
        {busy ? 'Sending…' : 'Send request'}
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Cancel
      </OrbitButton>
    </ScrollView>
  );
}
