import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { getPreferredStore } from '@/data/preferred-stores';
import { orbitScreen, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { ItineraryStopKind } from '@/types/orbit';

const kinds: ItineraryStopKind[] = ['school', 'work', 'grocery', 'pickup', 'custom'];

export default function CreateItineraryScreen() {
  const { createItinerary, household, preferredStore } = useOrbit();
  const [title, setTitle] = useState('Family run');
  const [stopA, setStopA] = useState('School pickup');
  const [kindA, setKindA] = useState<ItineraryStopKind>('school');
  const [stopB, setStopB] = useState(preferredStore.name);
  const [kindB, setKindB] = useState<ItineraryStopKind>('grocery');
  const [busy, setBusy] = useState(false);
  const date = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const store = getPreferredStore(household.preferredStoreId);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const created = await createItinerary({
        title,
        date,
        summary: `2 stops · ~${kindB === 'grocery' ? 40 : 30} min`,
        stops: [
          {
            label: stopA,
            kind: kindA,
            placeQuery: stopA,
            address: stopA,
            etaMinutes: 15,
            sortOrder: 0,
          },
          {
            label: stopB,
            kind: kindB,
            placeQuery: kindB === 'grocery' ? store.placeQuery : stopB,
            address: kindB === 'grocery' ? store.address : stopB,
            groceryListId: kindB === 'grocery' ? 'cart-today' : undefined,
            etaMinutes: 20,
            sortOrder: 1,
          },
        ],
      });
      if (created) {
        router.replace(`/itinerary/${created.id}` as never);
      } else {
        router.back();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Plan</Text>
        <Text style={orbitTypography.display}>Create itinerary</Text>
        <Text style={orbitTypography.body}>Ordered stops with Maps handoff when you mark Arrived.</Text>
      </View>
      <GlassCard>
        <OrbitInput label="Title" value={title} onChangeText={setTitle} />
        <OrbitInput label="Stop 1" value={stopA} onChangeText={setStopA} />
        <ChoiceRow label="Stop 1 kind" options={kinds} value={kindA} onChange={setKindA} />
        <OrbitInput label="Stop 2" value={stopB} onChangeText={setStopB} />
        <ChoiceRow label="Stop 2 kind" options={kinds} value={kindB} onChange={setKindB} />
      </GlassCard>
      <OrbitButton disabled={busy || !title.trim()} onPress={handleCreate}>
        {busy ? 'Saving…' : 'Save itinerary'}
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Cancel
      </OrbitButton>
    </ScrollView>
  );
}
