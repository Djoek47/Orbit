import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { motionDuration } from '@/constants/motion-tokens';

export type PoppinsCaptionSpeaker = 'you' | 'poppins' | 'thinking' | 'done';

type PoppinsLiveCaptionProps = {
  speaker: PoppinsCaptionSpeaker;
  label: string;
  text: string;
  accent: string;
  textColor: string;
  showDots?: boolean;
};

/** One live caption: follows the active speaker and never stacks both turns. */
export function PoppinsLiveCaption({
  speaker,
  label,
  text,
  accent,
  textColor,
  showDots = false,
}: PoppinsLiveCaptionProps) {
  const a11y =
    speaker === 'thinking'
      ? `${label}. ${text}`
      : speaker === 'done'
        ? `${label}. ${text}`
        : `${label} is speaking. ${text}`;
  return (
    <Animated.View
      entering={FadeInDown.duration(motionDuration.smooth)}
      exiting={FadeOut.duration(motionDuration.snappy)}
      accessibilityLabel={a11y}
      accessibilityLiveRegion="polite"
      style={styles.wrap}>
      <Text style={[styles.role, { color: accent }]}>{label}</Text>
      <View style={[styles.bar, { backgroundColor: accent }]} />
      {text ? (
        <Text style={[styles.body, { color: textColor }]} numberOfLines={3}>
          {text}
        </Text>
      ) : null}
      {showDots ? (
        <View style={styles.dots} accessibilityLabel="Poppins is thinking">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: accent, opacity: 0.5 + i * 0.2 }]}
            />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    maxHeight: 118,
    overflow: 'hidden',
    width: '100%',
  },
  role: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  bar: {
    borderRadius: 999,
    height: 2,
    marginBottom: 10,
    width: 28,
  },
  body: {
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: -0.2,
    lineHeight: 26,
    textAlign: 'center',
    width: '100%',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 12,
  },
  dot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
});
