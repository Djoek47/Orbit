/**
 * Typing mode for Poppins — the IUI-first composer.
 *
 * People who can't (or won't) speak still need the stage: the grocery card, Add now, HOLD.
 * The old layout gave the thread most of the body (flex 4) and left the stage a sliver under
 * the keyboard, so taps on Add now missed and the chat looked like empty purple pills.
 *
 * Rules:
 *   - When a card is live, the stage owns the screen; this panel is a compact composer strip.
 *   - Done dismisses the keyboard without leaving typing mode.
 *   - Speak leaves typing for voice.
 *   - Empty assistant turns are never drawn (they were the hollow ovals).
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useRef } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { KEYBOARD_DONE_ID } from '@/components/orbit/keyboard-done-accessory';
import { space } from '@/constants/orbit-theme';
import type { PoppinsController } from '@/lib/poppins/use-poppins-controller';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const HISTORY_WHEN_STAGE = 2;
const HISTORY_WHEN_IDLE = 10;

export function PoppinsThreadPanel({
  p,
  keyboardUp,
  stageLive,
}: {
  p: PoppinsController;
  /** Soft keyboard is showing. */
  keyboardUp?: boolean;
  /** An IUI card is on stage — keep this panel compact so the card stays usable. */
  stageLive?: boolean;
}) {
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const { conversation, majordomo } = p;
  const inputRef = useRef<RNTextInput>(null);
  void p.sourceEpoch;

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

  // Skip blank assistant shells — those rendered as empty purple ovals.
  const visible = conversation
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message.role === 'user' || Boolean(message.content?.trim()));

  const historyCap = stageLive ? HISTORY_WHEN_STAGE : HISTORY_WHEN_IDLE;
  const recent = visible.slice(Math.max(0, visible.length - historyCap));
  const liveText = (p.caption.text ?? '').trim();

  useEffect(() => {
    if (!stageLive) return;
    // A card just landed — get the keyboard out of the way so Add now / HOLD are tappable.
    Keyboard.dismiss();
  }, [stageLive]);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    inputRef.current?.blur();
  };

  const leaveTyping = () => {
    dismissKeyboard();
    p.setThreadOpen(false);
  };

  const compact = Boolean(stageLive);

  return (
    <View
      style={[
        styles.panel,
        compact ? styles.panelCompact : styles.panelIdle,
        keyboardUp && !compact && styles.panelIdleKeyboard,
        {
          backgroundColor: isDark ? 'rgba(18, 14, 12, 0.98)' : 'rgba(250, 247, 242, 0.98)',
          borderColor: glassBorder(0.14),
        },
      ]}
      accessibilityLabel={compact ? 'Type while the card is open' : 'Type to Poppins'}>
      <View style={styles.toolbar}>
        <Text style={[styles.toolbarTitle, { color: c.textMuted }]}>
          {compact ? 'Type a change' : `Chat with ${majordomo.displayName}`}
        </Text>
        <View style={styles.toolbarActions}>
          {keyboardUp ? (
            <Pressable
              onPress={dismissKeyboard}
              accessibilityRole="button"
              accessibilityLabel="Hide keyboard"
              hitSlop={8}
              style={[styles.toolBtn, { backgroundColor: glass(0.08), borderColor: glassBorder(0.12) }]}>
              <MaterialIcons name="keyboard-hide" size={16} color={c.text} />
              <Text style={[styles.toolBtnLabel, { color: c.text }]}>Done</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={leaveTyping}
            accessibilityRole="button"
            accessibilityLabel="Close typing and go back to speaking"
            hitSlop={8}
            style={[styles.toolBtn, { backgroundColor: glass(0.08), borderColor: glassBorder(0.12) }]}>
            <MaterialIcons name="mic" size={16} color={c.text} />
            <Text style={[styles.toolBtnLabel, { color: c.text }]}>Speak</Text>
          </Pressable>
        </View>
      </View>

      {!compact ? (
        <ScrollView
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {recent.length === 0 && !liveText ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: c.text }]}>Type what you need</Text>
              <Text style={[styles.emptyBody, { color: c.textMuted }]}>
                Same as speaking — groceries, chores, plans. The card appears above; tap Done to
                hide the keyboard and use it.
              </Text>
            </View>
          ) : null}
          {recent.map(({ message, index }) => {
            const mine = message.role === 'user';
            const userOrdinal = userOrdinals[index] ?? -1;
            const source =
              mine && userOrdinal >= 0 ? p.sourceByUserOrdinal.get(userOrdinal) : undefined;
            return (
              <View
                key={`${message.role}-${index}`}
                style={[
                  styles.bubble,
                  mine ? styles.bubbleMine : styles.bubbleTheirs,
                  {
                    backgroundColor: mine ? glass(0.1) : `${majordomo.accent}18`,
                    borderColor: mine ? glassBorder(0.14) : `${majordomo.accent}44`,
                  },
                ]}>
                {mine && source ? (
                  <View style={styles.bubbleMeta}>
                    <MaterialIcons
                      name={source === 'dictated' ? 'mic' : 'keyboard'}
                      size={12}
                      color={c.textSubtle}
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
                { backgroundColor: `${majordomo.accent}18`, borderColor: `${majordomo.accent}44` },
              ]}>
              <Text style={[styles.bubbleKicker, { color: majordomo.accent }]}>
                {p.caption.label}
              </Text>
              <Text style={[styles.bubbleText, { color: c.text }]}>{liveText}</Text>
            </View>
          ) : null}
        </ScrollView>
      ) : recent.length > 0 || liveText ? (
        <View style={styles.compactHistory}>
          {(liveText
            ? [{ role: 'assistant' as const, content: liveText }]
            : recent.slice(-1).map((r) => r.message)
          ).map((message, i) => (
            <Text
              key={`compact-${i}`}
              numberOfLines={2}
              style={[styles.compactLine, { color: c.textMuted }]}>
              {message.role === 'user' ? 'You: ' : ''}
              {message.content}
            </Text>
          ))}
        </View>
      ) : null}

      <View
        style={[
          styles.composer,
          {
            backgroundColor: glass(0.07),
            borderColor: glassBorder(0.14),
          },
        ]}>
        <TextInput
          ref={inputRef}
          value={p.draft}
          onChangeText={p.setDraft}
          placeholder={
            compact
              ? 'Add a detail, or type the next thing…'
              : p.liveConnected
                ? 'Type into the live session…'
                : `Type to ${majordomo.displayName}…`
          }
          placeholderTextColor={c.textSubtle}
          style={[styles.input, { color: c.text }]}
          onSubmitEditing={() => void p.handleSend()}
          returnKeyType="send"
          blurOnSubmit={false}
          inputAccessoryViewID={KEYBOARD_DONE_ID}
          accessibilityLabel={`Message ${majordomo.displayName}`}
        />
        <Pressable
          onPress={() => void p.handleSend()}
          accessibilityRole="button"
          accessibilityLabel="Send"
          hitSlop={6}
          style={[
            styles.send,
            { backgroundColor: p.draft.trim() ? '#FF7A45' : glass(0.1) },
          ]}>
          <MaterialIcons
            name="arrow-upward"
            size={18}
            color={p.draft.trim() ? '#041018' : c.textSubtle}
          />
        </Pressable>
      </View>
      {compact ? (
        <Text style={[styles.compactHint, { color: c.textSubtle }]}>
          Use the card above — Done hides the keyboard so Add now and HOLD work.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    minHeight: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
  },
  /** Idle typing studio — room to chat, not a black void. */
  panelIdle: { flex: 1.1 },
  panelIdleKeyboard: { flex: 1.4 },
  /** Card on stage — composer strip only, stage keeps the taps. */
  panelCompact: { flexGrow: 0, flexShrink: 0 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    gap: 8,
  },
  toolbarTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  toolBtnLabel: { fontSize: 13, fontWeight: '700' },
  thread: { flex: 1, minHeight: 0 },
  threadContent: {
    flexGrow: 1,
    gap: 10,
    justifyContent: 'flex-end',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  empty: { gap: 8, paddingHorizontal: 8, paddingBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  bubble: {
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: '88%',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  bubbleMine: { alignSelf: 'flex-end' },
  bubbleTheirs: { alignSelf: 'flex-start' },
  bubbleMeta: { marginBottom: 4 },
  bubbleKicker: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  compactHistory: {
    paddingHorizontal: space.lg,
    paddingBottom: 2,
  },
  compactLine: { fontSize: 13, lineHeight: 18 },
  composer: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: space.lg,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  input: { flex: 1, fontSize: 16, minHeight: 28, paddingVertical: 4, fontWeight: '500' },
  send: {
    alignItems: 'center',
    borderRadius: 14,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  compactHint: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    paddingHorizontal: space.lg,
  },
});
