/**
 * Polished auth failure banner — title, message, optional actions.
 * Use across sign-in, welcome, confirm-email, forgot-password.
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import {
  AUTH_ISSUES,
  looksLikeTechnicalDump,
  type AuthIssue,
} from '@/lib/auth/auth-errors';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type AuthErrorBannerProps = {
  issue: AuthIssue | null | undefined;
  /** Extra query params when following confirm-email, etc. */
  actionParams?: Record<string, string>;
  onDismiss?: () => void;
};

export function AuthErrorBanner({ issue, actionParams, onDismiss }: AuthErrorBannerProps) {
  const { c, glass, glassBorder } = useOrbitColors();
  if (!issue) return null;
  const display =
    looksLikeTechnicalDump(issue.message) || looksLikeTechnicalDump(issue.title)
      ? AUTH_ISSUES[issue.code] ?? AUTH_ISSUES.generic
      : issue;

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.wrap,
        {
          backgroundColor: `${c.danger}14`,
          borderColor: `${c.danger}44`,
        },
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: `${c.danger}22` }]}>
        <MaterialIcons name="error-outline" size={18} color={c.danger} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: c.text }]}>{display.title}</Text>
        <Text style={[styles.message, { color: c.textMuted }]} numberOfLines={5}>
          {display.message}
        </Text>
        {display.supportCode ? (
          <Text style={[styles.supportCode, { color: c.textSubtle }]}>
            Support {display.supportCode}
          </Text>
        ) : null}
        {display.actions && display.actions.length > 0 ? (
          <View style={styles.actions}>
            {display.actions.map((action) => (
              <Pressable
                key={`${action.label}-${action.href ?? 'x'}`}
                onPress={() => {
                  if (!action.href) return;
                  if (action.href === '/confirm-email' && actionParams?.email) {
                    router.push({
                      pathname: '/confirm-email',
                      params: actionParams,
                    } as never);
                    return;
                  }
                  router.push(action.href as never);
                }}
                style={[
                  styles.actionChip,
                  {
                    backgroundColor: glass(0.06),
                    borderColor: glassBorder(0.12),
                  },
                ]}>
                <Text style={[styles.actionText, { color: c.primary }]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityLabel="Dismiss"
          style={styles.dismiss}>
          <MaterialIcons name="close" size={16} color={c.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  body: { flex: 1, gap: 4, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  message: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  supportCode: { fontSize: 11, fontWeight: '500', marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  actionChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: { fontSize: 12, fontWeight: '700' },
  dismiss: { padding: 2, marginTop: 2 },
});
