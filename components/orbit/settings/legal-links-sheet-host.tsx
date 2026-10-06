/**
 * Root-level Privacy & legal sheet — frosted glass, opens browser / Support
 * only after this Modal has fully dismissed (never nests WebBrowser or
 * router.push over a closing Modal — that left Home untouchable on TestFlight).
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { FrostedPanel, frostedBackdropColor } from '@/components/orbit/frosted-panel';
import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
import { radius, space, typography } from '@/constants/orbit-theme';
import { openChoremaxxUrl } from '@/lib/legal/open-choremaxx-url';
import { SESSION_NAV_DELAY_MS } from '@/lib/navigation/session-restart';
import {
  closeLegalLinksSheet,
  openLegalLinksSheet,
  subscribeLegalLinksSheet,
} from '@/lib/ui/legal-links-sheet-controller';
import { glassBorder, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';

type Row = {
  icon: keyof typeof MaterialIcons.glyphMap;
  tone: string;
  label: string;
  onPress: () => void;
};

type PendingAction = (() => void) | null;

/** Match orbitAlert: Android often skips Modal.onDismiss. */
const LEGAL_SHEET_DISMISS_MS = SESSION_NAV_DELAY_MS;

export function LegalLinksSheetHost() {
  const [visible, setVisible] = useState(false);
  const pendingAction = useRef<PendingAction>(null);
  const flushedRef = useRef(false);
  const { c, isDark } = useOrbitColors();
  const orbit = useOrbitOptional();
  const primary = orbit?.accentTheme.primary ?? c.primary;

  useEffect(() => subscribeLegalLinksSheet(setVisible), []);

  const flushAfterDismiss = useCallback(() => {
    if (flushedRef.current) return;
    flushedRef.current = true;
    const next = pendingAction.current;
    pendingAction.current = null;
    if (!next) return;
    // Two frames past native dismiss — safe for SFSafariViewController / router.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          next();
        } catch (error) {
          console.warn('legalLinksSheet.action', error);
        }
      });
    });
  }, []);

  // Android / some hosts skip onDismiss — still run after the fade.
  useEffect(() => {
    if (visible) {
      flushedRef.current = false;
      return;
    }
    const handle = setTimeout(flushAfterDismiss, LEGAL_SHEET_DISMISS_MS);
    return () => clearTimeout(handle);
  }, [visible, flushAfterDismiss]);

  /** Close sheet; optional follow-up runs only after Modal dismiss settles. */
  const beginDismiss = useCallback((action?: () => void) => {
    pendingAction.current = action ?? null;
    flushedRef.current = false;
    closeLegalLinksSheet();
  }, []);

  const dismiss = () => {
    beginDismiss(undefined);
  };

  const rows: Row[] = [
    {
      icon: 'policy',
      tone: '#34D399',
      label: 'Privacy Policy',
      onPress: () => {
        beginDismiss(() => {
          void openChoremaxxUrl(CHOREMAXX_LEGAL.privacyUrl, 'Privacy Policy');
        });
      },
    },
    {
      icon: 'gavel',
      tone: '#38BDF8',
      label: 'Terms of Service',
      onPress: () => {
        beginDismiss(() => {
          void openChoremaxxUrl(CHOREMAXX_LEGAL.termsUrl, 'Terms of Service');
        });
      },
    },
    {
      icon: 'mail-outline',
      tone: '#FF8A3D',
      label: 'Contact support',
      onPress: () => {
        beginDismiss(() => {
          try {
            router.push('/support' as never);
          } catch {
            void openChoremaxxUrl(`mailto:${CHOREMAXX_LEGAL.supportEmail}`, 'Support');
          }
        });
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
      onRequestClose={dismiss}
      onDismiss={flushAfterDismiss}>
      <View style={styles.frame}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: frostedBackdropColor(isDark) }]}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss Privacy and legal">
          <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill} />
        </Pressable>
        <View style={styles.center} pointerEvents="box-none">
          <Animated.View entering={FadeInDown.duration(260).springify().damping(18)}>
            <FrostedPanel borderColor={`${primary}66`} style={styles.sheet}>
              <LinearGradient
                colors={[`${primary}33`, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sheetGlow}
                pointerEvents="none"
              />
              <View style={styles.sheetInner}>
                <Text style={[typography.headline, { color: c.text }]}>Privacy & legal</Text>
                <Text style={[styles.sub, { color: c.textMuted }]}>
                  Privacy and Terms open in your browser. Support opens in the app.
                </Text>
                <View style={[styles.group, { borderColor: glassBorder(isDark, 0.14) }]}>
                  {rows.map((row, index) => (
                    <Pressable
                      key={row.label}
                      accessibilityRole="button"
                      onPress={row.onPress}
                      style={({ pressed }) => [
                        styles.row,
                        index > 0 && {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: glassBorder(isDark, 0.1),
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
                    { backgroundColor: `${primary}22`, borderColor: `${primary}55` },
                    pressed && { opacity: 0.8 },
                  ]}>
                  <Text style={[styles.cancelLabel, { color: c.text }]}>Cancel</Text>
                </Pressable>
              </View>
            </FrostedPanel>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

/** @internal test hook */
export function __openLegalLinksSheetForTests(): void {
  openLegalLinksSheet();
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
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
    backgroundColor: 'rgba(0,0,0,0.22)',
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
    // FrostedPanel owns radius/border; keep padding on inner.
  },
  sheetGlow: {
    ...StyleSheet.absoluteFill,
  },
  sheetInner: {
    gap: 6,
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
