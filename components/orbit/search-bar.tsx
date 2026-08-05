import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { androidBlurMethod, material, resolveBlurTint } from '@/constants/material-tokens';
import { motionDuration } from '@/constants/motion-tokens';
import { orbitColors, radius, space } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';

type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onFocusChange?: (focused: boolean) => void;
};

/**
 * Live-filter search field living in glass chrome — see
 * docs/design-system/03-motion-interaction.md §12 and
 * docs/design-system/05-component-library.md "Search Bar".
 */
export function SearchBar({ value, onChangeText, placeholder = 'Search', onFocusChange }: SearchBarProps) {
  const orbit = useOrbitOptional();
  const { c, isDark } = useOrbitColors();
  const [focused, setFocused] = useState(false);

  const cancelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused || value.length > 0 ? 1 : 0, { duration: motionDuration.snappy }),
    width: withTiming(focused || value.length > 0 ? 60 : 0, { duration: motionDuration.snappy }),
  }));

  const handleFocus = () => {
    setFocused(true);
    onFocusChange?.(true);
  };

  const handleCancel = () => {
    onChangeText('');
    setFocused(false);
    onFocusChange?.(false);
  };

  return (
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
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          placeholder={placeholder}
          placeholderTextColor={c.textSubtle}
          style={[styles.input, { color: c.text }]}
          returnKeyType="search"
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
  );
}

const styles = StyleSheet.create({
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
});
