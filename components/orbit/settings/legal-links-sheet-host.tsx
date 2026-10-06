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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import {
  FrostedPanel,
  frostedBackdropColor,
  frostedGroupFill,
  frostedHairline,
} from '@/components/orbit/frosted-panel';
import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
import { radius, space, typography } from '@/constants/orbit-theme';
import { openChoremaxxUrl } from '@/lib/legal/open-choremaxx-url';
import { SESSION_NAV_DELAY_MS } from '@/lib/navigation/session-restart';
import {
  closeLegalLinksSheet,
  openLegalLinksSheet,
  subscribeLegalLinksSheet,
} from '@/lib/ui/legal-links-sheet-controller';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';

type Row = {
  icon: keyof typeof MaterialIcons.glyphMap;
  tone: string;
  label: string;
  external: boolean;
  onPress: () => void;
};

const ICON_WELL = 32;
const ROW_PAD_X = 14;
const ROW_GAP = 12;
const SEPARATOR_INSET = ROW_PAD_X + ICON_WELL + ROW_GAP;

type PendingAction = (() => void) | null;

/** Match orbitAlert: Android often skips Modal.onDismiss. */
const LEGAL_SHEET_DISMISS_MS = SESSION_NAV_DELAY_MS;

export function LegalLinksSheetHost() {
  const [visible, setVisible] = useState(false);
  const pendingAction = useRef<PendingAction>(null);
  const flushedRef = useRef(false);
  const { c, isDark } = useOrbitColors();
  const insets = useSafeAreaInsets();
  const orbit = useOrbitOptional();
  const primary = orbit?.accentTheme.primary ?? c.primary;
  const hairline = frostedHairline(isDark);
  const pressedFill = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 28, 42, 0.05)';

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
      external: true,
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
      external: true,
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
      external: false,
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
        <View
          style={[styles.center, { paddingBottom: Math.max(insets.bottom, space.md) + space.xs }]}
          pointerEvents="box-none">
          <Animated.View
            entering={FadeInDown.duration(260).springify().damping(18)}
            style={styles.stack}>
            <FrostedPanel borderColor={hairline}>
              <LinearGradient
                colors={[`${primary}14`, 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.6 }}
                style={styles.sheetWash}
                pointerEvents="none"
              />
              <View style={styles.sheetInner}>
                <View style={styles.heading}>
                  <Text style={[typography.title3, { color: c.text }]}>Privacy & legal</Text>
                  <Text style={[typography.footnote, { color: c.textMuted }]}>
                    Policies open in your browser. Support stays in the app.
                  </Text>
                </View>
                <View
                  style={[
                    styles.group,
                    { backgroundColor: frostedGroupFill(isDark), borderColor: hairline },
                  ]}>
                  {rows.map((row, index) => (
                    <View key={row.label}>
                      {index > 0 ? (
                        <View style={[styles.separator, { backgroundColor: hairline }]} />
                      ) : null}
                      <Pressable
                        accessibilityRole={row.external ? 'link' : 'button'}
                        accessibilityHint={row.external ? 'Opens in your browser' : undefined}
                        onPress={row.onPress}
                        style={({ pressed }) => [
                          styles.row,
                          pressed && { backgroundColor: pressedFill },
                        ]}>
                        <View style={[styles.iconWell, { backgroundColor: `${row.tone}22` }]}>
                          <MaterialIcons name={row.icon} size={18} color={row.tone} />
                        </View>
                        <Text style={[styles.rowLabel, { color: c.text }]} numberOfLines={1}>
                          {row.label}
                        </Text>
                        <MaterialIcons
                          name={row.external ? 'open-in-new' : 'chevron-right'}
                          size={row.external ? 16 : 20}
                          color={c.textSubtle}
                        />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            </FrostedPanel>

            <FrostedPanel borderColor={hairline}>
              <Pressable
                onPress={dismiss}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={({ pressed }) => [styles.cancel, pressed && { backgroundColor: pressedFill }]}>
                <Text style={[styles.cancelLabel, { color: c.text }]}>Cancel</Text>
              </Pressable>
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
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: space.md,
  },
  cancelLabel: {
    ...typography.headline,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: space.lg,
  },
  group: {
    borderCurve: 'continuous',
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  heading: {
    gap: space.xxs,
    paddingHorizontal: space.xxs,
  },
  iconWell: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 10,
    height: ICON_WELL,
    justifyContent: 'center',
    width: ICON_WELL,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ROW_GAP,
    minHeight: 56,
    paddingHorizontal: ROW_PAD_X,
    paddingVertical: space.sm,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: SEPARATOR_INSET,
  },
  sheetInner: {
    gap: space.md,
    padding: space.md,
    paddingTop: space.lg,
  },
  sheetWash: {
    ...StyleSheet.absoluteFill,
  },
  stack: {
    alignSelf: 'center',
    gap: space.xs,
    maxWidth: 520,
    width: '100%',
  },
});
