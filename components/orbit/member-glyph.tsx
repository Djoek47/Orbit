import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';

type MemberLike = { name: string; avatar?: string | null };

type MemberGlyphProps = {
  /** The member whose look to show; omit for the generic person mark. */
  member?: MemberLike | null;
  /** Glyph size in points (also the photo's diameter). */
  size?: number;
  /** Applied to the emoji text only. */
  style?: StyleProp<TextStyle>;
  /** Applied to the photo wrapper only. */
  photoStyle?: StyleProp<ViewStyle>;
};

/**
 * One member's look wherever it appears inline: the photo they made in Apple Image
 * Playground (or picked from Photos) when they have one, otherwise their chosen emoji.
 *
 * Avatars are the one place ChoreMaxx still uses real emoji — everything else draws a
 * `<Moji>`. Use this instead of rendering `memberDisplayEmoji()` into a `<Text>`, so a
 * member who made a character sees it on every screen, not just the big avatar circles.
 */
export function MemberGlyph({ member, size = 16, style, photoStyle }: MemberGlyphProps) {
  const avatar = member?.avatar;
  if (avatar && isAvatarImageUri(avatar)) {
    return (
      <View
        style={[
          styles.photo,
          { width: size * 1.5, height: size * 1.5, borderRadius: size },
          photoStyle,
        ]}>
        <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
    );
  }
  return (
    <Text style={[{ fontSize: size }, style]}>
      {member ? memberDisplayEmoji({ name: member.name, avatar: member.avatar ?? undefined }) : '👤'}
    </Text>
  );
}

const styles = StyleSheet.create({
  photo: { overflow: 'hidden' },
});
