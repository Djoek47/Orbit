import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLegalFooter } from '@/components/orbit/brand-legal-footer';
import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { orbitColors, radius, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';

type AuthShellProps = {
  children: ReactNode;
  /** Small uppercase kicker above the title */
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Show Choremaxx brand mark above the title (welcome / primary entry). */
  brandHero?: boolean;
  showBack?: boolean;
  footer?: ReactNode;
  /** Append © / Privacy / Terms under the card (default on). */
  showLegal?: boolean;
};

/** Shared Choremaxx chrome for auth / onboarding side screens — Design 8 glass. */
export function AuthShell({
  children,
  kicker,
  title,
  subtitle,
  brandHero = false,
  showBack = false,
  footer,
  showLegal = true,
}: AuthShellProps) {
  const insets = useSafeAreaInsets();
  const { c } = useOrbitColors();
  const orbit = useOrbitOptional();
  const primary = orbit?.accentTheme.primary ?? orbitColors.primary;
  const secondary = orbit?.accentTheme.secondary ?? orbitColors.orbitBlueDeep;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <LinearGradient
        colors={[`${primary}33`, `${secondary}14`, 'transparent']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.ambient}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', `${primary}0A`]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.ambientFloor}
        pointerEvents="none"
      />
      <KeyboardScreen
        offset={showBack ? 8 : 0}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (showBack ? 8 : 28),
            paddingBottom: insets.bottom + 28,
          },
        ]}>
        {showBack ? (
          <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
            <MaterialIcons name="chevron-left" size={20} color={primary} />
            <Text style={[styles.backText, { color: primary }]}>Back</Text>
          </Pressable>
        ) : null}

        {brandHero ? (
          <View style={styles.brandBlock}>
            <ChoremaxxLogo size="lg" />
            <Text style={[styles.brandTag, { color: c.textMuted }]}>AI Household OS</Text>
          </View>
        ) : (
          <View style={styles.logoRow}>
            <ChoremaxxLogo size="sm" />
          </View>
        )}

        <View style={styles.header}>
          {kicker ? <Text style={[styles.kicker, { color: secondary }]}>{kicker}</Text> : null}
          <Text style={[typography.title1, styles.title, { color: c.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: c.textSoft }]}>{subtitle}</Text>
          ) : null}
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: c.cardStrong,
              borderColor: c.borderStrong,
            },
          ]}>
          <View
            style={[styles.cardInset, { borderColor: 'rgba(255,255,255,0.06)' }]}
            pointerEvents="none"
          />
          {children}
        </View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
        {showLegal ? <BrandLegalFooter compact showLogo={false} style={styles.legal} /> : null}
      </KeyboardScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  ambient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  ambientFloor: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  content: {
    paddingHorizontal: 20,
    gap: 18,
    flexGrow: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    marginBottom: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
  },
  brandBlock: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  logoRow: {
    alignItems: 'flex-start',
  },
  brandTag: {
    fontSize: 13,
    fontWeight: '600',
  },
  header: {
    gap: 8,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: 1,
    gap: 14,
    overflow: 'hidden',
    padding: 18,
    position: 'relative',
  },
  cardInset: {
    ...StyleSheet.absoluteFillObject,
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge - 1,
    borderWidth: StyleSheet.hairlineWidth,
    margin: 1,
  },
  footer: {
    gap: 10,
    marginTop: 'auto',
    paddingTop: 8,
  },
  legal: {
    marginTop: 8,
    paddingBottom: 4,
  },
});
