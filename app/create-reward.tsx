import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

const emojis = ['📱', '🎬', '🌙', '🍦', '🎮', '✨', '🚲', '🍕'];

export default function CreateRewardScreen() {
  const { createReward, permissions } = useOrbit();
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('120');
  const [emoji, setEmoji] = useState(emojis[0]);
  const [approval, setApproval] = useState('Required');

  if (!permissions.canApproveReward && !permissions.canManageHousehold) {
    return (
      <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
        <Text style={orbitTypography.title}>Minting locked</Text>
        <Text style={orbitTypography.body}>Only owners and admins can mint shop rewards.</Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back
        </OrbitButton>
      </ScrollView>
    );
  }

  const handleSave = async () => {
    if (!title.trim() || Number(cost) <= 0) {
      return;
    }
    await createReward({
      title: title.trim(),
      cost: Number(cost),
      approvalRequired: approval === 'Required',
      emoji,
    });
    router.back();
  };

  return (
    <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Rewards shop</Text>
        <Text style={orbitTypography.display}>Mint reward</Text>
        <Text style={orbitTypography.body}>Admin-minted rewards appear in the Ranks shop for the household.</Text>
      </View>
      <GlassCard>
        <OrbitInput label="Title" value={title} onChangeText={setTitle} placeholder="30 minutes screen time" />
        <OrbitInput keyboardType="number-pad" label="XP cost" value={cost} onChangeText={setCost} />
        <ChoiceRow label="Emoji" options={emojis} value={emoji} onChange={setEmoji} />
        <ChoiceRow
          label="Approval"
          options={['Required', 'Instant']}
          value={approval}
          onChange={setApproval}
        />
      </GlassCard>
      <OrbitButton disabled={!title.trim()} onPress={handleSave}>
        Save reward
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Cancel
      </OrbitButton>
    </ScrollView>
  );
}
