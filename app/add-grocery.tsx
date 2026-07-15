import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

const categories = ['Dairy', 'Produce', 'Bakery', 'Pantry', 'Household'];

export default function AddGroceryScreen() {
  const { addMissingGrocery } = useOrbit();
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0]);

  const canSave = name.trim().length > 1;

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    addMissingGrocery({ name, category });
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={orbitScreen.container}>
      <ScrollView contentContainerStyle={orbitScreen.content} contentInsetAdjustmentBehavior="automatic">
        <View style={orbitScreen.header}>
          <Text style={orbitTypography.caption}>Grocery intelligence</Text>
          <Text style={orbitTypography.display}>Missing Item</Text>
          <Text style={orbitTypography.body}>Keep it quick. Missing items update Home, Groceries, and Nova.</Text>
        </View>

        <GlassCard>
          <OrbitInput label="Item name" onChangeText={setName} placeholder="Milk" value={name} />
          <ChoiceRow label="Category" onChange={setCategory} options={categories} value={category} />
        </GlassCard>

        <OrbitButton disabled={!canSave} onPress={handleSave}>
          Add Missing Item
        </OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Cancel
        </OrbitButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
