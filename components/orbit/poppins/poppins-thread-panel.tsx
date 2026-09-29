/**
 * The typing thread. It takes the lower part of the body as a flex sibling of the stage —
 * it used to float over the stage as an absolute sheet and cover the bottom of the card.
 * Typed and spoken turns share one thread, each marked with a keyboard or mic glyph.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { space } from '@/constants/orbit-theme';
import type { PoppinsController } from '@/lib/poppins/use-poppins-controller';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const VISIBLE_TURNS = 16;

export function PoppinsThreadPanel({ p }: { p: PoppinsController }) {
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const { conversation, majordomo } = p;
  void p.sourceEpoch; // re-render when a turn's input source is recorded

  // Absolute user-turn ordinal for each message, so the glyph lands on the right bubble.
  const userOrdinals: number[] = [];
  let ordinal = 0;
  for (const message of conversation) {
    if (message.role === 'user') {
      userOrdinals.push(ordinal);
      ordinal += 1;
    } else {
      userOrdinals.push(-1);
    }
  }
  const recentStart = Math.max(0, conversation.length - VISIBLE_TURNS);
  const recent = conversation.slice(recentStart);
  const liveText = p.caption.text;

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: isDark ? 'rgba(10,14,20,0.96)' : 'rgba(247,245,242,0.97)',
          borderColor: glassBorder(0.12),
        },
      ]}>
      <ScrollView
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {conversation.length === 0 && !liveText ? (
          <Text style={[styles.hint, { color: isDark ? 'rgba(255,255,255,0.28)' : c.textMuted }]}>
            {p.idleHint}
          </Text>
        ) : null}
        {recent.map((message, index) => {
          const mine = message.role === 'user';
          const userOrdinal = userOrdinals[recentStart + index] ?? -1;
          const source = mine && userOrdinal >= 0 ? p.sourceByUserOrdinal.get(userOrdinal) : undefined;
          return (
            <View
              key={`${message.role}-${recentStart + index}`}
              style={[
                styles.bubble,
                mine ? styles.bubbleMine : styles.bubbleTheirs,
                {
                  backgroundColor: mine ? glass(0.08) : `${majordomo.accent}22`,
                  borderColor: mine ? glassBorder(0.12) : `${majordomo.accent}55`,
                },
              ]}>
              {mine && source ? (
                <View style={styles.bubbleMeta}>
                  <MaterialIcons
                    name={source === 'dictated' ? 'mic' : 'keyboard'}
                    size={12}
                    color={c.textSubtle}
                    accessibilityLabel={source === 'dictated' ? 'Spoken' : 'Typed'}
                  />
                </View>
              ) : null}
              <Text style={[styles.bubbleText, { color: c.text }]}>{message.content}</Text>
            </View>
          );
        })}
        {liveText ? (
          <View
            style={[
              styles.bubble,
              styles.bubbleTheirs,
              { backgroundColor: `${majordomo.accent}22`, borderColor: `${majordomo.accent}55` },
            ]}>
            <Text style={[styles.bubbleKicker, { color: majordomo.accent }]}>{p.caption.label}</Text>
            <Text style={[styles.bubbleText, { color: c.text }]}>{liveText}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[styles.composer, { backgroundColor: glass(0.06), borderColor: glassBorder(0.12) }]}>
        <TextInput
          value={p.draft}
          onChangeText={p.setDraft}
          placeholder={
            p.liveConnected ? 'Type into the live session…' : `Type to ${majordomo.displayName}…`
          }
          placeholderTextColor={c.textSubtle}
          style={[styles.input, { color: c.text }]}
          onSubmitEditing={() => void p.handleSend()}
          returnKeyType="send"
          accessibilityLabel={`Message ${majordomo.displayName}`}
        />
        <Pressable
          onPress={() => void p.handleSend()}
          accessibilityRole="button"
          accessibilityLabel="Send"
          hitSlop={6}
          style={[styles.send, { backgroundColor: p.draft.trim() ? '#38BDF8' : glass(0.08) }]}>
          <MaterialIcons name="send" size={16} color={p.draft.trim() ? '#041018' : c.textSubtle} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1.15,
    minHeight: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 8,
  },
  thread: { flex: 1 },
  threadContent: {
    flexGrow: 1,
    gap: 10,
    justifyContent: 'flex-end',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  hint: { fontSize: 14, letterSpacing: 0.2, textAlign: 'center' },
  bubble: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bubbleMine: { alignSelf: 'flex-end' },
  bubbleTheirs: { alignSelf: 'flex-start' },
  bubbleMeta: { marginBottom: 4 },
  bubbleKicker: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  composer: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: space.lg,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: { flex: 1, fontSize: 14, minHeight: 28, paddingVertical: 4 },
  send: {
    alignItems: 'center',
    borderRadius: 12,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
});
