import { BlurView } from 'expo-blur';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { typography } from '@/constants/orbit-theme';
import type { ShoppingPalette } from '@/lib/grocery/shopping-palette';

type Props = {
  palette: ShoppingPalette;
  visible: boolean;
  message: string;
  bottomOffset: number;
  onUndo: () => void;
};

export function ShoppingUndoToast({
  palette,
  visible,
  message,
  bottomOffset,
  onUndo,
}: Props) {
  if (!visible) return null;

  return (
    <View style={[styles.toast, { bottom: bottomOffset, borderColor: palette.glassEdge }]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 26 : 45}
        tint={palette.isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.dockBg }]} />
      <Text style={[typography.footnote, { color: palette.ink, flex: 1, fontWeight: '600' }]} numberOfLines={1}>
        {message}
      </Text>
      <Pressable onPress={onUndo} style={[styles.btn, { backgroundColor: palette.toastBtnBg }]}>
        <Text style={[typography.caption1, { color: palette.ink, fontWeight: '700' }]}>Undo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    left: 40,
    right: 40,
    zIndex: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
    paddingLeft: 18,
    paddingRight: 12,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  btn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14 },
});
