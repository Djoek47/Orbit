import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { orbitColors } from '@/constants/orbit-theme';
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
};

/** Shared Choremaxx chrome for auth / onboarding side screens. */
export function AuthShell({
  children,
  kicker,
  title,
  subtitle,
  brandHero = false,
  showBack = false,
  footer,
}: AuthShellProps) {
  const insets = useSafeAreaInsets();
  const orbit = useOrbitOptional();
  const primary = orbit?.accentTheme.primary ?? orbitColors.primary;
  const secondary = orbit?.accentTheme.secondary ?? orbitColors.orbitBlueDeep;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[`${primary}22`, 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.ambient}
        pointerEvents="none"
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (showBack ? 8 : 28),
            paddingBottom: insets.bottom + 28,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {showBack ? (
          <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
            <MaterialIcons name="chevron-left" size={20} color={primary} />
            <Text style={[styles.backText, { color: primary }]}>Back</Text>
          </Pressable>
        ) : null}

        {brandHero ? (
          <View style={styles.brandBlock}>
            <ChoremaxxLogo size="lg" />
            <Text style={styles.brandTag}>AI Household OS</Text>
          </View>
        ) : (
          <View style={styles.logoRow}>
            <ChoremaxxLogo size="sm" />
          </View>
        )}

        <View style={styles.header}>
          {kicker ? <Text style={[styles.kicker, { color: secondary }]}>{kicker}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.card}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: orbitColors.background,
  },
  ambient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
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
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  header: {
    gap: 8,
  },
  kicker: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    color: orbitColors.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    color: orbitColors.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  footer: {
    gap: 10,
    marginTop: 'auto',
    paddingTop: 8,
  },
});
