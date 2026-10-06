/**
 * The voice wheel.
 *
 * Choosing how Poppins sounds is a colour: drag round the arc and the card takes on that
 * colour as the name and the sound change with it. Warm at one end, cool at the other.
 *
 * Dragging used to steal the Settings modal's swipe / back gesture and leave the arc's ends
 * looking unfinished. This wheel owns every touch in its pad, animates between colours, and
 * caps both ends of the arc so the gradient reads solid.
 */
import * as Haptics from 'expo-haptics';
import { useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import {
  angleForPosition,
  poppinsVoice,
  POPPINS_VOICES,
  positionForTouch,
  voiceAccessibilityLabel,
  voiceAtPosition,
  wheelSegments,
  WHEEL_START_DEG,
  WHEEL_SWEEP_DEG,
  type PoppinsVoice,
} from '@/lib/ai/poppins-voices';
import type { MajordomoVoiceId } from '@/lib/ai/majordomo-profiles';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const SIZE = 236;
const STROKE = 22;
const R = (SIZE - STROKE) / 2 - 6;
const CENTER = SIZE / 2;
const KNOB = 28;
/** Extra pad around the dial so a finger near the rim never hits the back chevron / sheet. */
const HIT_PAD = 28;

function pointOnArc(deg: number, radius = R): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function arcPath(fromDeg: number, toDeg: number): string {
  const a = pointOnArc(fromDeg);
  const b = pointOnArc(toDeg);
  const delta = ((toDeg - fromDeg) % 360 + 360) % 360;
  const large = delta > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${R} ${R} 0 ${large} 1 ${b.x} ${b.y}`;
}

type Props = {
  voiceId: MajordomoVoiceId;
  disabled?: boolean;
  /** Fires once per voice as a drag crosses it, and when a tap / release settles. */
  onSelect: (voiceId: MajordomoVoiceId) => void;
  /** Play a line in this voice. Omit to hide the button. */
  onPreview?: (voice: PoppinsVoice) => void;
  previewBusy?: boolean;
  /** True while a finger is on the dial — parent should lock scroll / sheet gestures. */
  onInteractionChange?: (active: boolean) => void;
};

export function VoiceWheel({
  voiceId,
  disabled,
  onSelect,
  onPreview,
  previewBusy,
  onInteractionChange,
}: Props) {
  const { c, isDark } = useOrbitColors();
  const selected = poppinsVoice(voiceId);

  // Displayed voice (hub + swatches). Follows the finger while dragging, snaps on release.
  const [liveId, setLiveId] = useState(selected.id);
  const [dragging, setDragging] = useState(false);
  const live = poppinsVoice(liveId);
  const liveColor = live.color;

  const segments = useMemo(() => wheelSegments(96), []);
  const startDeg = angleForPosition(0);
  const endDeg = angleForPosition(1);
  const startCap = pointOnArc(startDeg);
  const endCap = pointOnArc(endDeg);

  // Animated knob position along the wheel (0 → 1).
  const positionSV = useSharedValue(selected.position);
  const pulse = useSharedValue(0);
  const lift = useSharedValue(0);

  const wheelRef = useRef<View>(null);
  const centerRef = useRef({ x: 0, y: 0 });
  const lastVoiceRef = useRef(selected.id);
  const disabledRef = useRef(disabled);
  const onSelectRef = useRef(onSelect);
  const onInteractionRef = useRef(onInteractionChange);

  useEffect(() => {
    disabledRef.current = disabled;
    onSelectRef.current = onSelect;
    onInteractionRef.current = onInteractionChange;
  }, [disabled, onSelect, onInteractionChange]);

  // Keep the knob in sync when the saved voice changes from outside (and we're not dragging).
  useEffect(() => {
    if (dragging) return;
    lastVoiceRef.current = selected.id;
    setLiveId(selected.id);
    positionSV.value = withSpring(selected.position, { damping: 18, stiffness: 220, mass: 0.7 });
  }, [selected.id, selected.position, dragging, positionSV]);

  // While this wheel is mounted, the Settings sheet must not swipe closed under a drag.
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: false,
      fullScreenGestureEnabled: false,
    });
    return () =>
      navigation.setOptions({
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      });
  }, [navigation]);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, [pulse]);

  useEffect(() => {
    lift.value = withTiming(dragging ? 1 : 0, { duration: 160 });
  }, [dragging, lift]);

  const setInteraction = (active: boolean) => {
    setDragging(active);
    onInteractionRef.current?.(active);
  };

  const applyFinger = (pageX: number, pageY: number) => {
    if (disabledRef.current) return;
    const centre = centerRef.current;
    const next = positionForTouch(pageX - centre.x, pageY - centre.y);
    positionSV.value = next;
    const voice = voiceAtPosition(next);
    if (voice.id !== lastVoiceRef.current) {
      lastVoiceRef.current = voice.id;
      setLiveId(voice.id);
      void Haptics.selectionAsync();
    } else {
      setLiveId(voice.id);
    }
  };

  const beginFinger = (pageX: number, pageY: number) => {
    const finish = () => {
      setInteraction(true);
      applyFinger(pageX, pageY);
    };
    if (!wheelRef.current) {
      finish();
      return;
    }
    wheelRef.current.measureInWindow((x, y, w, h) => {
      centerRef.current = { x: x + w / 2, y: y + h / 2 };
      finish();
    });
  };

  const settleTo = (voice: PoppinsVoice, announce: boolean) => {
    positionSV.value = withSpring(voice.position, { damping: 18, stiffness: 220, mass: 0.7 });
    setLiveId(voice.id);
    lastVoiceRef.current = voice.id;
    if (announce) void Haptics.selectionAsync();
    onSelectRef.current(voice.id);
  };

  const releaseFinger = () => {
    const voice = voiceAtPosition(positionSV.value);
    settleTo(voice, false);
    setInteraction(false);
  };

  const cancelFinger = () => {
    setInteraction(false);
  };

  const pickVoice = (voice: PoppinsVoice) => {
    if (disabledRef.current) return;
    settleTo(voice, true);
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        // Claim immediately — don't let the sheet / scroll view win the first pixels.
        .minDistance(0)
        .maxPointers(1)
        .shouldCancelWhenOutside(false)
        .onBegin((event) => {
          runOnJS(beginFinger)(event.absoluteX, event.absoluteY);
        })
        .onUpdate((event) => {
          runOnJS(applyFinger)(event.absoluteX, event.absoluteY);
        })
        .onEnd(() => {
          runOnJS(releaseFinger)();
        })
        .onFinalize((_event, success) => {
          if (!success) runOnJS(cancelFinger)();
        }),
    // Intentional: handlers read refs; rebuild only when disabled flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled]
  );

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.35,
    transform: [{ scale: 0.94 + pulse.value * 0.06 + lift.value * 0.04 }],
  }));

  const knobStyle = useAnimatedStyle(() => {
    // Inline the angle maths — Reanimated worklets can't call the module helper.
    const p = Math.min(1, Math.max(0, positionSV.value));
    const deg = WHEEL_START_DEG + p * WHEEL_SWEEP_DEG;
    const rad = ((deg - 90) * Math.PI) / 180;
    const x = CENTER + R * Math.cos(rad) - KNOB / 2;
    const y = CENTER + R * Math.sin(rad) - KNOB / 2;
    const scale = 1 + lift.value * 0.2;
    return {
      transform: [{ translateX: x }, { translateY: y }, { scale }],
    };
  });

  // Slight overlap so neighbouring strokes never leave a hairline of track showing through.
  const OVERLAP_DEG = 1.2;

  return (
    <View style={styles.root}>
      {/* Capture pad: owns every touch in and around the dial so Settings can't swipe under it. */}
      <GestureDetector gesture={pan}>
        <View
          ref={wheelRef}
          collapsable={false}
          onLayout={() => {
            wheelRef.current?.measureInWindow((x, y, w, h) => {
              centerRef.current = { x: x + w / 2, y: y + h / 2 };
            });
          }}
          style={styles.hitPad}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={voiceAccessibilityLabel(live)}
          accessibilityState={{ disabled }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            if (disabled) return;
            const index = POPPINS_VOICES.findIndex((voice) => voice.id === live.id);
            const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
            const next =
              POPPINS_VOICES[Math.min(POPPINS_VOICES.length - 1, Math.max(0, index + step))];
            if (next) pickVoice(next);
          }}>
          <View style={styles.wheelWrap} pointerEvents="box-none">
            <Animated.View
              pointerEvents="none"
              style={[styles.glow, { backgroundColor: `${liveColor}33` }, glowStyle]}
            />
            <Svg width={SIZE} height={SIZE} pointerEvents="none">
              {/* Dim track under the colour — round caps give the dial its shape. */}
              <Path
                d={arcPath(startDeg, endDeg)}
                stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,28,42,0.1)'}
                strokeWidth={STROKE + 4}
                strokeLinecap="round"
                fill="none"
              />
              {segments.map((segment, index) => {
                const from = angleForPosition(segment.from);
                const to = angleForPosition(segment.to) + OVERLAP_DEG;
                const isEnd = index === 0 || index === segments.length - 1;
                return (
                  <Path
                    key={segment.from}
                    d={arcPath(from, to)}
                    stroke={segment.color}
                    strokeWidth={STROKE}
                    strokeLinecap={isEnd ? 'round' : 'butt'}
                    fill="none"
                    opacity={disabled ? 0.45 : 1}
                  />
                );
              })}
              {/* Solid end caps — the gradient stroke alone left the tips looking hollow. */}
              <Circle
                cx={startCap.x}
                cy={startCap.y}
                r={STROKE / 2}
                fill={POPPINS_VOICES[0]!.color}
                opacity={disabled ? 0.45 : 1}
              />
              <Circle
                cx={endCap.x}
                cy={endCap.y}
                r={STROKE / 2}
                fill={POPPINS_VOICES[POPPINS_VOICES.length - 1]!.color}
                opacity={disabled ? 0.45 : 1}
              />
              {POPPINS_VOICES.map((voice) => {
                const point = pointOnArc(angleForPosition(voice.position), R);
                const on = voice.id === live.id;
                return (
                  <Circle
                    key={voice.id}
                    cx={point.x}
                    cy={point.y}
                    r={on ? 0 : 2.2}
                    fill={isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.8)'}
                  />
                );
              })}
            </Svg>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.knob,
                {
                  backgroundColor: isDark ? '#0B1220' : '#FFFFFF',
                  borderColor: liveColor,
                },
                knobStyle,
              ]}>
              <View style={[styles.knobDot, { backgroundColor: liveColor }]} />
            </Animated.View>

            <View style={styles.hub} pointerEvents="none">
              <View style={[styles.hubMoji, { backgroundColor: `${liveColor}26` }]}>
                <Moji name="poppins" size={34} />
              </View>
              <Text style={[styles.hubName, { color: c.text }]} numberOfLines={1}>
                {live.label}
              </Text>
              <Text style={[styles.hubHint, { color: liveColor }]} numberOfLines={1}>
                {live.hint}
              </Text>
            </View>
          </View>
        </View>
      </GestureDetector>

      <View style={styles.endsRow} pointerEvents="none">
        <Text style={[styles.endLabel, { color: c.textSubtle }]}>Higher</Text>
        <Text style={[styles.endLabel, { color: c.textSubtle }]}>Lower</Text>
      </View>

      <View style={styles.swatchRow}>
        {POPPINS_VOICES.map((voice) => {
          const on = voice.id === live.id;
          return (
            <Pressable
              key={voice.id}
              disabled={disabled}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled }}
              accessibilityLabel={voiceAccessibilityLabel(voice)}
              onPress={() => pickVoice(voice)}
              style={[
                styles.swatch,
                {
                  backgroundColor: voice.color,
                  borderColor: on ? c.text : 'transparent',
                  opacity: disabled ? 0.5 : on ? 1 : 0.82,
                  transform: [{ scale: on ? 1.22 : 1 }],
                },
              ]}
            />
          );
        })}
      </View>

      {onPreview ? (
        <Pressable
          disabled={disabled || previewBusy}
          onPress={() => onPreview(live)}
          accessibilityRole="button"
          style={[
            styles.hear,
            {
              backgroundColor: `${liveColor}1F`,
              borderColor: `${liveColor}66`,
              opacity: disabled ? 0.5 : 1,
            },
          ]}>
          <Moji name="poppins" size={16} />
          <Text style={[styles.hearText, { color: c.text }]}>
            {previewBusy ? 'Speaking…' : `Hear ${live.label}`}
          </Text>
        </Pressable>
      ) : null}

      <Text style={[styles.footnote, { color: c.textSubtle }]}>
        {disabled
          ? 'Only an admin can change the voice.'
          : 'Drag round the wheel, or tap a colour. Poppins keeps this voice everywhere it speaks.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 12 },
  hitPad: {
    alignItems: 'center',
    justifyContent: 'center',
    // Pad past the dial so a clumsy finger near the rim still belongs to the wheel.
    padding: HIT_PAD,
  },
  wheelWrap: {
    alignItems: 'center',
    height: SIZE,
    justifyContent: 'center',
    width: SIZE,
  },
  glow: {
    borderRadius: SIZE,
    height: SIZE - STROKE * 2,
    position: 'absolute',
    width: SIZE - STROKE * 2,
  },
  knob: {
    alignItems: 'center',
    borderRadius: KNOB,
    borderWidth: 3,
    height: KNOB,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
    width: KNOB,
  },
  knobDot: { borderRadius: 5, height: 10, width: 10 },
  hub: { alignItems: 'center', gap: 4, paddingHorizontal: 30, position: 'absolute' },
  hubMoji: {
    alignItems: 'center',
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
    marginBottom: 2,
    width: 54,
  },
  hubName: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  hubHint: { fontSize: 12.5, fontWeight: '700' },
  endsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -HIT_PAD + 2,
    paddingHorizontal: 10,
    width: SIZE + 24,
  },
  endLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  swatchRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 2 },
  swatch: { borderRadius: 11, borderWidth: 2, height: 22, width: 22 },
  hear: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  hearText: { fontSize: 14, fontWeight: '700' },
  footnote: { fontSize: 12, lineHeight: 17, paddingHorizontal: 12, textAlign: 'center' },
});
