import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { GROCERY_CATEGORIES, GROCERY_LOCATIONS, locationForGroceryCategory } from '@/data/household-rooms';
import { orbitColors } from '@/constants/orbit-theme';
import { lookupGroceryProduct } from '@/lib/grocery/product-lookup';
import { openDirections } from '@/lib/maps/directions';
import { useOrbit } from '@/store/orbit-store';
import type { GroceryItem } from '@/types/orbit';

type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];
type GroceryLocation = GroceryItem['location'];

export default function AddGroceryScreen() {
  const insets = useSafeAreaInsets();
  const { addMissingGrocery, accentTheme, preferredStore, orbitPalette } = useOrbit();
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

  const lookup = useMemo(
    () => lookupGroceryProduct(name, preferredStore.id),
    [name, preferredStore.id],
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
        category: lookup?.category ?? category,
        quantity: `${qty}`,
        location,
        typicalPrice: lookup?.estimatedPackPrice,
        storeId: lookup?.store.id ?? preferredStore.id,
        note: [note.trim(), lookup?.note].filter(Boolean).join(' · ') || undefined,
      });
      router.back();
    } catch (error) {
      Alert.alert('Could not add item', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, backgroundColor: orbitPalette.backgroundSoft },
      ]}>
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

      <KeyboardScreen
        offset={24}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
        <Text style={styles.label}>Item name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Almond milk"
          placeholderTextColor={orbitColors.textMuted}
          style={styles.input}
        />

        {lookup ? (
          <View style={styles.lookupCard}>
            <Text style={styles.lookupTitle}>Lookup · {lookup.store.name}</Text>
            <Text style={styles.lookupMeta}>
              ${lookup.estimatedPackPrice.toFixed(2)} est. · {lookup.packSize}
            </Text>
            {lookup.pricePerLiter != null ? (
              <Text style={[styles.lookupUnit, { color: accentTheme.primary }]}>
                ${lookup.pricePerLiter.toFixed(2)}/L · ${lookup.pricePerGallon?.toFixed(2)}/gal
              </Text>
            ) : null}
            <Pressable
              onPress={() =>
                void openDirections(undefined, {
                  address: lookup.store.address,
                  placeQuery: lookup.store.placeQuery,
                })
              }
              style={styles.mapLink}>
              <Ionicons name="map-outline" size={14} color={accentTheme.primary} />
              <Text style={[styles.mapLinkText, { color: accentTheme.primary }]}>
                Open {lookup.store.name} in Maps
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipWrap}>
          {GROCERY_CATEGORIES.map((item) => {
            const active = item === category;
            return (
              <Pressable
                key={item}
                onPress={() => selectCategory(item)}
                style={[
                  styles.chip,
                  active && {
                    backgroundColor: `${accentTheme.primary}22`,
                    borderColor: `${accentTheme.primary}55`,
                  },
                ]}>
                <Text style={[styles.chipText, active && { color: accentTheme.primary }]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Quantity</Text>
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          placeholder="1"
          placeholderTextColor={orbitColors.textMuted}
          style={styles.input}
        />

        <Text style={styles.label}>Storage</Text>
        <View style={styles.chipWrap}>
          {GROCERY_LOCATIONS.map((item) => {
            const active = item === location;
            return (
              <Pressable
                key={item}
                onPress={() => setLocation(item)}
                style={[
                  styles.chip,
                  active && {
                    backgroundColor: `${accentTheme.primary}22`,
                    borderColor: `${accentTheme.primary}55`,
                  },
                ]}>
                <Text style={[styles.chipText, active && { color: accentTheme.primary }]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Brand, size, dietary note…"
          placeholderTextColor={orbitColors.textMuted}
          multiline
          style={[styles.input, styles.noteInput]}
        />

        <Pressable onPress={() => void onSave()} disabled={busy} style={styles.saveWrap}>
          <LinearGradient colors={[...gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.save}>
            <Text style={styles.saveText}>{busy ? 'Saving…' : 'Save'}</Text>
          </LinearGradient>
        </Pressable>
      </KeyboardScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  handle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    height: 4,
    marginBottom: 4,
    marginTop: 8,
    width: 40,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerCopy: { alignItems: 'center', flex: 1 },
  kicker: {
    color: orbitColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { color: orbitColors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  content: { gap: 10, padding: 16 },
  label: { color: orbitColors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    color: orbitColors.text,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: orbitColors.textMuted, fontSize: 12, fontWeight: '700' },
  lookupCard: {
    backgroundColor: 'rgba(89,178,225,0.08)',
    borderColor: 'rgba(89,178,225,0.25)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  lookupTitle: { color: orbitColors.text, fontSize: 13, fontWeight: '700' },
  lookupMeta: { color: orbitColors.textMuted, fontSize: 12 },
  lookupUnit: { fontSize: 13, fontWeight: '700' },
  mapLink: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 6 },
  mapLinkText: { fontSize: 12, fontWeight: '700' },
  saveWrap: { borderRadius: 18, marginTop: 8, overflow: 'hidden' },
  save: { alignItems: 'center', paddingVertical: 15 },
  saveText: { color: '#04101F', fontSize: 15, fontWeight: '800' },
});
