import { Image } from 'expo-image';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { radius } from '@/constants/orbit-theme';
import { isAvatarImageUri } from '@/lib/game-levels';
import { useOrbitOptional } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

export type AvatarSize = 'xs' | 's' | 'm' | 'l' | 'xl';

const SIZES: Record<AvatarSize, number> = {
  xs: 24,
  s: 32,
  m: 44,
  l: 56,
  xl: 80,
};

const FONT_RATIO = 0.5;

type AvatarProps = {
  /** Person's display name — used for the fallback initial and accessibility label. */
  name: string;
  /** Emoji or single-character glyph to show instead of the initial. */
  emoji?: string;
  /** Local or remote photo URI — takes precedence over emoji when valid. */
  imageUri?: string | null;
  size?: AvatarSize;
  /** Small colored dot in the corner (online/active/etc). */
  statusColor?: string;
  style?: ViewStyle;
};

/** Shared person representation — see docs/design-system/05-component-library.md "Avatar". */
export function Avatar({
  name,
  emoji,
  imageUri,
  size = 'm',
  statusColor,
  style,
}: AvatarProps) {
  const orbit = useOrbitOptional();
  const accent = orbit?.accentTheme.primary ?? '#38BDF8';
  const shell = orbit?.orbitPalette.background ?? '#070D1C';
  const dimension = SIZES[size];
  const photo = imageUri && isAvatarImageUri(imageUri) ? imageUri : null;
  const glyph = emoji || name.trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      accessibilityLabel={name}
      style={[
        styles.root,
        {
          width: dimension,
          height: dimension,
          borderRadius: radius.full,
          backgroundColor: photo ? 'transparent' : `${accent}26`,
          overflow: 'hidden',
        },
        style,
      ]}>
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: dimension, height: dimension }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={{ fontSize: dimension * FONT_RATIO }}>{glyph}</Text>
      )}
      {statusColor ? (
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: statusColor,
              borderColor: shell,
              width: dimension * 0.28,
              height: dimension * 0.28,
              borderRadius: radius.full,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    borderWidth: 2,
    bottom: -2,
    position: 'absolute',
    right: -2,
  },
});
