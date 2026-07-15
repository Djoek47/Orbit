import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdType } from '@/types/orbit';

const householdTypes: { label: string; value: HouseholdType }[] = [
  { label: 'Family', value: 'family' },
  { label: 'Single Parent', value: 'single-parent' },
  { label: 'Roommates', value: 'roommates' },
  { label: 'Multi-Generational', value: 'multi-generational' },
  { label: 'Custom', value: 'custom' },
];

export default function CreateHouseholdScreen() {
  const { createHousehold } = useOrbit();
  const [name, setName] = useState('The Orbit Home');
  const [type, setType] = useState<HouseholdType>('family');
  const [error, setError] = useState('');

  const handleCreateHousehold = async () => {
    if (!name.trim()) {
      setError('Add a household name to continue.');
      return;
    }

    setError('');
    await createHousehold({ name, type });
    router.replace('/' as never);
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Owner setup</Text>
        <Text style={orbitTypography.display}>Create household</Text>
        <Text style={orbitTypography.body}>You will be assigned as owner and can invite members from the home screen.</Text>
      </View>

      <GlassCard elevated style={styles.form}>
        <OrbitInput label="Household name" value={name} onChangeText={setName} />
        <Text style={styles.label}>Household type</Text>
        <View style={styles.typeGrid}>
          {householdTypes.map((item) => {
            const selected = item.value === type;
            return (
              <Pressable
                key={item.value}
                onPress={() => setType(item.value)}
                style={[styles.typeChip, selected && styles.typeChipSelected]}>
                <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <OrbitButton onPress={handleCreateHousehold}>Create Household</OrbitButton>
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
  label: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  typeChip: {
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.sm,
    borderWidth: 1,
    paddingHorizontal: orbitSpacing.md,
    paddingVertical: orbitSpacing.sm,
  },
  typeChipSelected: {
    backgroundColor: 'rgba(0, 194, 255, 0.16)',
    borderColor: orbitColors.novaCyan,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: orbitSpacing.sm,
  },
  typeLabel: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  typeLabelSelected: {
    color: orbitColors.text,
  },
});
