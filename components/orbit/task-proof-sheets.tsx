/**
 * iOS 2026-style proof sheets for task detail.
 * - Admin: request a photo from a Sidekick (optional coaching note)
 * - Sidekick: reply with camera / library and optional note
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { radius, space, typography } from '@/constants/orbit-theme';
import { pickProofPhoto } from '@/lib/tasks/pick-proof';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type RequestProps = {
  visible: boolean;
  taskTitle: string;
  sidekickName: string;
  busy?: boolean;
  onDismiss: () => void;
  onSend: (note?: string) => void | Promise<void>;
};

type ReplyProps = {
  visible: boolean;
  taskTitle: string;
  adminNote?: string | null;
  busy?: boolean;
  onDismiss: () => void;
  onSubmit: (input: { proofUri?: string; note?: string }) => void | Promise<void>;
};

export function TaskProofRequestSheet({
  visible,
  taskTitle,
  sidekickName,
  busy = false,
  onDismiss,
  onSend,
}: RequestProps) {
  const { c, glass, glassBorder } = useOrbitColors();
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) setNote('');
  }, [visible]);

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} heightRatio={0.5}>
      <View style={styles.body}>
        <View style={[styles.iconBubble, { backgroundColor: `${c.primary}22` }]}>
          <MaterialIcons name="photo-camera" size={28} color={c.primary} />
        </View>
        <Text style={[typography.title2, { color: c.text, textAlign: 'center' }]}>
          Ask for a photo
        </Text>
        <Text style={[typography.subheadline, styles.lead, { color: c.textSoft }]}>
          {sidekickName} already finished “{taskTitle}”. They’ll get a notification, and the task will ask them for a picture.
        </Text>

        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Note, if you want</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Show the sink after you wipe it"
          placeholderTextColor={c.textSubtle}
          multiline
          style={[
            styles.noteInput,
            {
              color: c.text,
              backgroundColor: glass(0.06),
              borderColor: glassBorder(0.12),
            },
          ]}
        />

        <OrbitButton
          loading={busy}
          disabled={busy}
          onPress={() => void onSend(note.trim() || undefined)}>
          Request a photo
        </OrbitButton>
        <OrbitButton tone="secondary" disabled={busy} onPress={onDismiss}>
          Not now
        </OrbitButton>
      </View>
    </BottomSheet>
  );
}

export function TaskProofReplySheet({
  visible,
  taskTitle,
  adminNote,
  busy = false,
  onDismiss,
  onSubmit,
}: ReplyProps) {
  const { c, glass, glassBorder } = useOrbitColors();
  const [note, setNote] = useState('');
  const [uri, setUri] = useState<string | null>(null);
  const [picking, setPicking] = useState<'camera' | 'library' | null>(null);

  useEffect(() => {
    if (!visible) {
      setNote('');
      setUri(null);
      setPicking(null);
    }
  }, [visible]);

  const pick = async (source: 'camera' | 'library') => {
    setPicking(source);
    try {
      const next = await pickProofPhoto(source);
      if (next) setUri(next);
    } finally {
      setPicking(null);
    }
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} heightRatio={0.72}>
      <View style={styles.body}>
        <View style={[styles.iconBubble, { backgroundColor: `${c.primary}22` }]}>
          <MaterialIcons name="photo-camera" size={28} color={c.primary} />
        </View>
        <Text style={[typography.title2, { color: c.text, textAlign: 'center' }]}>
          Add a photo
        </Text>
        <Text style={[typography.subheadline, styles.lead, { color: c.textSoft }]}>
          Show that “{taskTitle}” is done. A picture is what gets sent.
        </Text>

        {adminNote ? (
          <View
            style={[
              styles.coachCard,
              { backgroundColor: glass(0.07), borderColor: glassBorder(0.1) },
            ]}>
            <MaterialIcons name="chat-bubble-outline" size={16} color={c.primary} />
            <Text style={[typography.footnote, { color: c.textSoft, flex: 1 }]}>{adminNote}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
          disabled={busy || picking !== null}
          onPress={() => void pick('camera')}
          style={({ pressed }) => [
            styles.cameraCard,
            {
              backgroundColor: `${c.primary}18`,
              borderColor: `${c.primary}55`,
              opacity: pressed ? 0.88 : 1,
            },
          ]}>
          {picking === 'camera' ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <MaterialIcons name="photo-camera" size={28} color={c.primary} />
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typography.headline, { color: c.text }]}>Take a photo</Text>
            <Text style={[typography.caption1, { color: c.textMuted }]}>Open the camera</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={14} color={c.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose from library"
          disabled={busy || picking !== null}
          onPress={() => void pick('library')}
          style={({ pressed }) => [
            styles.libraryRow,
            { opacity: pressed ? 0.7 : 1 },
          ]}>
          {picking === 'library' ? (
            <ActivityIndicator color={c.primary} size="small" />
          ) : (
            <MaterialIcons name="photo-library" size={18} color={c.primary} />
          )}
          <Text style={[typography.subheadline, { color: c.primary, fontWeight: '700' }]}>
            Choose from library
          </Text>
        </Pressable>

        {uri ? (
          <Image
            source={{ uri }}
            style={[styles.preview, { backgroundColor: glass(0.06) }]}
            resizeMode="cover"
          />
        ) : null}

        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Note, if you want</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Optional — the photo is the proof"
          placeholderTextColor={c.textSubtle}
          multiline
          style={[
            styles.noteInput,
            styles.noteInputShort,
            {
              color: c.text,
              backgroundColor: glass(0.06),
              borderColor: glassBorder(0.12),
            },
          ]}
        />

        <OrbitButton
          loading={busy}
          disabled={busy || !uri}
          onPress={() =>
            void onSubmit({
              proofUri: uri ?? undefined,
              note: note.trim() || undefined,
            })
          }>
          Send photo
        </OrbitButton>
        <OrbitButton tone="secondary" disabled={busy} onPress={onDismiss}>
          Later
        </OrbitButton>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  iconBubble: {
    alignItems: 'center',
    alignSelf: 'center',
    borderCurve: 'continuous',
    borderRadius: 28,
    height: 64,
    justifyContent: 'center',
    marginBottom: 4,
    width: 64,
  },
  lead: {
    textAlign: 'center',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  noteInput: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  noteInputShort: {
    minHeight: 64,
  },
  cameraCard: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  libraryRow: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  preview: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    height: 160,
    width: '100%',
  },
  coachCard: {
    alignItems: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
