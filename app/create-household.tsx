import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors } from '@/constants/orbit-theme';
import { DEFAULT_HOUSEHOLD_ROOMS } from '@/data/household-rooms';
import { ROOM_EMOJIS } from '@/constants/accent-themes';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { createLocalId } from '@/repositories/repository-utils';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdRoom } from '@/types/orbit';

export default function CreateHouseholdScreen() {
  const { accentTheme, createHousehold } = useOrbit();
  const { c } = useOrbitColors();
  const [name, setName] = useState('The Choremaxx Home');
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(() =>
    DEFAULT_HOUSEHOLD_ROOMS.map((room) => room.id),
  );
  const [customRooms, setCustomRooms] = useState<HouseholdRoom[]>([]);
  const [customName, setCustomName] = useState('');
  const [customEmoji, setCustomEmoji] = useState('🚪');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const catalog = useMemo(
    () => [...DEFAULT_HOUSEHOLD_ROOMS, ...customRooms],
    [customRooms],
  );

  const selectedRooms = useMemo(
    () => catalog.filter((room) => selectedRoomIds.includes(room.id)),
    [catalog, selectedRoomIds],
  );

  const toggleRoom = (roomId: string) => {
    setSelectedRoomIds((current) =>
      current.includes(roomId) ? current.filter((id) => id !== roomId) : [...current, roomId],
    );
  };

  const addCustomRoom = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    const room: HouseholdRoom = {
      id: createLocalId('room'),
      name: trimmed,
      emoji: customEmoji,
      kind: 'custom',
    };
    setCustomRooms((current) => [...current, room]);
    setSelectedRoomIds((current) => [...current, room.id]);
    setCustomName('');
  };

  const handleCreateHousehold = async () => {
    if (!name.trim()) {
      setError('Add a household name to continue.');
      return;
    }
    if (selectedRooms.length < 1) {
      setError('Pick at least one room.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      await createHousehold({ name: name.trim(), rooms: selectedRooms });
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
      subtitle="Name your home and pick rooms. You will be owner — families can add a second co-parent admin after invite.">
      <OrbitInput label="Household name" value={name} onChangeText={setName} placeholder="e.g. The Millers" />

      <Text style={[styles.label, { color: c.textMuted }]}>Rooms</Text>
      <Text style={[styles.hint, { color: c.textSubtle }]}>
        Select the spaces you manage. You can edit these later in Settings.
      </Text>
      <View style={styles.typeGrid}>
        {catalog.map((room) => {
          const selected = selectedRoomIds.includes(room.id);
          return (
            <Pressable
              key={room.id}
              onPress={() => toggleRoom(room.id)}
              style={[
                styles.typeChip,
                selected && {
                  backgroundColor: `${accentTheme.primary}22`,
                  borderColor: `${accentTheme.primary}55`,
                },
              ]}>
              <Text style={styles.typeEmoji}>{room.emoji}</Text>
              <Text
                style={[
                  styles.typeLabel,
                  { color: c.textMuted },
                  selected && { color: accentTheme.primary },
                ]}>
                {room.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.typeGrid}>
        {ROOM_EMOJIS.map((emoji) => {
          const selected = customEmoji === emoji;
          return (
            <Pressable
              key={emoji}
              onPress={() => setCustomEmoji(emoji)}
              style={[
                styles.typeChip,
                selected && {
                  backgroundColor: `${accentTheme.primary}22`,
                  borderColor: `${accentTheme.primary}55`,
                },
              ]}>
              <Text style={styles.typeEmoji}>{emoji}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.customRow}>
        <TextInput
          value={customName}
          onChangeText={setCustomName}
          placeholder="Add a custom room"
          placeholderTextColor={c.textSubtle}
          style={[styles.customInput, { color: c.text }]}
          onSubmitEditing={addCustomRoom}
          returnKeyType="done"
        />
        <Pressable onPress={addCustomRoom} style={[styles.addBtn, { borderColor: `${accentTheme.primary}55` }]}>
          <Text style={[styles.addBtnText, { color: accentTheme.primary }]}>Add</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <OrbitButton disabled={busy} onPress={() => void handleCreateHousehold()}>
        {busy ? 'Creating…' : 'Create household'}
      </OrbitButton>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: -6,
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
    fontSize: 13,
    fontWeight: '700',
  },
  customRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  customInput: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  addBtnText: { fontSize: 13, fontWeight: '800' },
  error: {
    color: orbitColors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
});
