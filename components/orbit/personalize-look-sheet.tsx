import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import { SegmentedControl } from '@/components/orbit/segmented-control';
import { StatusPill } from '@/components/orbit/status-pill';
import { AVATAR_EMOJIS } from '@/constants/accent-themes';
import { radius, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { isShareableAvatarUri } from '@/lib/profile/avatar-uri';
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
import { useOrbitOptional } from '@/store/orbit-store';

type PersonalizeLookSheetProps = {
  visible: boolean;
  memberName: string;
  /** Everyone else in the house — their names are kept out of the Playground prompt too. */
  otherNames?: string[];
  currentAvatar?: string;
  onDismiss: () => void;
  /** Persist emoji or image URI (caller uploads to household storage when needed). */
  onSelect: (avatar: string) => void | Promise<void>;
};

type SheetPhase = 'idle' | 'creating' | 'saving';

const STYLE_OPTIONS = PLAYGROUND_STYLES.map((value) => ({
  value,
  label: PLAYGROUND_STYLE_LABELS[value],
}));

/**
 * Make your character — premium Orbit sheet. Apple Image Playground is the main path;
 * Photos and emoji stay quieter underneath. After Create, the parent persists the look
 * (cloud URL in supabase mode) so the character survives app delete.
 */
export function PersonalizeLookSheet({
  visible,
  memberName,
  otherNames,
  currentAvatar,
  onDismiss,
  onSelect,
}: PersonalizeLookSheetProps) {
  const orbit = useOrbitOptional();
  const { c, glass, glassBorder } = useOrbitColors();
  const accent = orbit?.accentTheme.primary ?? c.primary;
  const accentSecondary = orbit?.accentTheme.secondary ?? c.accent;
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
  const [phase, setPhase] = useState<SheetPhase>('idle');
  const busy = phase !== 'idle';
  const avoidNames = [memberName, ...(otherNames ?? [])].filter(
    (name) => !/^(you|them|member|me)$/i.test(name.trim())
  );
  const { removedNames } = playgroundConcepts(description, avoidNames);
  const border = glassBorder(0.1);
  const cloudSaved = isShareableAvatarUri(currentAvatar);
  const previewPhoto = isAvatarImageUri(currentAvatar) ? currentAvatar : undefined;
  const previewEmoji = !previewPhoto
    ? memberDisplayEmoji({ name: memberName, avatar: currentAvatar })
    : undefined;

  const phaseCopy = useMemo(() => {
    if (phase === 'creating') return 'Opening Image Playground…';
    if (phase === 'saving') return 'Saving to your household…';
    return null;
  }, [phase]);

  useEffect(() => {
    if (!visible) return;
    setShowGuide(false);
    setPhase('idle');
    setSourcePhoto(null);
    setAvailability(imagePlaygroundAvailability());
  }, [visible]);

  const finish = async (value: string) => {
    setPhase('saving');
    try {
      await onSelect(value);
      onDismiss();
    } catch (error) {
      orbitAlert(
        'Couldn’t save look',
        error instanceof Error ? error.message : 'Try again in a moment.'
      );
    } finally {
      setPhase('idle');
    }
  };

  const handlePhotos = async () => {
    setPhase('creating');
    try {
      await finish(await pickAvatarFromLibrary());
    } catch (error) {
      if (error instanceof AvatarPickError && error.code === 'cancelled') {
        setPhase('idle');
        return;
      }
      setPhase('idle');
      orbitAlert(
        'Photos',
        error instanceof AvatarPickError ? error.message : 'Could not open Photos.'
      );
    }
  };

  const handleSourcePhoto = async () => {
    if (sourcePhoto) {
      setSourcePhoto(null);
      return;
    }
    setPhase('creating');
    try {
      setSourcePhoto(await pickPlaygroundSourcePhoto());
    } catch (error) {
      if (error instanceof AvatarPickError && error.code === 'cancelled') return;
      orbitAlert(
        'Photos',
        error instanceof AvatarPickError ? error.message : 'Could not open Photos.'
      );
    } finally {
      setPhase('idle');
    }
  };

  const handlePlayground = async () => {
    if (!playgroundReady) {
      setShowGuide(true);
      return;
    }
    setPhase('creating');
    try {
      const uri = await createAvatarWithImagePlayground({
        avoidNames,
        description,
        style,
        sourceImageUri: sourcePhoto,
      });
      if (uri) {
        await finish(uri);
      } else {
        setPhase('idle');
      }
    } catch (error) {
      setPhase('idle');
      setShowGuide(true);
      if (error instanceof AvatarPickError && error.code === 'unavailable') {
        setAvailability(imagePlaygroundAvailability());
      } else if (error instanceof AvatarPickError) {
        setShowGuide(false);
        orbitAlert('Image Playground', error.message);
      }
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={busy ? () => undefined : onDismiss}
      heightRatio={0.9}
      accentColor={accent}
      scrollable>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[typography.eyebrow, { color: accent }]}>Your look</Text>
          <Text style={[typography.title2, { color: c.text }]}>Make your character</Text>
        </View>
        <Pressable
          onPress={busy ? undefined : onDismiss}
          disabled={busy}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={[
            styles.closeBtn,
            { backgroundColor: glass(0.06), borderColor: border, opacity: busy ? 0.4 : 1 },
          ]}>
          <MaterialIcons name="close" size={18} color={c.textMuted} />
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.duration(320).delay(40)}>
        <LinearGradient
          colors={[`${accent}33`, `${accentSecondary}12`, glass(0.04)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderColor: `${accent}44` }]}>
          <View style={[styles.heroOrb, { borderColor: `${accent}66`, backgroundColor: glass(0.08) }]}>
            <Avatar
              name={memberName}
              emoji={previewEmoji}
              imageUri={previewPhoto}
              size="xl"
            />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[typography.headline, { color: c.text }]} numberOfLines={1}>
              {memberName}
            </Text>
            <Text style={[typography.footnote, { color: c.textMuted, marginTop: 2 }]}>
              {phaseCopy ??
                (cloudSaved
                  ? 'Saved with your household — comes back after reinstall.'
                  : 'Apple draws it here. We keep the finished look with your household.')}
            </Text>
            <View style={styles.pillRow}>
              {phase === 'saving' ? (
                <StatusPill label="Saving…" tone="amber" />
              ) : phase === 'creating' ? (
                <StatusPill label="Creating…" tone="cyan" />
              ) : cloudSaved ? (
                <StatusPill label="Saved · household" tone="green" />
              ) : (
                <StatusPill label="Image Playground" tone="blue" />
              )}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(320).delay(90)}
        style={[styles.assurance, { backgroundColor: glass(0.05), borderColor: border }]}>
        <MaterialIcons name="cloud-done" size={18} color={accent} />
        <Text style={[typography.caption1, { color: c.textSoft, flex: 1, lineHeight: 16 }]}>
          Finished characters upload to your household vault — not only this iPhone’s app storage.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(320).delay(130)} style={styles.block}>
        <StepBadge n={1} title="Pick a look" accent={accent} text={c.text} muted={c.textSubtle} />
        <SegmentedControl
          options={STYLE_OPTIONS}
          value={style}
          onChange={setStyle}
          disabled={busy}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(320).delay(170)} style={styles.block}>
        <StepBadge
          n={2}
          title="Say what they’re like"
          accent={accent}
          text={c.text}
          muted={c.textSubtle}
        />
        <TextInput
          value={description}
          onChangeText={setDescription}
          editable={!busy}
          placeholder="green dragon, flying, big smile"
          placeholderTextColor={c.textSubtle}
          style={[
            styles.input,
            { backgroundColor: glass(0.05), borderColor: border, color: c.text },
          ]}
          multiline
        />
        <Text style={[typography.caption1, { color: c.textSubtle, marginTop: 8, lineHeight: 16 }]}>
          Describe them, not their name — Apple won’t draw from names. A few words, commas, or leave
          it blank for a surprise.
        </Text>
        {removedNames.length ? (
          <View
            style={[
              styles.warnRow,
              { backgroundColor: `${c.warning}14`, borderColor: `${c.warning}44` },
            ]}>
            <MaterialIcons name="info-outline" size={16} color={c.warning} />
            <Text style={[typography.caption1, { color: c.warning, flex: 1, lineHeight: 16 }]}>
              {removedNames.join(', ')} will be left out — Playground can’t draw from a name.
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(320).delay(210)} style={styles.block}>
        <StepBadge
          n={3}
          title="Start from a photo"
          accent={accent}
          text={c.text}
          muted={c.textSubtle}
          optional
        />
        <Pressable
          onPress={() => void handleSourcePhoto()}
          disabled={busy}
          style={[styles.sourceRow, { backgroundColor: glass(0.05), borderColor: border }]}>
          {sourcePhoto ? (
            <Image source={{ uri: sourcePhoto }} style={styles.sourceThumb} contentFit="cover" />
          ) : (
            <View style={[styles.sourceThumb, { backgroundColor: `${accent}18` }]}>
              <MaterialIcons name="add-a-photo" size={20} color={accent} />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typography.footnote, { color: c.text, fontWeight: '600' }]}>
              {sourcePhoto ? 'Starting from this photo' : 'Optional reference photo'}
            </Text>
            <Text style={[typography.caption1, { color: c.textMuted }]}>
              {sourcePhoto
                ? 'Tap to remove and start from words only'
                : 'Playground will draw the character from it'}
            </Text>
          </View>
          <MaterialIcons
            name={sourcePhoto ? 'close' : 'chevron-right'}
            size={20}
            color={c.textSubtle}
          />
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(320).delay(250)} style={styles.ctaBlock}>
        <OrbitButton
          disabled={busy}
          loading={busy}
          onPress={() => void handlePlayground()}>
          {phase === 'saving'
            ? 'Saving look…'
            : phase === 'creating'
              ? 'Creating…'
              : 'Create with Image Playground'}
        </OrbitButton>
        <Text style={[typography.caption1, { color: c.textSubtle, textAlign: 'center' }]}>
          Apple’s sheet opens — pick a favorite, tap Done, and we save it with the household.
        </Text>
      </Animated.View>

      {showGuide ? (
        <View style={[styles.guide, { backgroundColor: glass(0.05), borderColor: border }]}>
          <Text style={[typography.headline, { color: c.text }]}>
            Image Playground can’t open yet
          </Text>
          <Text style={[typography.footnote, { color: c.textSoft, marginTop: 8, lineHeight: 20 }]}>
            {availability.ok ? '' : availability.message}
          </Text>
          {!availability.ok && availability.reason === 'apple_intelligence_off' ? (
            <Pressable
              onPress={() => void Linking.openSettings()}
              style={[styles.settingsBtn, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}
              accessibilityRole="button">
              <Text style={[typography.footnote, { color: accent, fontWeight: '700' }]}>
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
        <View style={[styles.secondaryIcon, { backgroundColor: `${accent}18` }]}>
          <MaterialIcons name="photo-library" size={18} color={accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typography.footnote, { color: c.text, fontWeight: '600' }]}>
            Choose from Photos
          </Text>
          <Text style={[typography.caption1, { color: c.textMuted }]}>
            Also saved with your household
          </Text>
        </View>
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
                  backgroundColor: selected ? `${accent}22` : glass(0.05),
                  borderColor: selected ? accent : border,
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

function StepBadge({
  n,
  title,
  accent,
  text,
  muted,
  optional,
}: {
  n: number;
  title: string;
  accent: string;
  text: string;
  muted: string;
  optional?: boolean;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepNum, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
        <Text style={[typography.caption2, { color: accent, fontWeight: '800' }]}>{n}</Text>
      </View>
      <Text style={[typography.headline, { color: text, flex: 1 }]}>{title}</Text>
      {optional ? (
        <Text style={[typography.caption1, { color: muted }]}>Optional</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    marginBottom: space.sm,
  },
  closeBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    height: 32,
    justifyContent: 'center',
    marginTop: 4,
    width: 32,
  },
  hero: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginBottom: space.sm,
    padding: 16,
  },
  heroOrb: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    borderWidth: 2,
    justifyContent: 'center',
    padding: 3,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  assurance: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    marginBottom: space.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  block: {
    marginTop: space.md,
  },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  stepNum: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  input: {
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    minHeight: 72,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  warnRow: {
    alignItems: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    padding: 10,
  },
  sourceRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  sourceThumb: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  ctaBlock: {
    gap: 10,
    marginBottom: 4,
    marginTop: space.lg,
  },
  settingsBtn: {
    alignSelf: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  guide: {
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: space.md,
    padding: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: space.md,
  },
  secondaryRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  secondaryIcon: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  emojiChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
});
