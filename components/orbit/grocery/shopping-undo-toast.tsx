import { BlurView } from 'expo-blur';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
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
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.dockBg }]} />
      <Text style={[styles.msg, { color: palette.ink }]} numberOfLines={1}>
        {message}
      </Text>
      <Pressable
        onPress={onUndo}
        style={[styles.btn, { backgroundColor: 'rgba(244,234,218,0.10)' }]}>
        <Text style={[styles.btnText, { color: palette.ink }]}>Undo</Text>
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
    borderWidth: 1,
    overflow: 'hidden',
  },
  msg: { flex: 1, fontSize: 14, fontWeight: '600' },
  btn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14 },
  btnText: { fontSize: 13.5, fontWeight: '700' },
});
