/**
 * Support — error log, copy, and send feedback (Resend).
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
import {
  clearErrorLog,
  formatErrorForCopy,
  formatErrorLogForCopy,
  loadErrorLog,
  previewErrorLines,
  type AppErrorEntry,
} from '@/lib/errors/error-log';
import { friendlyErrorMessage } from '@/lib/errors/friendly-error';
import { sendSupportFeedback } from '@/lib/support/send-feedback';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { Linking } from 'react-native';

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const { accentTheme, currentMember, household } = useOrbit();
  const accent = accentTheme.primary;
  const [entries, setEntries] = useState<AppErrorEntry[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setEntries(await loadErrorLog());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSend = async () => {
    setBusy(true);
    try {
      const result = await sendSupportFeedback({
        message: note.trim() || 'Support request from the Choremaxx app.',
        includeErrors: true,
        memberName: currentMember?.name ?? undefined,
        householdId: household.id ?? undefined,
      });
      if (result.ok) {
        setNote('');
        orbitAlert('Sent', 'Thanks — we’ll take a look.', undefined, { record: false });
      } else {
        orbitAlert('Could not send', result.error, undefined, { record: true, source: 'support' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={22} color={accent} />
          <Text style={[styles.backLabel, { color: accent }]}>Settings</Text>
        </Pressable>
      </View>

      <PersistentScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        indicatorColor={accent}>
        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.header}>
          <Text style={[styles.eyebrow, { color: accent }]}>Help</Text>
          <Text style={[styles.title, { color: isDark ? '#F7F2EC' : c.text }]}>Support</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            Send us a note, or copy what’s saved on this device.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(40).duration(260)}>
          <LinearGradient
            colors={[`${accent}30`, `${accent}0A`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, { borderColor: `${accent}55` }]}>
            <Text style={[styles.cardLabel, { color: accent }]}>Message</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="What happened?"
              placeholderTextColor={c.textFaint}
              multiline
              style={[
                styles.input,
                {
                  color: isDark ? '#F7F2EC' : c.text,
                  backgroundColor: glassFill(isDark),
                  borderColor: glassBorder(0.1),
                },
              ]}
            />
            <OrbitButton disabled={busy} onPress={() => void onSend()}>
              {busy ? 'Sending…' : 'Send feedback'}
            </OrbitButton>
            <Pressable
              onPress={() => void Linking.openURL(`mailto:${CHOREMAXX_LEGAL.supportEmail}`)}
              style={styles.mailLink}
              hitSlop={8}>
              <MaterialIcons name="email" size={16} color={accent} />
              <Text style={[styles.mailLabel, { color: accent }]}>{CHOREMAXX_LEGAL.supportEmail}</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionLabel, { color: accent }]}>
            Saved errors · {entries.length}
          </Text>
          <View style={styles.sectionActions}>
            {entries.length > 0 ? (
              <>
                <Pressable
                  onPress={() => {
                    void Clipboard.setStringAsync(formatErrorLogForCopy(entries));
                    orbitAlert('Copied', 'Error log copied to the clipboard.', undefined, {
                      record: false,
                    });
                  }}
                  hitSlop={8}>
                  <Text style={[styles.link, { color: accent }]}>Copy all</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    orbitAlert('Clear errors?', 'This only clears what’s saved on this device.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Clear',
                        style: 'destructive',
                        onPress: () => {
                          void clearErrorLog().then(() => setEntries([]));
                        },
                      },
                    ], { record: false });
                  }}
                  hitSlop={8}>
                  <Text style={[styles.link, { color: c.danger }]}>Clear</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>

        {entries.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: glass(0.04), borderColor: glassBorder(0.1) }]}>
            <Text style={[styles.emptyText, { color: c.textMuted }]}>
              No errors saved yet. When something fails, it lands here.
            </Text>
          </View>
        ) : (
          entries.map((entry, index) => {
            const open = expandedId === entry.id;
            const preview = friendlyErrorMessage(previewErrorLines(entry, 2));
            return (
              <Animated.View
                key={entry.id}
                entering={FadeInDown.delay(60 + index * 30).duration(220)}
                style={[
                  styles.errCard,
                  { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) },
                ]}>
                <Pressable
                  onPress={() => setExpandedId(open ? null : entry.id)}
                  style={styles.errHead}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.errTitle, { color: isDark ? '#F7F2EC' : c.text }]} numberOfLines={open ? 6 : 2}>
                      {entry.title || 'Error'}
                    </Text>
                    <Text style={[styles.errPreview, { color: c.textMuted }]} numberOfLines={open ? 8 : 2}>
                      {preview}
                    </Text>
                    <Text style={[styles.errMeta, { color: c.textSubtle }]}>
                      {entry.at.replace('T', ' ').slice(0, 19)}
                      {entry.source ? ` · ${entry.source}` : ''}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={open ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={c.textMuted}
                  />
                </Pressable>
                {open ? (
                  <View style={styles.errActions}>
                    <Pressable
                      onPress={() => {
                        void Clipboard.setStringAsync(formatErrorForCopy(entry));
                        orbitAlert('Copied', 'This error was copied.', undefined, { record: false });
                      }}
                      style={[styles.miniBtn, { borderColor: `${accent}55`, backgroundColor: `${accent}18` }]}>
                      <MaterialIcons name="content-copy" size={14} color={accent} />
                      <Text style={[styles.miniLabel, { color: accent }]}>Copy</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setNote((n) =>
                          n.trim()
                            ? n
                            : `I hit: ${entry.title || 'an error'} — ${friendlyErrorMessage(entry.message)}`
                        );
                      }}
                      style={[styles.miniBtn, { borderColor: glassBorder(0.12), backgroundColor: glass(0.06) }]}>
                      <MaterialIcons name="feedback" size={14} color={c.textSoft} />
                      <Text style={[styles.miniLabel, { color: c.textSoft }]}>Use in note</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Animated.View>
            );
          })
        )}
      </PersistentScrollView>
      {busy ? (
        <View style={styles.busyOverlay} pointerEvents="none">
          <ActivityIndicator color={accent} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingVertical: 4 },
  back: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 2, minHeight: 44 },
  backLabel: { fontSize: 16, fontWeight: '700' },
  content: { gap: 14, paddingHorizontal: 20, paddingTop: 4 },
  header: { gap: 4 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  card: { borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, gap: 12, padding: 16 },
  cardLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  input: {
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    fontWeight: '600',
    minHeight: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  mailLink: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 36 },
  mailLabel: { fontSize: 13, fontWeight: '700' },
  sectionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  sectionActions: { flexDirection: 'row', gap: 14 },
  link: { fontSize: 13, fontWeight: '700' },
  empty: { borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, padding: 16 },
  emptyText: { fontSize: 14, lineHeight: 20 },
  errCard: { borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, padding: 12 },
  errHead: { flexDirection: 'row', gap: 8 },
  errTitle: { fontSize: 15, fontWeight: '800' },
  errPreview: { fontSize: 13, lineHeight: 18 },
  errMeta: { fontSize: 11, fontWeight: '600' },
  errActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  miniBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  miniLabel: { fontSize: 13, fontWeight: '700' },
  busyOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
  },
});
