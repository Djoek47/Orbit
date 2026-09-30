import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text, AppTextInput } from '@/components/orbit/app-text';
import { typography } from '@/constants/orbit-theme';
import type { ShoppingPalette } from '@/lib/grocery/shopping-palette';

type Props = {
  palette: ShoppingPalette;
  value: string;
  guessLabel?: string | null;
  bottomInset: number;
  busy?: boolean;
  onChangeText: (text: string) => void;
  onAdd: () => void;
};

export function ShoppingDock({
  palette,
  value,
  guessLabel,
  bottomInset,
  busy,
  onChangeText,
  onAdd,
}: Props) {
  // The dock floats, so it has to ride the keyboard itself.
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (event) => {
      setKeyboard(event.endCoordinates?.height ?? 0);
    });
    const onHide = Keyboard.addListener(hideEvent, () => setKeyboard(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  const lift = keyboard > 0 ? keyboard - bottomInset + 10 : 0;

  return (
    <View
      style={[styles.wrap, { bottom: Math.max(bottomInset, 12) + 8 + Math.max(0, lift) }]}
      pointerEvents="box-none">
      {guessLabel ? (
        <View
          style={[
            styles.guess,
            { backgroundColor: palette.guessBg, borderColor: palette.guessBorder },
          ]}>
          <MaterialIcons name="check" size={15} color={palette.guessText} />
          <Text style={[typography.caption1, { color: palette.guessText, fontWeight: '700' }]}>
            {guessLabel}
          </Text>
        </View>
      ) : null}

      <View style={[styles.dock, { borderColor: palette.glassEdge }]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 30 : 50}
          tint={palette.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.dockBg }]} />
        <AppTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Add an item"
          placeholderTextColor={palette.inkFaint}
          returnKeyType="done"
          blurOnSubmit={false}
          onSubmitEditing={onAdd}
          editable={!busy}
          style={[styles.input, { color: palette.ink }]}
        />
        <Pressable
          onPress={onAdd}
          disabled={busy || !value.trim()}
          accessibilityLabel="Add"
          style={[
            styles.addBtn,
            { backgroundColor: palette.primary, opacity: value.trim() ? 1 : 0.5 },
          ]}>
          <MaterialIcons name="add" size={22} color={palette.isDark ? palette.canvas : '#fff'} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    zIndex: 5,
  },
  guess: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginLeft: 8,
    paddingVertical: 8,
    paddingLeft: 11,
    paddingRight: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 20,
    paddingRight: 9,
    paddingVertical: 9,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 9,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
