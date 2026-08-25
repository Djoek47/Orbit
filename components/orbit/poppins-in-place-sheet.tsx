import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { PoppinsOrb } from '@/components/orbit/poppins-orb';
import { PoppinsStage } from '@/components/orbit/poppins-stage';
import { usePoppinsLive } from '@/lib/poppins/live-context';
import { usePoppinsUiDrive } from '@/lib/poppins/ui-orchestrator';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

/** Compact Ask Poppins — stays on the current screen while the tab button animates. */
export function PoppinsInPlaceSheet() {
  const live = usePoppinsLive();
  const drive = usePoppinsUiDrive();
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const [draft, setDraft] = useState('');

  if (!live?.sheetOpen) return null;

  const busy = live.visual === 'connecting' || live.visual === 'thinking';
  const orbState =
    live.visual === 'idle'
      ? 'idle'
      : live.visual === 'connecting' || live.visual === 'thinking'
        ? 'thinking'
        : live.visual;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) + 72 }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: c.backgroundSoft, borderColor: glassBorder(0.14) },
        ]}>
        <View style={styles.head}>
          <PoppinsOrb size={44} state={orbState} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: c.textSubtle }]}>POPPINS</Text>
            <Text style={[styles.status, { color: c.text }]}>
              {live.visual === 'connecting'
                ? 'Tuning in…'
                : live.visual === 'listening'
                  ? 'Listening'
                  : live.visual === 'thinking'
                    ? 'Thinking…'
                    : live.visual === 'speaking'
                      ? 'Speaking'
                      : live.nativeVoice
                        ? 'Ask without leaving this screen'
                        : 'Type — voice needs TestFlight'}
            </Text>
          </View>
          <Pressable onPress={() => void live.stop()} hitSlop={8}>
            <Text style={{ color: c.accent, fontWeight: '700' }}>Done</Text>
          </Pressable>
        </View>
        {live.caption && !drive.live ? (
          <Text style={[styles.caption, { color: c.textMuted }]} numberOfLines={4}>
            {live.caption}
          </Text>
        ) : null}
        {drive.live ? (
          <View style={styles.stage}>
            <PoppinsStage />
          </View>
        ) : null}
        {live.error ? (
          <Text style={[styles.caption, { color: c.danger }]}>{live.error}</Text>
        ) : null}
        <View style={styles.row}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask Poppins…"
            placeholderTextColor={c.textFaint}
            onSubmitEditing={() => {
              const next = draft;
              setDraft('');
              void live.sendText(next);
            }}
            style={[
              styles.input,
              { color: c.text, backgroundColor: glass(0.06), borderColor: glassBorder(0.1) },
            ]}
          />
          <Pressable
            onPress={() => {
              const next = draft;
              setDraft('');
              void live.sendText(next);
            }}
            disabled={busy || !draft.trim()}
            style={[styles.send, { backgroundColor: glass(0.08) }]}>
            {busy ? (
              <ActivityIndicator color={c.accent} />
            ) : (
              <Text style={{ color: c.accent, fontWeight: '800' }}>Send</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    zIndex: 40,
  },
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 14,
  },
  head: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  status: { fontSize: 15, fontWeight: '700' },
  caption: { fontSize: 14, lineHeight: 20 },
  stage: { minHeight: 220, width: '100%' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  input: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  send: { borderRadius: 14, minWidth: 64, paddingHorizontal: 12, paddingVertical: 12 },
});
