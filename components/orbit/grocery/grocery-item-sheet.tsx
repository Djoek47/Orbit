/**
 * Edit one grocery item — the list is no longer read-only.
 *
 *   ┌───────────────────────────────┐
 *   │  🧀  [ Cheese            ]    │  rename
 *   │      [ 1 ] − +                │  how many
 *   │  Aisle:  (Dairy & Eggs) (…)   │  tap a chip to move it
 *   │  [ Save ]     [ Remove ]      │
 *   └───────────────────────────────┘
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { Moji } from '@/components/orbit/moji/moji';
import { typography } from '@/constants/orbit-theme';
import { iconForGroceryName } from '@/lib/grocery/catalog';
import { listGroceryCategories } from '@/lib/grocery/classify';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { GroceryItem } from '@/types/orbit';

type Props = {
  item: GroceryItem | null;
  accent: string;
  canEdit: boolean;
  onClose: () => void;
  onSave: (patch: { name: string; quantity: string }) => Promise<void> | void;
  onCategory: (categoryId: string) => Promise<void> | void;
  onRemove: () => Promise<void> | void;
};

export function GroceryItemSheet(props: Props) {
  // Keyed on the item, so each one opens with its own values and no copying in an effect.
  if (!props.item) return null;
  return <Editor key={props.item.id} {...props} item={props.item} />;
}

function Editor({ item, accent, canEdit, onClose, onSave, onCategory, onRemove }: Props & { item: GroceryItem }) {
  const { c, glass, glassBorder } = useOrbitColors();
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity || '1');
  const categories = listGroceryCategories().filter((cat) => cat.id !== 'clothing');

  const count = Number.parseInt(quantity, 10);
  const stepBy = (delta: number) => {
    const base = Number.isFinite(count) ? count : 1;
    setQuantity(String(Math.max(1, base + delta)));
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name it first', 'An item needs a name.');
      return;
    }
    await onSave({ name: trimmed, quantity: quantity.trim() || '1' });
    onClose();
  };

  const remove = () => {
    Alert.alert('Remove item?', `"${item.name}" comes off the list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await onRemove();
            onClose();
          })();
        },
      },
    ]);
  };

  return (
    <BottomSheet visible onDismiss={onClose} heightRatio={0.58} accentColor={accent}>
      <View style={styles.wrap}>
        <Text style={[typography.eyebrow, { color: c.textSubtle }]}>
          {canEdit ? 'Edit item' : 'Item'}
        </Text>
        <View style={styles.nameRow}>
          <View style={[styles.icon, { backgroundColor: `${accent}1F` }]}>
            <Moji emoji={iconForGroceryName(name || item.name, item.categoryId)} size={26} />
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            editable={canEdit}
            selectTextOnFocus={canEdit}
            placeholder="Item name"
            placeholderTextColor={c.textSubtle}
            style={[styles.input, { color: c.text, backgroundColor: glass(0.05), borderColor: glassBorder(0.1) }]}
            accessibilityLabel="Item name"
          />
        </View>

        {canEdit ? (
          <View style={styles.qtyRow}>
            <Text style={[typography.footnote, { color: c.textMuted, fontWeight: '700' }]}>How many</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => stepBy(-1)}
                style={[styles.step, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}
                accessibilityLabel="Fewer">
                <MaterialIcons name="remove" size={18} color={c.text} />
              </Pressable>
              <TextInput
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="default"
                style={[styles.qtyInput, { color: c.text, backgroundColor: glass(0.05), borderColor: glassBorder(0.1) }]}
                accessibilityLabel="Amount"
              />
              <Pressable
                onPress={() => stepBy(1)}
                style={[styles.step, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}
                accessibilityLabel="More">
                <MaterialIcons name="add" size={18} color={c.text} />
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={[typography.eyebrow, { color: c.textSubtle }]}>Aisle</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats}>
          {categories.map((cat) => {
            const on = cat.id === item.categoryId || cat.name === item.category;
            return (
              <Pressable
                key={cat.id}
                disabled={!canEdit}
                onPress={() => void onCategory(cat.id)}
                style={[
                  styles.cat,
                  {
                    backgroundColor: on ? `${accent}26` : glass(0.05),
                    borderColor: on ? `${accent}66` : glassBorder(0.1),
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}>
                <Text style={{ color: on ? accent : c.textMuted, fontWeight: '700', fontSize: 13 }}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {canEdit ? (
          <View style={styles.actions}>
            <Pressable
              onPress={() => void save()}
              style={[styles.primary, { backgroundColor: accent }]}
              accessibilityRole="button">
              <Text style={{ color: '#041018', fontWeight: '800', fontSize: 15 }}>Save</Text>
            </Pressable>
            <Pressable
              onPress={remove}
              style={[styles.destructive, { borderColor: `${c.danger}66` }]}
              accessibilityRole="button">
              <MaterialIcons name="delete-outline" size={18} color={c.danger} />
              <Text style={{ color: c.danger, fontWeight: '800', fontSize: 15 }}>Remove</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, paddingBottom: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    minWidth: 70,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 9,
    textAlign: 'center',
  },
  cats: { gap: 8, paddingVertical: 2 },
  cat: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 9 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  primary: { flex: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  destructive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 50,
    paddingHorizontal: 18,
  },
});
