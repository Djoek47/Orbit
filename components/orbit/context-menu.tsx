import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, type LayoutRectangle, type NativeSyntheticEvent, type NativeTouchEvent } from 'react-native';

import { androidBlurMethod, material, resolveBlurTint } from '@/constants/material-tokens';
import { orbitColors, radius, space, typography } from '@/constants/orbit-theme';
import { glassCardStrong, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text } from '@/components/orbit/app-text';

export type ContextMenuAction = {
  key: string;
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  destructive?: boolean;
  /** Primary action — photo request and photo reply. */
  accent?: boolean;
  onPress: () => void;
};

type ContextMenuProps = {
  actions: ContextMenuAction[];
  children: React.ReactNode;
  onPress?: () => void;
};

/**
 * Long-press secondary actions on a list row — see
 * docs/design-system/03-motion-interaction.md §4 and
 * docs/design-system/05-component-library.md "Context Menu".
 */
export function ContextMenu({ actions, children, onPress }: ContextMenuProps) {
  const { c, isDark, glassBorder } = useOrbitColors();
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number } | null>(null);
  const layoutRef = useRef<LayoutRectangle | null>(null);

  const open = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const pageX = event.nativeEvent.pageX;
    const pageY = event.nativeEvent.pageY;
    setAnchor({ x: pageX, y: pageY, width: layoutRef.current?.width ?? 200 });
    setVisible(true);
  };

  const close = () => setVisible(false);

  return (
    <>
      <View
        onLayout={(event) => {
          layoutRef.current = event.nativeEvent.layout;
        }}>
        <Pressable onPress={onPress} onLongPress={open} delayLongPress={300}>
          {children}
        </Pressable>
      </View>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss menu">
          {anchor ? (
            <View
              style={[
                styles.menu,
                {
                  top: Math.min(anchor.y, 560),
                  left: Math.max(space.md, Math.min(anchor.x - 120, 200)),
                  backgroundColor: glassCardStrong(isDark),
                  borderColor: glassBorder(0.16),
                },
              ]}>
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <BlurView
                  intensity={Platform.OS === 'ios' ? material.thin.intensity : material.thin.androidIntensity}
                  tint={resolveBlurTint(isDark)}
                  experimentalBlurMethod={androidBlurMethod}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              {actions.map((action, index) => {
                const color = action.destructive
                  ? orbitColors.danger
                  : action.accent
                    ? c.primary
                    : c.text;
                return (
                <Pressable
                  key={action.key}
                  onPress={() => {
                    close();
                    action.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    index < actions.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: glassBorder(0.12),
                    },
                    pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,28,42,0.05)' },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}>
                  <Text
                    style={[
                      typography.body,
                      styles.rowLabel,
                      { color, fontWeight: action.accent ? '700' : '500' },
                    ]}>
                    {action.label}
                  </Text>
                  {action.icon ? (
                    <MaterialIcons
                      name={action.icon}
                      size={20}
                      color={action.destructive ? orbitColors.danger : action.accent ? c.primary : c.textMuted}
                    />
                  ) : null}
                </Pressable>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menu: {
    borderRadius: radius.card,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 228,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  rowLabel: {
    flex: 1,
  },
});
