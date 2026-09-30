import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

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

/** The closed dock: just the round orange button. */
const BUTTON = 56;

/**
 * Add an item — a round + that grows into the field.
 *
 * Closed, it's only the button in the corner, so it doesn't cover the list. Tap it and the field
 * opens out to the left from the button and the keyboard comes up. The keyboard's blue ✓ adds
 * what's typed and stays open for the next one; with nothing typed, ✓ (or the ×) folds it back.
 */
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
  const [open, setOpen] = useState(false);
  const [trackW, setTrackW] = useState(0);
  const grow = useSharedValue(0);
  const empty = !value.trim();

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

  useEffect(() => {
    grow.set(
      open
        ? withSpring(1, { damping: 18, stiffness: 180 })
        : withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) })
    );
  }, [grow, open]);

  const openDock = () => {
    setOpen(true);
  };
  const closeDock = () => {
    Keyboard.dismiss();
    setOpen(false);
  };
  const submit = () => {
    if (empty) {
      closeDock();
      return;
    }
    onAdd();
  };

  const dockStyle = useAnimatedStyle(() => {
    const full = trackW > 0 ? trackW : BUTTON;
    return { width: BUTTON + (full - BUTTON) * grow.get() };
  });
  const fieldStyle = useAnimatedStyle(() => ({ opacity: grow.get() }));
  const iconStyle = useAnimatedStyle(() => ({
    // + turns into × while the field is open and empty — the way to fold it back.
    transform: [{ rotate: `${open && empty ? 45 * grow.get() : 0}deg` }],
  }));

  const lift = keyboard > 0 ? keyboard - bottomInset + 10 : 0;

  return (
    <View
      style={[styles.wrap, { bottom: Math.max(bottomInset, 12) + 8 + Math.max(0, lift) }]}
      pointerEvents="box-none"
      onLayout={(event) => setTrackW(event.nativeEvent.layout.width)}>
      {guessLabel && open ? (
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

      <Animated.View
        style={[styles.dock, { borderColor: open ? palette.glassEdge : 'transparent' }, dockStyle]}>
        {open ? (
          <>
            <BlurView
              intensity={Platform.OS === 'ios' ? 30 : 50}
              tint={palette.isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.dockBg }]} />
          </>
        ) : null}
        <Animated.View style={[styles.field, fieldStyle]} pointerEvents={open ? 'auto' : 'none'}>
          {open ? (
          <AppTextInput
            autoFocus
            value={value}
            onChangeText={onChangeText}
            placeholder="Add an item"
            placeholderTextColor={palette.inkFaint}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={submit}
            onBlur={() => {
              if (!value.trim()) setOpen(false);
            }}
            editable={!busy}
            style={[styles.input, { color: palette.ink }]}
          />
          ) : null}
        </Animated.View>
        <Pressable
          onPress={open ? submit : openDock}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={!open ? 'Add an item' : empty ? 'Close' : 'Add'}
          style={[styles.addBtn, { backgroundColor: palette.primary }]}>
          <Animated.View style={iconStyle}>
            <MaterialIcons name="add" size={24} color={palette.isDark ? palette.canvas : '#fff'} />
          </Animated.View>
        </Pressable>
      </Animated.View>
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
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    height: BUTTON,
    borderRadius: BUTTON / 2,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  field: { flex: 1, minWidth: 0, paddingLeft: 20, paddingRight: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 9,
  },
  addBtn: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
