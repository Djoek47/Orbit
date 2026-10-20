import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { AvatarLibraryStrip } from '@/components/orbit/avatar-library-strip';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import { AVATAR_EMOJIS } from '@/constants/accent-themes';
import { space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri } from '@/lib/game-levels';
import {
  listAvatarLibrary,
  rememberAvatarInLibrary,
  type AvatarLibraryEntry,
} from '@/lib/profile/avatar-library';
import {
  AvatarPickError,
  createAvatarWithImagePlayground,
  imagePlaygroundAvailability,
  type PlaygroundAvailability,
  pickAvatarFromLibrary,
  pickPlaygroundSourcePhoto,
  PLAYGROUND_STYLE_LABELS,
  PLAYGROUND_STYLES,
  type PlaygroundStyle,
} from '@/lib/profile/pick-avatar';
import { playgroundConcepts } from '@/lib/profile/playground-concepts';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type PersonalizeLookSheetProps = {
  visible: boolean;
  memberName: string;
  /** Account id — gallery is keyed so faces survive sign-out on this phone. */
  userId?: string | null;
  /** Everyone else in the house — their names are kept out of the Playground prompt too. */
  otherNames?: string[];
  currentAvatar?: string;
  onDismiss: () => void;
  /** Persist emoji or image URI. */
  onSelect: (avatar: string) => void | Promise<void>;
};

/**
 * Make your character. Apple Image Playground is the main path: choose a look, say what
 * the character should be like, optionally start from a photo, then Apple draws it and we
 * import the result. Photos and emoji stay as quieter fallbacks underneath.
 *
 * Uses BottomSheet `scrollable` (no nested ScrollView) + an explicit Close so it never
 * traps touch events the way a drag-only sheet over Settings did.
 */
