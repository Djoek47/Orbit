/**
 * What you see after scanning a shared-device QR.
 *
 *   ┌──────────────────────────────────┐
 *   │        (choremaxx badge)         │
 *   │          SHARED DEVICE           │
 *   │      Welcome to The Mugabos      │
 *   │   ┌──────────────────────────┐   │
 *   │   │ 🏠 Kitchen device        │   │
 *   │   │ Household code    4F2A   │   │
 *   │   │ (o)(o)  Emma and Jack    │   │
 *   │   └──────────────────────────┘   │
 *   │        [  Join this device  ]    │
 *   │     Use this phone as mine only  │
 *   └──────────────────────────────────┘
 *
 * It replaces a screen that asked "Which device?" and offered "Continue as Emma's Sidekick
 * phone" — a question the QR had already answered, in words no parent would follow. Nothing
 * here asks anything: it confirms the house, names the device, shows a code to check against
 * the admin's screen, and shows who is already on it. One button goes in.
 *
 * Joining does not cut to another screen. The card lifts away and the faces come up
 * underneath, so it reads as one movement rather than two screens.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { getAccentTheme } from '@/constants/accent-themes';
import { space } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { SharedDeviceWelcome } from '@/lib/device/shared-device-welcome';

type Props = {
  welcome: SharedDeviceWelcome;
  busy?: boolean;
  /** Runs once the card has animated out, so the next screen starts as this one ends. */
  onJoin: () => void;
  /** The old behaviour, kept but demoted: host this phone as one person's own. */
  onUseAsPersonal?: () => void;
  personalName?: string;
};

export function SharedDeviceWelcomeCard({
  welcome,
  busy,
  onJoin,
  onUseAsPersonal,
  personalName,
}: Props) {
  const { c, glass, glassBorder } = useOrbitColors();
  const [leaving, setLeaving] = useState(false);

  const opacity = useSharedValue(1);
  const lift = useSharedValue(0);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: lift.get() }],
  }));

  const join = () => {
    if (leaving || busy) return;
    setLeaving(true);
    // Up and out, not a cross-fade: the faces are arriving from below.
    lift.set(withTiming(-28, { duration: 320, easing: Easing.inOut(Easing.cubic) }));
    opacity.set(
      withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(onJoin)();
      })
    );
  };

  return (
    <Animated.View style={[styles.root, cardStyle]}>
      <Animated.View
        entering={FadeInDown.delay(60).duration(460)}
        style={[styles.card, { backgroundColor: glass(0.05), borderColor: glassBorder(0.12) }]}>
        <View style={styles.cardRow}>
          <MaterialIcons name="devices" size={20} color={c.textMuted} />
          <Text style={[styles.deviceName, { color: c.text }]} numberOfLines={1}>
            {welcome.deviceLabel}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: glassBorder(0.08) }]} />

        <View style={styles.cardRow}>
          <Text style={[styles.codeLabel, { color: c.textMuted }]}>Household code</Text>
          <View style={{ flex: 1 }} />
          <Text style={[styles.code, { color: c.text }]}>{welcome.matchCode}</Text>
        </View>
        <Text style={[styles.codeHint, { color: c.textSubtle }]}>
          Your admin sees the same four characters. If they don&apos;t match, this is the wrong
          household.
        </Text>

        {welcome.people.length > 0 ? (
          <>
            <View style={[styles.divider, { backgroundColor: glassBorder(0.08) }]} />
            <View style={styles.peopleRow}>
              <View style={styles.faces}>
                {welcome.people.slice(0, 4).map((member, index) => {
                  const theme = getAccentTheme(member.accentThemeId);
                  const photo = isAvatarImageUri(member.avatar);
                  return (
                    <Animated.View
                      key={member.id}
                      entering={FadeIn.delay(190 + index * 70).duration(320)}
                      style={[styles.faceWrap, index > 0 && { marginLeft: -12 }]}>
                      <LinearGradient
                        colors={[theme.primary, theme.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.faceRing}>
                        <View style={[styles.faceInner, { backgroundColor: c.backgroundSoft }]}>
                          <Avatar
                            name={member.name}
                            emoji={memberDisplayEmoji(member)}
                            imageUri={photo ? member.avatar : undefined}
                            size="s"
                          />
                        </View>
                      </LinearGradient>
                    </Animated.View>
                  );
                })}
              </View>
              <Text style={[styles.peopleLabel, { color: c.textMuted }]} numberOfLines={1}>
                {welcome.peopleLabel}
              </Text>
            </View>
          </>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(160).duration(420)} style={styles.actions}>
        <OrbitButton disabled={busy || leaving} loading={busy} onPress={join}>
          Join this device
        </OrbitButton>

        {onUseAsPersonal ? (
          <Pressable
            onPress={onUseAsPersonal}
            disabled={busy || leaving}
            accessibilityRole="button"
            style={({ pressed }) => [styles.personal, { opacity: pressed ? 0.6 : 1 }]}>
            <Text style={[styles.personalLabel, { color: c.textSubtle }]}>
              {personalName
                ? `Use this phone as ${personalName}'s own instead`
                : 'Use this phone as my own instead'}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.lg },
  card: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  cardRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  deviceName: { flex: 1, fontSize: 16, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, width: '100%' },
  codeLabel: { fontSize: 14, fontWeight: '600' },
  code: { fontSize: 20, fontWeight: '800', letterSpacing: 4 },
  codeHint: { fontSize: 12.5, lineHeight: 17 },
  peopleRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  faces: { flexDirection: 'row' },
  faceWrap: {},
  faceRing: { alignItems: 'center', borderRadius: 19, height: 38, justifyContent: 'center', padding: 2, width: 38 },
  faceInner: {
    alignItems: 'center',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 34,
  },
  peopleLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  actions: { gap: 12 },
  personal: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  personalLabel: { fontSize: 13.5, fontWeight: '600', textAlign: 'center' },
});
