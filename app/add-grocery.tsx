import { Stack, router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { classifyGroceryItem } from '@/lib/grocery/classify';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

/** Revision C §4.2 — type it, it files itself. No category/location pickers. */
export default function AddGroceryScreen() {
  const insets = useSafeAreaInsets();
  const { addMissingGrocery, orbitPalette } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInputLike>(null);

  const preview = useMemo(() => (name.trim() ? classifyGroceryItem(name) : null), [name]);

  async function onSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'What should we add to the list?');
      return;
    }
    setBusy(true);
    try {
      await addMissingGrocery({ name: name.trim() });
      setName('');
      inputRef.current?.focus?.();
    } catch (error) {
      Alert.alert('Could not add item', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: orbitPalette.backgroundSoft }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: c.accent, fontWeight: '600' }}>Cancel</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>Add an item</Text>
        <View style={{ width: 56 }} />
      </View>

      <KeyboardScreen contentContainerStyle={styles.body}>
        <TextInput
          ref={inputRef as never}
          value={name}
          onChangeText={setName}
          placeholder="Milk, 2 lbs chicken…"
          placeholderTextColor={c.textSubtle}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void onSave()}
          style={[
            styles.input,
            { color: c.text, borderColor: glassBorder(0.12), backgroundColor: glass(0.04) },
          ]}
        />
        {preview ? (
          <Text style={[styles.hint, { color: c.textMuted }]}>
            {preview.quantityDisplay ? `${preview.quantityDisplay} · ` : ''}
            Files under {preview.categoryName}
            {preview.confidence === 'fallback' ? ' — tap the tag later to fix' : ''}
          </Text>
        ) : (
          <Text style={[styles.hint, { color: c.textSubtle }]}>
            Type and return — aisle is chosen automatically.
          </Text>
        )}
        <OrbitButton disabled={busy || !name.trim()} onPress={() => void onSave()}>
          {busy ? 'Adding…' : 'Add to list'}
        </OrbitButton>
      </KeyboardScreen>
    </View>
  );
}

type TextInputLike = { focus: () => void };

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 17, fontWeight: '700' },
  body: { gap: 14, padding: 16 },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  hint: { fontSize: 13, lineHeight: 18 },
});
