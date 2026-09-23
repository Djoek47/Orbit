/**
 * iOS 2026-style proof sheets for task detail.
 * - Admin: request a photo from a Sidekick (optional coaching note)
 * - Sidekick: reply with camera / library and optional note
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
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

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} heightRatio={0.52}>
      <View style={styles.body}>
        <View style={[styles.iconBubble, { backgroundColor: `${c.primary}22` }]}>
          <MaterialIcons name="photo-camera" size={28} color={c.primary} />
        </View>
        <Text style={[typography.title2, { color: c.text, textAlign: 'center' }]}>
          Request proof
        </Text>
        <Text style={[typography.subheadline, styles.lead, { color: c.textSoft }]}>
          Ask {sidekickName} for a quick photo of “{taskTitle}”. They can also leave a short note.
        </Text>

        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Optional note</Text>
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
          Send request
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
  const [picking, setPicking] = useState(false);

  const pick = async (source: 'camera' | 'library') => {
    setPicking(true);
    try {
      const next = await pickProofPhoto(source);
      if (next) setUri(next);
    } finally {
      setPicking(false);
    }
  };

  const canSend = Boolean(uri || note.trim());

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} heightRatio={0.62}>
      <View style={styles.body}>
        <View style={[styles.iconBubble, { backgroundColor: `${c.primary}22` }]}>
          <MaterialIcons name="verified" size={28} color={c.primary} />
        </View>
        <Text style={[typography.title2, { color: c.text, textAlign: 'center' }]}>
          Show your work
        </Text>
        <Text style={[typography.subheadline, styles.lead, { color: c.textSoft }]}>
          A grown-up asked for proof of “{taskTitle}”. Snap a photo, pick one, or write a quick note.
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

        <View style={styles.pickRow}>
          <Pressable
            disabled={busy || picking}
            onPress={() => void pick('camera')}
            style={({ pressed }) => [
              styles.pickCard,
              {
                backgroundColor: glass(0.08),
                borderColor: glassBorder(0.12),
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            {picking ? (
              <ActivityIndicator color={c.primary} />
            ) : (
              <MaterialIcons name="photo-camera" size={26} color={c.primary} />
            )}
            <Text style={[typography.headline, { color: c.text }]}>Camera</Text>
            <Text style={[typography.caption1, { color: c.textMuted }]}>Take a photo</Text>
          </Pressable>
          <Pressable
            disabled={busy || picking}
            onPress={() => void pick('library')}
            style={({ pressed }) => [
              styles.pickCard,
              {
                backgroundColor: glass(0.08),
                borderColor: glassBorder(0.12),
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <MaterialIcons name="photo-library" size={26} color={c.primary} />
            <Text style={[typography.headline, { color: c.text }]}>Library</Text>
            <Text style={[typography.caption1, { color: c.textMuted }]}>Choose one</Text>
          </Pressable>
        </View>

        {uri ? (
          <Image
            source={{ uri }}
            style={[styles.preview, { backgroundColor: glass(0.06) }]}
            resizeMode="cover"
          />
        ) : null}

        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Anything you want them to know…"
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
          disabled={busy || !canSend}
          onPress={() =>
            void onSubmit({
              proofUri: uri ?? undefined,
              note: note.trim() || undefined,
            })
          }>
          Send proof
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
    minHeight: 88,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  pickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickCard: {
    alignItems: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minHeight: 108,
    padding: 14,
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
