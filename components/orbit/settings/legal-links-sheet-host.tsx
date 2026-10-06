/**
 * Root-level Privacy & legal sheet — glass rows, opens in-app browser.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
import { radius, space, typography } from '@/constants/orbit-theme';
import { openChoremaxxUrl } from '@/lib/legal/open-choremaxx-url';
import {
  closeLegalLinksSheet,
  openLegalLinksSheet,
  subscribeLegalLinksSheet,
} from '@/lib/ui/legal-links-sheet-controller';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';

type Row = {
  icon: keyof typeof MaterialIcons.glyphMap;
  tone: string;
  label: string;
  onPress: () => void;
};

export function LegalLinksSheetHost() {
  const [visible, setVisible] = useState(false);
  const { c, glassBorder, isDark } = useOrbitColors();
  const orbit = useOrbitOptional();
  const primary = orbit?.accentTheme.primary ?? c.primary;

  useEffect(() => subscribeLegalLinksSheet(setVisible), []);

  const dismiss = () => closeLegalLinksSheet();

  const rows: Row[] = [
    {
      icon: 'policy',
      tone: '#34D399',
      label: 'Privacy Policy',
      onPress: () => {
        dismiss();
        void openChoremaxxUrl(CHOREMAXX_LEGAL.privacyUrl, 'Privacy Policy');
      },
    },
    {
      icon: 'gavel',
      tone: '#38BDF8',
      label: 'Terms of Service',
      onPress: () => {
        dismiss();
        void openChoremaxxUrl(CHOREMAXX_LEGAL.termsUrl, 'Terms of Service');
      },
    },
    {
      icon: 'mail-outline',
      tone: '#FF8A3D',
      label: 'Contact support',
      onPress: () => {
        dismiss();
        void openChoremaxxUrl(`mailto:${CHOREMAXX_LEGAL.supportEmail}`, 'Support');
      },
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Dismiss">
        <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill} />
      </Pressable>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          entering={FadeInDown.duration(280).springify().damping(18)}
          style={[
            styles.sheet,
            { backgroundColor: glassFill(isDark), borderColor: `${primary}55` },
          ]}>
          <LinearGradient
            colors={[`${primary}28`, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={[typography.headline, { color: c.text }]}>Privacy & legal</Text>
          <Text style={[styles.sub, { color: c.textMuted }]}>
            Choremaxx legal pages open in your browser.
          </Text>
          <View style={[styles.group, { borderColor: glassBorder(0.1) }]}>
            {rows.map((row, index) => (
              <Pressable
                key={row.label}
                accessibilityRole="button"
                onPress={row.onPress}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: glassBorder(0.08),
                  },
                  pressed && { opacity: 0.72 },
                ]}>
                <View style={[styles.iconWell, { backgroundColor: `${row.tone}22` }]}>
                  <MaterialIcons name={row.icon} size={18} color={row.tone} />
                </View>
                <Text style={[styles.rowLabel, { color: c.text }]}>{row.label}</Text>
                <MaterialIcons name="chevron-right" size={20} color={c.textSubtle} />
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={dismiss}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cancel,
              { backgroundColor: `${primary}18`, borderColor: `${primary}44` },
              pressed && { opacity: 0.8 },
            ]}>
            <Text style={[styles.cancelLabel, { color: c.text }]}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** @internal test hook */
export function __openLegalLinksSheetForTests(): void {
  openLegalLinksSheet();
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cancel: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: space.sm,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  group: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: space.sm,
    overflow: 'hidden',
  },
  iconWell: {
    alignItems: 'center',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  sheet: {
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    gap: 6,
    overflow: 'hidden',
    paddingBottom: space.md,
    paddingHorizontal: space.md,
    paddingTop: space.lg,
  },
  sub: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});
