/**
 * The voice wheel.
 *
 * Choosing how Poppins sounds used to mean reading a list of characters. Now it is a colour:
 * drag round the arc and the whole card takes on that colour as the name and the sound change
 * with it. Warm at one end, cool at the other, even through the middle.
 *
 * The arc is a run of short solid strokes coloured by lib/ai/poppins-voices, so the picture on
 * screen and the list of voices can never disagree.
 */
import * as Haptics from 'expo-haptics';
import { useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import {
  angleForPosition,
  colorAtPosition,
  poppinsVoice,
  POPPINS_VOICES,
  positionForTouch,
  voiceAccessibilityLabel,
  voiceAtPosition,
  wheelSegments,
  type PoppinsVoice,
} from '@/lib/ai/poppins-voices';
import type { MajordomoVoiceId } from '@/lib/ai/majordomo-profiles';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const SIZE = 236;
const STROKE = 20;
const R = (SIZE - STROKE) / 2 - 6;
const CENTER = SIZE / 2;
const KNOB = 26;

function pointOnArc(deg: number, radius = R): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function arcPath(fromDeg: number, toDeg: number): string {
  const a = pointOnArc(fromDeg);
  const b = pointOnArc(toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${R} ${R} 0 ${large} 1 ${b.x} ${b.y}`;
}

type WheelHooks = {
  /** Read at touch time, not at build time. */
  isDisabled: () => boolean;
  select: (voiceId: MajordomoVoiceId) => void;
  centre: () => { x: number; y: number };
  lastVoice: () => MajordomoVoiceId;
  rememberVoice: (voiceId: MajordomoVoiceId) => void;
  setDragging: (next: number | null | ((current: number | null) => number | null)) => void;
};

/**
 * The drag handler, built once and kept for the life of the wheel. It lives out here so the
 * refs it reads are only touched when a finger actually moves.
 */
function wheelResponder(hooks: WheelHooks) {
  const track = (event: GestureResponderEvent) => {
    if (hooks.isDisabled()) return;
    const centre = hooks.centre();
    const next = positionForTouch(
      event.nativeEvent.pageX - centre.x,
      event.nativeEvent.pageY - centre.y
    );
    hooks.setDragging(next);
    const voice = voiceAtPosition(next);
    if (voice.id !== hooks.lastVoice()) {
      hooks.rememberVoice(voice.id);
      void Haptics.selectionAsync();
    }
  };

  return PanResponder.create({
    onStartShouldSetPanResponder: () => !hooks.isDisabled(),
    onMoveShouldSetPanResponder: () => !hooks.isDisabled(),
    onPanResponderGrant: track,
    onPanResponderMove: track,
    onPanResponderRelease: () => {
      hooks.setDragging((current) => {
        if (current != null && !hooks.isDisabled()) {
          hooks.select(voiceAtPosition(current).id);
        }
        return null;
      });
    },
    onPanResponderTerminate: () => hooks.setDragging(null),
    // A sideways drag round the wheel is the wheel's — don't hand it to the scroll view.
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  });
}

type Props = {
  voiceId: MajordomoVoiceId;
  disabled?: boolean;
  /** Fires once per voice as a drag crosses it, and on release. */
  onSelect: (voiceId: MajordomoVoiceId) => void;
  /** Play a line in this voice. Omit to hide the button. */
  onPreview?: (voice: PoppinsVoice) => void;
  previewBusy?: boolean;
};

export function VoiceWheel({ voiceId, disabled, onSelect, onPreview, previewBusy }: Props) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const selected = poppinsVoice(voiceId);
  // While dragging, the wheel follows the finger; otherwise it follows the saved voice.
  const [dragging, setDragging] = useState<number | null>(null);
  const position = dragging ?? selected.position;
  const live = dragging == null ? selected : voiceAtPosition(dragging);
  const liveColor = colorAtPosition(position);

  const segments = useMemo(() => wheelSegments(72), []);

  // Sweeping the wheel left to right is the same motion as iOS's swipe back / pull to dismiss,
  // so people left the page while choosing a voice. While the wheel is on screen, the page
  // doesn't close by gesture — the back button still does.
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
    return () => navigation.setOptions({ gestureEnabled: true });
  }, [navigation]);
  const pulse = useSharedValue(0);
  const lift = useSharedValue(0);

  // The responder is created once, so it reads the latest props through refs. They are synced
  // in an effect rather than during render, which is what React expects.
  const lastVoice = useRef(live.id);
  const disabledRef = useRef(disabled);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    disabledRef.current = disabled;
    onSelectRef.current = onSelect;
  }, [disabled, onSelect]);

  useEffect(() => {
    pulse.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    );
  }, [pulse]);

  useEffect(() => {
    lift.set(withTiming(dragging == null ? 0 : 1, { duration: 160 }));
  }, [dragging, lift]);

  // Page coordinates of the wheel's centre. A ref, because the responder needs the value
  // without being rebuilt mid-drag.
  const centerRef = useRef({ x: 0, y: 0 });

  const responder = useMemo(
    () =>
      wheelResponder({
        isDisabled: () => disabledRef.current === true,
        select: (next) => onSelectRef.current(next),
        centre: () => centerRef.current,
        lastVoice: () => lastVoice.current,
        rememberVoice: (next) => {
          lastVoice.current = next;
        },
        setDragging,
      }),
    []
  );

  const knobAngle = angleForPosition(position);
  const knob = pointOnArc(knobAngle);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.35,
    transform: [{ scale: 0.94 + pulse.value * 0.06 + lift.value * 0.04 }],
  }));
  const knobScale = useDerivedValue(() => 1 + lift.value * 0.22);
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ scale: knobScale.value }] }));

  return (
    <View style={styles.root}>
      <View
        style={styles.wheelWrap}
        onLayout={(event) => {
          // Page coordinates of the wheel's centre, so a touch can be turned into an angle.
          event.currentTarget.measure?.((_x, _y, w, h, pageX, pageY) => {
            centerRef.current = {
              x: (pageX ?? 0) + (w ?? SIZE) / 2,
              y: (pageY ?? 0) + (h ?? SIZE) / 2,
            };
          });
        }}
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={voiceAccessibilityLabel(live)}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (disabled) return;
          const index = POPPINS_VOICES.findIndex((voice) => voice.id === live.id);
          const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
          const next = POPPINS_VOICES[Math.min(POPPINS_VOICES.length - 1, Math.max(0, index + step))];
          if (next) onSelect(next.id);
        }}>
        {/* The colour behind the glass, so the whole wheel glows in the chosen voice. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.glow, { backgroundColor: `${liveColor}33` }, glowStyle]}
        />
        <Svg width={SIZE} height={SIZE} pointerEvents="none">
          {/* The track, so the arc reads as a dial even at the unlit end. */}
          <Path
            d={arcPath(angleForPosition(0), angleForPosition(1))}
            stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,28,42,0.08)'}
            strokeWidth={STROKE + 6}
            strokeLinecap="round"
            fill="none"
          />
          {segments.map((segment) => (
            <Path
              key={segment.from}
              d={arcPath(angleForPosition(segment.from), angleForPosition(segment.to) + 0.6)}
              stroke={segment.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
              fill="none"
              opacity={disabled ? 0.45 : 1}
            />
          ))}
          {/* A tick where each voice sits, so the wheel reads as ten choices, not a slider. */}
          {POPPINS_VOICES.map((voice) => {
            const point = pointOnArc(angleForPosition(voice.position), R);
            const on = voice.id === live.id;
            return (
              <Circle
                key={voice.id}
                cx={point.x}
                cy={point.y}
                r={on ? 0 : 2.4}
                fill={isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.75)'}
              />
            );
          })}
        </Svg>

        {/* The knob. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.knob,
            {
              left: knob.x - KNOB / 2,
              top: knob.y - KNOB / 2,
              backgroundColor: isDark ? '#0B1220' : '#FFFFFF',
              borderColor: liveColor,
            },
            knobStyle,
          ]}>
          <View style={[styles.knobDot, { backgroundColor: liveColor }]} />
        </Animated.View>

        {/* The middle: the name of the colour, which is the whole name of the voice now. */}
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

      {/* The ends, named by how they sound rather than by who they sound like. */}
      <View style={styles.endsRow}>
        <Text style={[styles.endLabel, { color: c.textSubtle }]}>Higher</Text>
        <Text style={[styles.endLabel, { color: c.textSubtle }]}>Lower</Text>
      </View>

      {/* The swatches, for anyone who would rather tap than drag. */}
      <View style={styles.swatchRow}>
        {POPPINS_VOICES.map((voice) => {
          const on = voice.id === live.id;
          return (
            <Pressable
              key={voice.id}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled }}
              accessibilityLabel={voiceAccessibilityLabel(voice)}
              onPress={() => {
                void Haptics.selectionAsync();
                onSelect(voice.id);
              }}
              style={[
                styles.swatch,
                {
                  backgroundColor: voice.color,
                  borderColor: on ? c.text : 'transparent',
                  opacity: disabled ? 0.5 : on ? 1 : 0.82,
                  transform: [{ scale: on ? 1.18 : 1 }],
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

      <View style={[styles.divider, { backgroundColor: glassBorder(0.08) }]} />
      <View style={[styles.previewLine, { backgroundColor: glass(0.05), borderColor: `${liveColor}33` }]}>
        <View style={[styles.previewDot, { backgroundColor: liveColor }]} />
        <Text style={[styles.previewText, { color: c.textSoft }]}>
          “Nero still owes the bins. Shall I remind him after dinner?”
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 12 },
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
    position: 'absolute',
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
    marginTop: -14,
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
  divider: { height: StyleSheet.hairlineWidth, width: '70%' },
  previewLine: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  previewDot: { borderRadius: 4, height: 8, width: 8 },
  previewText: { flex: 1, fontSize: 13.5, fontStyle: 'italic', lineHeight: 19 },
});
