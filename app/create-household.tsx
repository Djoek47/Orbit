import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdType } from '@/types/orbit';

const householdTypes: { label: string; value: HouseholdType; emoji: string }[] = [
  { label: 'Family', value: 'family', emoji: '👨‍👩‍👧‍👦' },
  { label: 'Single Parent', value: 'single-parent', emoji: '🧑‍👧' },
  { label: 'Roommates', value: 'roommates', emoji: '🏠' },
  { label: 'Multi-Gen', value: 'multi-generational', emoji: '👴' },
  { label: 'Custom', value: 'custom', emoji: '✨' },
];

export default function CreateHouseholdScreen() {
  const { accentTheme, createHousehold } = useOrbit();
  const [name, setName] = useState('The Orbit Home');
  const [type, setType] = useState<HouseholdType>('family');
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
      await createHousehold({ name, type });
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
      subtitle="You will be assigned as owner and can invite members next.">
      <OrbitInput label="Household name" value={name} onChangeText={setName} placeholder="e.g. The Millers" />
      <Text style={styles.label}>Household type</Text>
      <View style={styles.typeGrid}>
        {householdTypes.map((item) => {
          const selected = item.value === type;
          return (
            <Pressable
              key={item.value}
              onPress={() => setType(item.value)}
              style={[
                styles.typeChip,
                selected && {
                  backgroundColor: `${accentTheme.primary}22`,
                  borderColor: `${accentTheme.primary}55`,
                },
              ]}>
              <Text style={styles.typeEmoji}>{item.emoji}</Text>
              <Text style={[styles.typeLabel, selected && { color: accentTheme.primary }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable onPress={() => void handleCreateHousehold()} disabled={busy} style={styles.ctaWrap}>
        <LinearGradient
          colors={[accentTheme.primary, accentTheme.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cta}>
          <Text style={styles.ctaText}>{busy ? 'Creating…' : 'Create household'}</Text>
        </LinearGradient>
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  label: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeEmoji: { fontSize: 14 },
  typeLabel: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  error: {
    color: orbitColors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  ctaWrap: { borderRadius: 18, overflow: 'hidden', marginTop: 4 },
  cta: { alignItems: 'center', paddingVertical: 15 },
  ctaText: { color: '#070D1C', fontSize: 15, fontWeight: '800' },
});
