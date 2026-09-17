import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { typography } from '@/constants/orbit-theme';
import type { CatalogProduct } from '@/lib/grocery/catalog';
import { searchCatalog } from '@/lib/grocery/search-index';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmitFreeText: () => void;
  onPickProduct: (product: CatalogProduct) => void;
  placeholder?: string;
  inputRef?: React.RefObject<TextInput | null>;
  disabled?: boolean;
} & Pick<TextInputProps, 'autoFocus'>;

export function GrocerySearchField({
  value,
  onChangeText,
  onSubmitFreeText,
  onPickProduct,
  placeholder = 'Search groceries…',
  inputRef,
  disabled,
  autoFocus,
}: Props) {
  const { c, glass, glassBorder } = useOrbitColors();
  const [open, setOpen] = useState(false);
  const localRef = useRef<TextInput>(null);
  const ref = inputRef ?? localRef;

  const suggestions = useMemo(() => {
    if (!value.trim() || value.trim().length < 1) return [];
    return searchCatalog(value, 10);
  }, [value]);

  useEffect(() => {
    setOpen(Boolean(value.trim()) && suggestions.length > 0);
  }, [value, suggestions.length]);

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.field,
          {
            backgroundColor: glass(0.08),
            borderColor: glassBorder(0.16),
          },
        ]}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textSubtle}
          returnKeyType="done"
          autoCorrect={false}
          autoCapitalize="sentences"
          autoFocus={autoFocus}
          editable={!disabled}
          onSubmitEditing={onSubmitFreeText}
          onFocus={() => {
            if (suggestions.length) setOpen(true);
          }}
          style={[styles.input, { color: c.text }]}
        />
      </View>
      {open && suggestions.length ? (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: c.cardStrong,
              borderColor: glassBorder(0.14),
            },
          ]}>
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={suggestions}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 260 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setOpen(false);
                  onPickProduct(item);
                }}
                style={styles.row}>
                <Text style={styles.icon}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.subheadline, { color: c.text, fontWeight: '600' }]}>
                    {item.name}
                  </Text>
                  <Text style={[typography.caption2, { color: c.textMuted }]}>
                    {item.browseCategory.replace(/_/g, ' ')}
                  </Text>
                </View>
                <Text style={[typography.caption1, { color: c.accent, fontWeight: '700' }]}>Add</Text>
              </Pressable>
            )}
          />
          <Pressable
            onPress={() => {
              setOpen(false);
              onSubmitFreeText();
            }}
            style={[styles.freeText, { borderTopColor: glassBorder(0.1) }]}>
            <Text style={[typography.footnote, { color: c.textSoft }]}>
              Add “{value.trim()}” as typed
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 20 },
  field: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
    minHeight: 52,
    justifyContent: 'center',
  },
  input: {
    fontSize: 18,
    fontWeight: '500',
    minHeight: 44,
    paddingVertical: 10,
  },
  dropdown: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  icon: { fontSize: 22, width: 28, textAlign: 'center' },
  freeText: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
