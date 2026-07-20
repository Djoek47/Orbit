import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GROCERY_CATEGORIES, GROCERY_LOCATIONS, locationForGroceryCategory } from '@/data/household-rooms';
import { orbitColors } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { GroceryItem } from '@/types/orbit';

type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];
type GroceryLocation = GroceryItem['location'];

export default function AddGroceryScreen() {
  const insets = useSafeAreaInsets();
  const { addMissingGrocery, accentTheme } = useOrbit();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GroceryCategory>('Produce');
  const [quantity, setQuantity] = useState('1');
  const [location, setLocation] = useState<GroceryLocation>('Fridge');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const gradient = useMemo(
    () => [accentTheme.primary, accentTheme.secondary] as const,
    [accentTheme.primary, accentTheme.secondary],
  );

  function selectCategory(next: GroceryCategory) {
    setCategory(next);
    setLocation(locationForGroceryCategory(next));
  }

  async function onSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'What is missing from the household?');
      return;
    }
    const qty = Math.max(1, Number(quantity) || 1);
    setBusy(true);
    try {
      await addMissingGrocery({
        name: name.trim(),
        category,
        quantity: `${qty}`,
        location,
        note: note.trim() || undefined,
      });
      router.back();
    } catch (error) {
      Alert.alert('Could not add item', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.handle} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="close" size={20} color={orbitColors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Grocery</Text>
          <Text style={styles.title}>Missing Item</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Item name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Almond milk"
          placeholderTextColor={orbitColors.textMuted}
          style={styles.input}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipWrap}>
          {GROCERY_CATEGORIES.map((item) => {
            const active = category === item;
            return (
              <Pressable
                key={item}
                onPress={() => selectCategory(item)}
                style={[styles.chip, active && { borderColor: accentTheme.primary, backgroundColor: `${accentTheme.primary}22` }]}>
                <Text style={[styles.chipText, active && { color: accentTheme.primary }]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Quantity</Text>
        <View style={styles.qtyRow}>
          <Pressable onPress={() => setQuantity(String(Math.max(1, (Number(quantity) || 1) - 1)))} style={styles.qtyBtn}>
            <Ionicons name="remove" size={18} color={orbitColors.text} />
          </Pressable>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            style={styles.qtyInput}
          />
          <Pressable onPress={() => setQuantity(String((Number(quantity) || 1) + 1))} style={styles.qtyBtn}>
            <Ionicons name="add" size={18} color={orbitColors.text} />
          </Pressable>
        </View>

        <Text style={styles.label}>Storage location</Text>
        <View style={styles.chipWrap}>
          {GROCERY_LOCATIONS.map((item) => {
            const active = location === item;
            return (
              <Pressable
                key={item}
                onPress={() => setLocation(item)}
                style={[styles.chip, active && { borderColor: accentTheme.primary, backgroundColor: `${accentTheme.primary}22` }]}>
                <Text style={[styles.chipText, active && { color: accentTheme.primary }]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Brand, size, dietary note…"
          placeholderTextColor={orbitColors.textMuted}
          style={[styles.input, styles.noteInput]}
          multiline
        />

        <Pressable onPress={() => void onSave()} disabled={busy} style={styles.saveWrap}>
          <LinearGradient colors={[...gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtn}>
            <Text style={styles.saveText}>{busy ? 'Saving…' : 'Save'}</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A1525' },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  kicker: { color: orbitColors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { color: orbitColors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  content: { padding: 16, gap: 10 },
  label: { color: orbitColors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 6 },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: orbitColors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipText: { color: orbitColors.textMuted, fontSize: 12, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  qtyInput: {
    flex: 1,
    textAlign: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: orbitColors.text,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '800',
  },
  saveWrap: { marginTop: 12, borderRadius: 18, overflow: 'hidden' },
  saveBtn: { alignItems: 'center', paddingVertical: 15 },
  saveText: { color: '#04101F', fontWeight: '800', fontSize: 15 },
});