export function PersonalizeLookSheet({
  visible,
  memberName,
  userId,
  otherNames,
  currentAvatar,
  onDismiss,
  onSelect,
}: PersonalizeLookSheetProps) {
  const { c, glass, glassBorder } = useOrbitColors();
  const [availability, setAvailability] = useState<PlaygroundAvailability>({
    ok: false,
    reason: 'not_ios',
    message: '',
  });
  const playgroundReady = availability.ok;
  const [style, setStyle] = useState<PlaygroundStyle>('illustration');
  const [description, setDescription] = useState('');
  const [sourcePhoto, setSourcePhoto] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState<AvatarLibraryEntry[]>([]);
  const avoidNames = [memberName, ...(otherNames ?? [])].filter(
    (name) => !/^(you|them|member|me)$/i.test(name.trim())
  );
  const { removedNames } = playgroundConcepts(description, avoidNames);

  useEffect(() => {
    if (!visible) return;
    setShowGuide(false);
    setBusy(false);
    setAvailability(imagePlaygroundAvailability());
    if (userId) {
      void listAvatarLibrary(userId).then(setGallery);
    } else {
      setGallery([]);
    }
  }, [visible, userId]);

  const finish = async (
    value: string,
    source?: 'playground' | 'photos' | 'import'
  ) => {
    if (userId && isAvatarImageUri(value)) {
      try {
        setGallery(await rememberAvatarInLibrary({ userId, uri: value, source: source ?? 'import' }));
      } catch {
        /* gallery is best-effort */
      }
    }
    await onSelect(value);
    onDismiss();
  };

  const handlePhotos = async () => {
    setBusy(true);
    try {
      await finish(await pickAvatarFromLibrary(), 'photos');
    } catch (error) {
      if (error instanceof AvatarPickError && error.code === 'cancelled') return;
      orbitAlert(
        'Photos',
        error instanceof AvatarPickError ? error.message : 'Could not open Photos.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSourcePhoto = async () => {
    if (sourcePhoto) {
      setSourcePhoto(null);
      return;
    }
    setBusy(true);
    try {
      setSourcePhoto(await pickPlaygroundSourcePhoto());
    } catch (error) {
      if (error instanceof AvatarPickError && error.code === 'cancelled') return;
      orbitAlert(
        'Photos',
        error instanceof AvatarPickError ? error.message : 'Could not open Photos.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePlayground = async () => {
    if (!playgroundReady) {
      setShowGuide(true);
      return;
    }
    setBusy(true);
    try {
      const uri = await createAvatarWithImagePlayground({
        avoidNames,
        description,
        style,
        sourceImageUri: sourcePhoto,
      });
      if (uri) await finish(uri, 'playground');
    } catch (error) {
      setShowGuide(true);
      if (error instanceof AvatarPickError && error.code === 'unavailable') {
        setAvailability(imagePlaygroundAvailability());
      } else if (error instanceof AvatarPickError) {
        setShowGuide(false);
        orbitAlert('Image Playground', error.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const border = glassBorder(0.1);

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      heightRatio={0.85}
      scrollable>
      <View style={styles.headerRow}>
        <Text style={[typography.title3, { color: c.text, flex: 1 }]}>Make your character</Text>
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={[styles.closeBtn, { backgroundColor: glass(0.06), borderColor: border }]}>
          <MaterialIcons name="close" size={18} color={c.textMuted} />
        </Pressable>
      </View>
      <Text style={[typography.subheadline, { color: c.textMuted, marginTop: 6 }]}>
        Apple Image Playground draws it on this iPhone. Three quick choices, then tap Create.
      </Text>

      {gallery.length ? (
        <View style={{ marginTop: space.md }}>
          <AvatarLibraryStrip
            entries={gallery}
            selectedUri={currentAvatar}
            accent={c.primary}
            onSelect={(uri) => void finish(uri, 'import')}
          />
        </View>
      ) : null}

      <Step n={1} title="Pick a look" color={c.textSubtle} text={c.text} />
      <View style={styles.styleRow}>
        {PLAYGROUND_STYLES.map((option) => {
          const active = style === option;
          return (
            <Pressable
              key={option}
              onPress={() => setStyle(option)}
              style={[
                styles.styleChip,
                {
                  backgroundColor: active ? `${c.primary}22` : glass(0.05),
                  borderColor: active ? c.primary : border,
                },
              ]}>
              <Text
                style={[
                  typography.footnote,
                  { color: active ? c.primary : c.textMuted, fontWeight: '700' },
                ]}>
                {PLAYGROUND_STYLE_LABELS[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Step n={2} title="Say what they're like" color={c.textSubtle} text={c.text} />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="green dragon, flying, big smile"
        placeholderTextColor={c.textSubtle}
        style={[
          styles.input,
          { backgroundColor: glass(0.05), borderColor: border, color: c.text },
        ]}
        multiline
      />
      <Text style={[typography.caption1, { color: c.textSubtle, marginTop: 6 }]}>
        Describe them, not their name — Apple won&apos;t draw from names. A few words, separated by
        commas, or leave it blank and Apple will surprise you.
      </Text>
      {removedNames.length ? (
        <Text style={[typography.caption1, { color: c.warning, marginTop: 4 }]}>
          {removedNames.join(', ')} will be left out — Playground can&apos;t draw from a name, so it
          uses the rest of your words.
        </Text>
      ) : null}

      <Step n={3} title="Start from a photo (optional)" color={c.textSubtle} text={c.text} />
      <Pressable
        onPress={() => void handleSourcePhoto()}
        disabled={busy}
        style={[styles.sourceRow, { backgroundColor: glass(0.05), borderColor: border }]}>
        {sourcePhoto ? (
          <Image source={{ uri: sourcePhoto }} style={styles.sourceThumb} contentFit="cover" />
        ) : (
          <View style={[styles.sourceThumb, { backgroundColor: glass(0.08) }]}>
            <MaterialIcons name="add-a-photo" size={20} color={c.textMuted} />
          </View>
        )}
        <Text style={[typography.footnote, { color: c.textMuted, flex: 1 }]}>
          {sourcePhoto
            ? 'Using this photo as the starting point — tap to remove'
            : 'Pick a photo and Playground will draw the character from it'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => void handlePlayground()}
        disabled={busy}
        style={[styles.cta, { backgroundColor: c.primary, opacity: busy ? 0.6 : 1 }]}>
        {busy ? (
          <ActivityIndicator color={c.ink} />
        ) : (
          <>
            <MaterialIcons name="auto-awesome" size={18} color={c.ink} />
            <Text style={[typography.headline, { color: c.ink }]}>
              Create with Image Playground
            </Text>
          </>
        )}
      </Pressable>
      <Text style={[typography.caption1, { color: c.textSubtle, textAlign: 'center' }]}>
        Apple&apos;s sheet opens — swipe through its ideas, tap Done, and it lands here.
      </Text>

      {showGuide ? (
        <View style={[styles.guide, { backgroundColor: glass(0.05), borderColor: border }]}>
          <Text style={[typography.headline, { color: c.text }]}>
            Image Playground can&apos;t open yet
          </Text>
          <Text style={[typography.footnote, { color: c.textSoft, marginTop: 8, lineHeight: 20 }]}>
            {availability.ok ? '' : availability.message}
          </Text>
          {!availability.ok && availability.reason === 'apple_intelligence_off' ? (
            <Pressable
              onPress={() => void Linking.openSettings()}
              style={[styles.settingsBtn, { borderColor: border }]}
              accessibilityRole="button">
              <Text style={[typography.footnote, { color: c.primary, fontWeight: '700' }]}>
                Open Settings
              </Text>
            </Pressable>
          ) : null}
          <Text
            style={[typography.caption1, { color: c.textSubtle, marginTop: 10, lineHeight: 18 }]}>
            Or make a character in the Image Playground app, save it to Photos, and pick it below.
          </Text>
        </View>
      ) : null}

      <View style={[styles.divider, { backgroundColor: border }]} />

      <Pressable
        onPress={() => void handlePhotos()}
        disabled={busy}
        style={[styles.secondaryRow, { backgroundColor: glass(0.05), borderColor: border }]}>
        <MaterialIcons name="photo-library" size={20} color={c.textMuted} />
        <Text style={[typography.footnote, { color: c.text, flex: 1 }]}>
          Choose an image from Photos instead
        </Text>
        <MaterialIcons name="chevron-right" size={20} color={c.textSubtle} />
      </Pressable>

      <Text style={[typography.eyebrow, { color: c.textSubtle, marginTop: space.md }]}>
        Or pick an emoji
      </Text>
      <View style={styles.emojiGrid}>
        {AVATAR_EMOJIS.map((emoji) => {
          const selected = currentAvatar === emoji;
          return (
            <Pressable
              key={emoji}
              style={[
                styles.emojiChip,
                {
                  backgroundColor: glass(0.05),
                  borderColor: selected ? c.primary : border,
                },
              ]}
              disabled={busy}
              onPress={() => void finish(emoji)}>
              <Text style={{ fontSize: 22 }}>{emoji}</Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

function Step({
  n,
  title,
  color,
  text,
}: {
  n: number;
  title: string;
  color: string;
  text: string;
}) {
  return (
    <View style={styles.stepRow}>
      <Text style={[typography.caption1, { color, fontWeight: '800' }]}>{n}</Text>
      <Text style={[typography.headline, { color: text }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  closeBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: space.md,
    marginBottom: 8,
  },
  styleRow: { flexDirection: 'row', gap: 8 },
  styleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    minHeight: 64,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sourceThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: space.lg,
    marginBottom: 8,
    paddingVertical: 15,
    borderRadius: 16,
  },
  settingsBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  guide: {
    marginTop: space.md,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: space.md,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  emojiChip: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
