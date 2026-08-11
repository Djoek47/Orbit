import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, type LayoutRectangle, type NativeSyntheticEvent, type NativeTouchEvent } from 'react-native';

import { androidBlurMethod, material, resolveBlurTint } from '@/constants/material-tokens';
import { orbitColors, radius, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text } from '@/components/orbit/app-text';

export type ContextMenuAction = {
  key: string;
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

type ContextMenuProps = {
  actions: ContextMenuAction[];
  children: React.ReactNode;
};

/**
 * Long-press secondary actions on a list row — see
 * docs/design-system/03-motion-interaction.md §4 and
 * docs/design-system/05-component-library.md "Context Menu".
 */
export function ContextMenu({ actions, children }: ContextMenuProps) {
  const { c, isDark } = useOrbitColors();
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
        <Pressable onLongPress={open} delayLongPress={300}>
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
                  left: Math.max(space.md, Math.min(anchor.x - 100, 220)),
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
              {actions.map((action, index) => (
                <Pressable
                  key={action.key}
                  onPress={() => {
                    close();
                    action.onPress();
                  }}
                  style={[styles.row, index < actions.length - 1 && styles.rowDivider]}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}>
                  <Text
                    style={[
                      typography.body,
                      styles.rowLabel,
                      { color: action.destructive ? orbitColors.danger : c.text },
                    ]}>
                    {action.label}
                  </Text>
                  {action.icon ? (
                    <MaterialIcons
                      name={action.icon}
                      size={18}
                      color={action.destructive ? orbitColors.danger : c.textMuted}
                    />
                  ) : null}
                </Pressable>
              ))}
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
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 200,
    overflow: 'hidden',
    position: 'absolute',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  rowLabel: {
    flex: 1,
  },
});
