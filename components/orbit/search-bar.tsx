import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput as RNTextInput, View, type TextInput as RNTextInputType } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { androidBlurMethod, material, resolveBlurTint } from '@/constants/material-tokens';
import { motionDuration } from '@/constants/motion-tokens';
import { orbitColors, radius, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';

export type SearchBarSuggestion = {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
};

type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onFocusChange?: (focused: boolean) => void;
  /** Catalog / filter suggestions shown under the field. */
  suggestions?: SearchBarSuggestion[];
  onPickSuggestion?: (suggestion: SearchBarSuggestion) => void;
  onSubmitEditing?: () => void;
  /** When suggestions are open, offer “Add as typed” using current value. */
  showAddAsTyped?: boolean;
  disabled?: boolean;
  inputRef?: React.RefObject<RNTextInputType | null>;
  autoFocus?: boolean;
};

/**
 * Live-filter search field living in glass chrome — see
 * docs/design-system/03-motion-interaction.md §12 and
 * docs/design-system/05-component-library.md "Search Bar".
 * Optional suggestion dropdown covers grocery catalog typeahead (no fork).
 */
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  onFocusChange,
  suggestions,
  onPickSuggestion,
  onSubmitEditing,
  showAddAsTyped = false,
  disabled,
  inputRef,
  autoFocus,
}: SearchBarProps) {
  const orbit = useOrbitOptional();
  const { c, isDark, glassBorder } = useOrbitColors();
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const hasSuggestions = Boolean(suggestions?.length);

  useEffect(() => {
    setOpen(Boolean(value.trim()) && hasSuggestions && focused);
  }, [value, hasSuggestions, focused]);

  const cancelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused || value.length > 0 ? 1 : 0, { duration: motionDuration.snappy }),
    width: withTiming(focused || value.length > 0 ? 60 : 0, { duration: motionDuration.snappy }),
  }));

  const handleFocus = () => {
    setFocused(true);
    onFocusChange?.(true);
    if (hasSuggestions) setOpen(true);
  };

  const handleCancel = () => {
    onChangeText('');
    setFocused(false);
    setOpen(false);
    onFocusChange?.(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.field}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <BlurView
              intensity={Platform.OS === 'ios' ? material.thin.intensity : material.thin.androidIntensity}
              tint={resolveBlurTint(isDark)}
              experimentalBlurMethod={androidBlurMethod}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <MaterialIcons name="search" size={18} color={c.textMuted} />
          <RNTextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={() => {
              setFocused(false);
              onFocusChange?.(false);
            }}
            onSubmitEditing={onSubmitEditing}
            placeholder={placeholder}
            placeholderTextColor={c.textSubtle}
            style={[styles.input, { color: c.text }]}
            returnKeyType={onSubmitEditing ? 'done' : 'search'}
            editable={!disabled}
            autoFocus={autoFocus}
            autoCorrect={false}
            autoCapitalize="sentences"
          />
        </View>
        <Animated.View style={[styles.cancelWrap, cancelStyle]}>
          <Pressable onPress={handleCancel} accessibilityLabel="Cancel search">
            <Text style={[styles.cancelText, { color: orbit?.accentTheme.primary ?? orbitColors.primary }]}>
              Cancel
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      {open && hasSuggestions && suggestions ? (
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
                  onPickSuggestion?.(item);
                }}
                style={styles.suggestionRow}>
                {item.icon ? <Text style={styles.suggestionIcon}>{item.icon}</Text> : null}
                <View style={{ flex: 1 }}>
                  <Text style={[typography.subheadline, { color: c.text, fontWeight: '600' }]}>
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text style={[typography.caption2, { color: c.textMuted }]}>{item.subtitle}</Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    typography.caption1,
                    { color: orbit?.accentTheme.primary ?? c.accent, fontWeight: '700' },
                  ]}>
                  Add
                </Text>
              </Pressable>
            )}
          />
          {showAddAsTyped && value.trim() ? (
            <Pressable
              onPress={() => {
                setOpen(false);
                onSubmitEditing?.();
              }}
              style={[styles.freeText, { borderTopColor: glassBorder(0.1) }]}>
              <Text style={[typography.footnote, { color: c.textSoft }]}>
                Add “{value.trim()}” as typed
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 20 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  field: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderCurve: 'continuous',
    flexDirection: 'row',
    flex: 1,
    gap: space.xs,
    height: 36,
    overflow: 'hidden',
    paddingHorizontal: space.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  cancelWrap: {
    overflow: 'hidden',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: space.xs,
  },
  dropdown: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  freeText: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
