/**
 * Settings → You: one place for your picture and your name.
 *
 * Big face up top (tap to make a new one: Playground, Photos or Emoji), your name under it
 * (tap to rename), and your saved pictures in a row below: tap one to wear it, hold one to
 * save it to Photos. Replaces the old hero + "Your picture" + "Your name" cards, which offered
 * two ways to change the same picture.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { MemberGlyph } from '@/components/orbit/member-glyph';
import type { AvatarLibraryEntry } from '@/lib/profile/avatar-library';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  member: { name: string; avatar?: string | null } | null;
  /** "Owner · Rivera house" */
  roleLine: string;
  accent: string;
  gallery: AvatarLibraryEntry[];
  selectedUri: string | null;
  onOpenPicker: () => void;
  onSelect: (uri: string) => void;
  onRename: (name: string) => void;
};

export function YouProfileCard({ member, roleLine, accent, gallery, selectedUri, onOpenPicker, onSelect, onRename }: Props) {
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(member?.name ?? '');
  const pop = useSharedValue(1);
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  // A little bounce when the picture changes.
  useEffect(() => {
    pop.value = withSequence(withTiming(0.92, { duration: 90 }), withSpring(1, { damping: 7, stiffness: 220 }));
  }, [member?.avatar, pop]);

  const save = () => {
    const next = draft.trim();
    if (next.length >= 2 && next !== member?.name) onRename(next);
    setEditing(false);
  };

  const saveToPhotos = (entry: AvatarLibraryEntry) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    const share = () => void Share.share({ url: entry.uri }).catch(() => undefined);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Use this picture', 'Save to Photos…', 'Cancel'], cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) onSelect(entry.uri);
          if (i === 1) share();
        }
      );
    } else share();
  };

  const name = member?.name ?? 'You';

  return (
    <Animated.View entering={FadeInDown.duration(260)} style={[styles.card, { backgroundColor: glass(isDark ? 0.05 : 0.6), borderColor: glassBorder(0.1) }]}>
      <LinearGradient colors={[`${accent}40`, `${accent}00`]} style={styles.wash} pointerEvents="none" />

      {/* Face */}
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync().catch(() => undefined);
          onOpenPicker();
        }}
        accessibilityRole="button"
        accessibilityLabel="Change your picture"
        accessibilityHint="Image Playground, Photos or Emoji"
        style={({ pressed }) => [styles.faceHit, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
        <Animated.View style={[styles.faceRing, { borderColor: accent, shadowColor: accent, backgroundColor: isDark ? '#FFFFFF14' : '#FFFFFF' }, faceStyle]}>
          <MemberGlyph member={member ?? { name }} size={68} />
        </Animated.View>
        <View style={[styles.editBadge, { backgroundColor: accent, borderColor: c.background }]}>
          <MaterialIcons name="edit" size={15} color="#FFFFFF" />
        </View>
      </Pressable>

      {/* Name */}
      {editing ? (
        <Animated.View entering={FadeIn.duration(150)} style={[styles.nameEdit, { borderColor: accent, backgroundColor: glass(0.06) }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            autoFocus
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={save}
            placeholder="Your name"
            placeholderTextColor={c.textSubtle}
            style={[styles.nameInput, { color: c.text }]}
            accessibilityLabel="Your name"
          />
          <Pressable onPress={save} hitSlop={8} accessibilityRole="button" accessibilityLabel="Save name" style={[styles.doneBtn, { backgroundColor: '#34D399' }]}>
            <MaterialIcons name="check" size={18} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      ) : (
        <Pressable
          onPress={() => {
            setDraft(member?.name ?? '');
            setEditing(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Your name, ${name}. Tap to change`}
          style={styles.nameRow}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {name}
          </Text>
          <MaterialIcons name="edit" size={16} color={c.textSubtle} />
        </Pressable>
      )}
      <Text style={[styles.role, { color: c.textMuted }]}>{roleLine}</Text>

      {/* Saved pictures */}
      <View style={[styles.divider, { backgroundColor: glassBorder(0.1) }]} />
      <View style={styles.galleryHead}>
        <Text style={[styles.eyebrow, { color: c.textSubtle }]}>SAVED PICTURES</Text>
        {gallery.length ? <Text style={[styles.hint, { color: c.textSubtle }]}>Hold one to save to Photos</Text> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        <Pressable
          onPress={onOpenPicker}
          accessibilityRole="button"
          accessibilityLabel="Make a new picture"
          style={({ pressed }) => [styles.tile, styles.newTile, { borderColor: `${accent}88`, backgroundColor: `${accent}14`, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <MaterialIcons name="add" size={26} color={accent} />
          <Text style={[styles.newLabel, { color: accent }]}>New</Text>
        </Pressable>
        {gallery.map((entry, i) => {
          const on = selectedUri === entry.uri;
          return (
            <Animated.View key={entry.id} entering={FadeInDown.delay(40 * i).springify()}>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  onSelect(entry.uri);
                }}
                onLongPress={() => saveToPhotos(entry)}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={on ? 'Your current picture' : 'Use this picture'}
                accessibilityHint="Hold to save it to Photos"
                style={({ pressed }) => [styles.tile, { borderColor: on ? accent : glassBorder(0.12), borderWidth: on ? 3 : 1.5, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
                <Image source={{ uri: entry.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                {on ? (
                  <View style={[styles.tick, { backgroundColor: accent }]}>
                    <MaterialIcons name="check" size={12} color="#FFFFFF" />
                  </View>
                ) : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
      {!gallery.length ? (
        <Text style={[styles.hint, { color: c.textSubtle, alignSelf: 'flex-start' }]}>
          Pictures you make with Image Playground are kept here, even after you sign out.
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 28, borderWidth: 1, gap: 6, overflow: 'hidden', paddingBottom: 16, paddingHorizontal: 16, paddingTop: 24 },
  wash: { height: 140, left: 0, position: 'absolute', right: 0, top: 0 },
  faceHit: { marginBottom: 8 },
  faceRing: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 40, borderWidth: 3, height: 116, justifyContent: 'center', overflow: 'hidden', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, width: 116 },
  editBadge: { alignItems: 'center', borderRadius: 17, borderWidth: 3, bottom: -4, height: 34, justifyContent: 'center', position: 'absolute', right: -4, width: 34 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 6, maxWidth: '100%', paddingHorizontal: 8 },
  name: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  nameEdit: { alignItems: 'center', alignSelf: 'stretch', borderRadius: 16, borderWidth: 2, flexDirection: 'row', gap: 8, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 },
  nameInput: { flex: 1, fontSize: 22, fontWeight: '700', paddingVertical: 4 },
  doneBtn: { alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  role: { fontSize: 15 },
  divider: { alignSelf: 'stretch', height: StyleSheet.hairlineWidth, marginVertical: 10 },
  galleryHead: { alignItems: 'baseline', alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  hint: { fontSize: 12 },
  strip: { gap: 10, paddingVertical: 6, paddingRight: 8 },
  tile: { borderCurve: 'continuous', borderRadius: 20, height: 64, overflow: 'hidden', width: 64 },
  newTile: { alignItems: 'center', borderStyle: 'dashed', borderWidth: 1.5, justifyContent: 'center' },
  newLabel: { fontSize: 11, fontWeight: '700', marginTop: -2 },
  tick: { alignItems: 'center', borderRadius: 9, bottom: 4, height: 18, justifyContent: 'center', position: 'absolute', right: 4, width: 18 },
});
