import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { AVATAR_EMOJIS } from '@/constants/accent-themes';
import { space, typography } from '@/constants/orbit-theme';
import {
  AvatarPickError,
  canUseImagePlayground,
  createAvatarWithImagePlayground,
  pickAvatarFromLibrary,
} from '@/lib/profile/pick-avatar';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type PersonalizeLookSheetProps = {
  visible: boolean;
  memberName: string;
  currentAvatar?: string;
  onDismiss: () => void;
  /** Persist emoji or image URI. */
  onSelect: (avatar: string) => void | Promise<void>;
};

/**
 * Calm sheet to set a profile look: Photos, Image Playground (native),
 * instructional fallback, or emoji.
 */
export function PersonalizeLookSheet({
  visible,
  memberName,
  currentAvatar,
  onDismiss,
  onSelect,
}: PersonalizeLookSheetProps) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const [playgroundReady, setPlaygroundReady] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    canUseImagePlayground().then((ok) => {
      if (mounted) {
        setPlaygroundReady(ok);
        setShowGuide(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [visible]);

  const finish = async (value: string) => {
    await onSelect(value);
    onDismiss();
  };

  const handlePhotos = async () => {
    setBusy(true);
    try {
      const uri = await pickAvatarFromLibrary();
      await finish(uri);
    } catch (error) {
      if (error instanceof AvatarPickError && error.code === 'cancelled') return;
      const message =
        error instanceof AvatarPickError ? error.message : 'Could not open Photos.';
      Alert.alert('Photos', message);
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
      const uri = await createAvatarWithImagePlayground({ nameHint: memberName });
      if (uri) await finish(uri);
    } catch (error) {
      setShowGuide(true);
      if (error instanceof AvatarPickError && error.code !== 'unavailable') {
        Alert.alert('Image Playground', error.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} heightRatio={0.72}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text style={[typography.title3, { color: c.text }]}>Personalize your look</Text>
        <Text style={[typography.subheadline, { color: c.textMuted, marginTop: 6 }]}>
          Choose a photo for {memberName}, create one with Apple Image Playground, or pick an emoji.
        </Text>

        <View style={styles.actions}>
          <ActionRow
            icon="photo-library"
            title="Choose from Photos"
            subtitle="Gallery, camera roll, or a saved Memoji"
            color={c.primary}
            glass={glass}
            border={glassBorder(0.1)}
            text={c.text}
            muted={c.textMuted}
            disabled={busy}
            onPress={() => void handlePhotos()}
          />
          <ActionRow
            icon="auto-awesome"
            title="Create with Image Playground"
            subtitle={
              playgroundReady
                ? 'Open Apple Intelligence in Choremaxx'
                : 'See how to create a look, then pick it from Photos'
            }
            color={c.novaCyan ?? '#06B6D4'}
            glass={glass}
            border={glassBorder(0.1)}
            text={c.text}
            muted={c.textMuted}
            disabled={busy}
            onPress={() => void handlePlayground()}
          />
        </View>

        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color={c.primary} />
            <Text style={[typography.footnote, { color: c.textMuted }]}>Working…</Text>
          </View>
        ) : null}

        {showGuide ? (
          <View
            style={[
              styles.guide,
              {
                backgroundColor: glass(0.05),
                borderColor: glassBorder(0.1),
              },
            ]}>
            <Text style={[typography.headline, { color: c.text }]}>
              Create a look with Apple Image Playground
            </Text>
            <Text style={[typography.footnote, { color: c.textSoft, marginTop: 8, lineHeight: 20 }]}>
              1. Open Image Playground (or Photos → Create) on this iPhone{'\n'}
              2. Describe yourself — e.g. “friendly house manager, soft portrait”{'\n'}
              3. Tap Done / save the image to Photos{'\n'}
              4. Return here and tap Choose from Photos
            </Text>
            <Text style={[typography.caption1, { color: c.textSubtle, marginTop: 10, lineHeight: 18 }]}>
              Needs iOS 18.2+, Apple Intelligence, and Image Playground enabled in Settings. You can
              also use a Memoji screenshot saved to Photos.
            </Text>
            <Pressable
              onPress={() => void handlePhotos()}
              style={[styles.guideCta, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,28,42,0.06)' }]}
              disabled={busy}>
              <Text style={[typography.headline, { color: c.primary }]}>
                Got it — Choose from Photos
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={[typography.eyebrow, { color: c.textSubtle, marginTop: space.md }]}>Emoji</Text>
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
                    borderColor: selected ? c.primary : glassBorder(0.1),
                  },
                ]}
                disabled={busy}
                onPress={() => void finish(emoji)}>
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  color,
  glass,
  border,
  text,
  muted,
  disabled,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  glass: (a?: number) => string;
  border: string;
  text: string;
  muted: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionRow,
        { backgroundColor: glass(0.05), borderColor: border, opacity: disabled ? 0.55 : 1 },
      ]}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}22` }]}>
        <MaterialIcons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.headline, { color: text }]}>{title}</Text>
        <Text style={[typography.footnote, { color: muted, marginTop: 2 }]}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.md,
    paddingBottom: space.xl,
    gap: 4,
  },
  actions: { marginTop: space.md, gap: 10 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  guide: {
    marginTop: space.md,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  guideCta: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
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
