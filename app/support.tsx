/**
 * Support — selectable saved errors, screenshots, Resend feedback.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
import {
  clearErrorLog,
  ERROR_CATEGORY_LABEL,
  formatErrorForCopy,
  formatErrorLogForCopy,
  loadErrorLog,
  previewErrorLines,
  type AppErrorEntry,
} from '@/lib/errors/error-log';
import { friendlyErrorMessage } from '@/lib/errors/friendly-error';
import { sendSupportFeedback } from '@/lib/support/send-feedback';
import {
  MAX_SUPPORT_SHOTS,
  pickSupportScreenshot,
  type SupportShot,
} from '@/lib/support/upload-support-shot';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const { accentTheme, currentMember, household, redemptions } = useOrbit();
  const accent = accentTheme.primary;
  const [entries, setEntries] = useState<AppErrorEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shots, setShots] = useState<SupportShot[]>([]);

  const refresh = useCallback(async () => {
    const next = await loadErrorLog();
    setEntries(next);
    setSelectedIds((prev) => {
      if (prev.size === 0 && next[0]) return new Set([next[0]!.id]);
      const keep = new Set([...prev].filter((id) => next.some((e) => e.id === id)));
      if (keep.size === 0 && next[0]) keep.add(next[0].id);
      return keep;
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openTaskCount = useMemo(
    () =>
      household.tasks.filter(
        (t) => t.status !== 'Completed' && t.status !== 'Cancelled' && t.status !== 'Expired'
      ).length,
    [household.tasks]
  );
  const pendingRewardCount = useMemo(
    () => redemptions.filter((r) => r.status === 'pending').length,
    [redemptions]
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(entries.map((e) => e.id)));
  const selectNone = () => setSelectedIds(new Set());

  const onAddShot = async () => {
    if (shots.length >= MAX_SUPPORT_SHOTS) {
      orbitAlert('Limit reached', `You can attach up to ${MAX_SUPPORT_SHOTS} screenshots.`, undefined, {
        record: false,
      });
      return;
    }
    const shot = await pickSupportScreenshot();
    if (shot) setShots((prev) => [...prev, shot].slice(0, MAX_SUPPORT_SHOTS));
  };

  const onSend = async () => {
    setBusy(true);
    try {
      const result = await sendSupportFeedback({
        message: note.trim() || 'Support request from the Choremaxx app.',
        includeErrors: true,
        selectedErrorIds: [...selectedIds],
        memberName: currentMember?.name ?? undefined,
        householdId: household.id ?? undefined,
        diagnostics: {
          memberRole: currentMember?.role,
          openTaskCount,
          pendingRewardCount,
        },
        screenshots: shots,
      });
      if (result.ok) {
        setNote('');
        setShots([]);
        orbitAlert('Sent', 'Thanks — check your email for a confirmation.', undefined, {
          record: false,
        });
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
            Pick saved errors, add a screenshot if you want, then send.
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

            <Text style={[styles.cardLabel, { color: accent }]}>Screenshots</Text>
            <View style={styles.shotRow}>
              {shots.map((shot) => (
                <View key={shot.uri} style={styles.shotWrap}>
                  <Image source={{ uri: shot.uri }} style={styles.shot} />
                  <Pressable
                    onPress={() => setShots((prev) => prev.filter((s) => s.uri !== shot.uri))}
                    style={[styles.shotRemove, { backgroundColor: c.background }]}
                    hitSlop={6}
                    accessibilityLabel="Remove screenshot">
                    <MaterialIcons name="close" size={14} color={c.text} />
                  </Pressable>
                </View>
              ))}
              {shots.length < MAX_SUPPORT_SHOTS ? (
                <Pressable
                  onPress={() => void onAddShot()}
                  style={[
                    styles.shotAdd,
                    { borderColor: `${accent}66`, backgroundColor: `${accent}14` },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Add screenshot">
                  <Moji name="phone" size={22} />
                  <Text style={[styles.shotAddLabel, { color: accent }]}>Add</Text>
                </Pressable>
              ) : null}
            </View>

            <OrbitButton disabled={busy} onPress={() => void onSend()}>
              {busy
                ? 'Sending…'
                : `Send feedback${selectedIds.size ? ` · ${selectedIds.size} error${selectedIds.size === 1 ? '' : 's'}` : ''}`}
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
            {selectedIds.size ? ` · ${selectedIds.size} selected` : ''}
          </Text>
          <View style={styles.sectionActions}>
            {entries.length > 0 ? (
              <>
                <Pressable onPress={selectAll} hitSlop={8}>
                  <Text style={[styles.link, { color: accent }]}>All</Text>
                </Pressable>
                <Pressable onPress={selectNone} hitSlop={8}>
                  <Text style={[styles.link, { color: c.textMuted }]}>None</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void Clipboard.setStringAsync(
                      formatErrorLogForCopy(entries.filter((e) => selectedIds.has(e.id)))
                    );
                    orbitAlert('Copied', 'Selected errors copied.', undefined, { record: false });
                  }}
                  hitSlop={8}>
                  <Text style={[styles.link, { color: accent }]}>Copy</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    orbitAlert(
                      'Clear errors?',
                      'This only clears what’s saved on this device.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Clear',
                          style: 'destructive',
                          onPress: () => {
                            void clearErrorLog().then(() => {
                              setEntries([]);
                              setSelectedIds(new Set());
                            });
                          },
                        },
                      ],
                      { record: false }
                    );
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
              No errors saved yet. When something fails, it lands here — tap to attach it.
            </Text>
          </View>
        ) : (
          entries.map((entry, index) => {
            const open = expandedId === entry.id;
            const selected = selectedIds.has(entry.id);
            const preview = friendlyErrorMessage(previewErrorLines(entry, 2));
            const cat = ERROR_CATEGORY_LABEL[entry.category];
            return (
              <Animated.View
                key={entry.id}
                entering={FadeInDown.delay(60 + index * 30).duration(220)}
                style={[
                  styles.errCard,
                  {
                    backgroundColor: selected ? `${accent}14` : glass(0.05),
                    borderColor: selected ? `${accent}77` : glassBorder(0.1),
                  },
                ]}>
                <View style={styles.errHead}>
                  <Pressable
                    onPress={() => toggle(entry.id)}
                    hitSlop={8}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    style={[
                      styles.check,
                      {
                        borderColor: selected ? accent : glassBorder(0.22),
                        backgroundColor: selected ? accent : 'transparent',
                      },
                    ]}>
                    {selected ? <MaterialIcons name="check" size={14} color="#0B1220" /> : null}
                  </Pressable>
                  <Pressable
                    onPress={() => setExpandedId(open ? null : entry.id)}
                    style={{ flex: 1, gap: 4 }}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[styles.errTitle, { color: isDark ? '#F7F2EC' : c.text, flex: 1 }]}
                        numberOfLines={open ? 6 : 2}>
                        {entry.title || 'Error'}
                      </Text>
                      <View style={[styles.chip, { backgroundColor: `${accent}22` }]}>
                        <Text style={[styles.chipText, { color: accent }]}>{cat}</Text>
                      </View>
                    </View>
                    <Text
                      style={[styles.errPreview, { color: c.textMuted }]}
                      numberOfLines={open ? 8 : 2}>
                      {preview}
                    </Text>
                    <Text style={[styles.errMeta, { color: c.textSubtle }]}>
                      {entry.at.replace('T', ' ').slice(0, 19)}
                      {entry.source ? ` · ${entry.source}` : ''}
                    </Text>
                  </Pressable>
                  <MaterialIcons
                    name={open ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={c.textMuted}
                  />
                </View>
                {open ? (
                  <View style={styles.errActions}>
                    <Pressable
                      onPress={() => {
                        void Clipboard.setStringAsync(formatErrorForCopy(entry));
                        orbitAlert('Copied', 'This error was copied.', undefined, { record: false });
                      }}
                      style={[
                        styles.miniBtn,
                        { borderColor: `${accent}55`, backgroundColor: `${accent}18` },
                      ]}>
                      <MaterialIcons name="content-copy" size={14} color={accent} />
                      <Text style={[styles.miniLabel, { color: accent }]}>Copy</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setSelectedIds((prev) => new Set(prev).add(entry.id));
                        setNote((n) =>
                          n.trim()
                            ? n
                            : `I hit: ${entry.title || 'an error'} — ${friendlyErrorMessage(entry.message)}`
                        );
                      }}
                      style={[
                        styles.miniBtn,
                        { borderColor: glassBorder(0.12), backgroundColor: glass(0.06) },
                      ]}>
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
  back: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    minHeight: 44,
  },
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
  shotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shotWrap: { height: 72, position: 'relative', width: 72 },
  shot: { borderCurve: 'continuous', borderRadius: 14, height: 72, width: 72 },
  shotRemove: {
    alignItems: 'center',
    borderRadius: 10,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: -4,
    top: -4,
    width: 22,
  },
  shotAdd: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    gap: 2,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  shotAddLabel: { fontSize: 11, fontWeight: '800' },
  mailLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 36,
  },
  mailLabel: { fontSize: 13, fontWeight: '700' },
  sectionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionLabel: { flex: 1, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  sectionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-end' },
  link: { fontSize: 13, fontWeight: '700' },
  empty: { borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, padding: 16 },
  emptyText: { fontSize: 14, lineHeight: 20 },
  errCard: { borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, padding: 12 },
  errHead: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  check: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    marginTop: 2,
    width: 22,
  },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  errTitle: { fontSize: 15, fontWeight: '800' },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  errPreview: { fontSize: 13, lineHeight: 18 },
  errMeta: { fontSize: 11, fontWeight: '600' },
  errActions: { flexDirection: 'row', gap: 8, marginTop: 10, paddingLeft: 32 },
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
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
