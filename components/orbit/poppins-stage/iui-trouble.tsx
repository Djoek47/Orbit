/**
 * WO12 §F — four trouble states, all inside the same card shell.
 * Never invent a value; never put a failure sentence on a successful act.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { IuiCard } from '@/components/orbit/poppins-stage/iui-card';
import { STAGE, stageBorder, stageDangerText, stageMuted } from '@/constants/iui-stage';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

/** WO10 §A2 honest quiet-capture reasons, surfaced on the stage. */
export const NOTHING_HEARD_COPY: Record<string, { title: string; reason: string }> = {
  no_audio: {
    title: "I didn't hear words",
    reason: "The microphone didn't record anything. Check mic access in Settings.",
  },
  too_short: {
    title: 'That was too short',
    reason: 'Hold, speak, then let go.',
  },
  empty_transcript: {
    title: "I didn't hear words",
    reason: 'The mic recorded silence. Hold, speak, let go.',
  },
  transcribe_failed: {
    title: "Couldn't reach the transcriber",
    reason: 'Check your connection, then try again.',
  },
};

type MissingSlotProps = {
  accent: string;
  fillAccent?: string;
  question: string;
  why: string;
  chips: Array<{ id: string; label: string }>;
  onPick: (id: string, label: string) => void;
};

/** 1. A slot is missing — ask, don't guess. */
export function IuiTroubleMissingSlot({
  accent,
  fillAccent,
  question,
  why,
  chips,
  onPick,
}: MissingSlotProps) {
  const { isDark, c } = useOrbitColors();
  const muted = stageMuted(isDark);
  return (
    <IuiCard
      accent={accent}
      fillAccent={fillAccent ?? accent}
      kicker="Needs you"
      accessibilityLabel={question}>
      <Text style={[styles.q, { color: c.text }]}>{question}</Text>
      <Text style={[styles.why, { color: muted }]}>{why}</Text>
      <View style={styles.chips}>
        {chips.slice(0, 3).map((chip) => (
          <Pressable
            key={chip.id}
            onPress={() => onPick(chip.id, chip.label)}
            accessibilityRole="button"
            accessibilityLabel={chip.label}
            style={[
              styles.chip,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,28,42,0.04)',
                borderColor: stageBorder(isDark),
              },
            ]}>
            <Text style={[styles.chipLabel, { color: c.text }]}>{chip.label}</Text>
          </Pressable>
        ))}
      </View>
    </IuiCard>
  );
}

type NothingHeardProps = {
  accent: string;
  failed?: keyof typeof NOTHING_HEARD_COPY | string;
  title?: string;
  reason?: string;
  onRetry: () => void;
};

/** 2. Nothing heard — honest WO10 §A2 reason + Again. */
export function IuiTroubleNothingHeard({
  accent,
  failed = 'empty_transcript',
  title,
  reason,
  onRetry,
}: NothingHeardProps) {
  const { isDark, c } = useOrbitColors();
  const muted = stageMuted(isDark);
  const copy = NOTHING_HEARD_COPY[failed] ?? {
    title: title ?? "I didn't hear words",
    reason: reason ?? 'Hold, speak, let go.',
  };
  return (
    <IuiCard accent={accent} kicker="Nothing heard" accessibilityLabel={copy.title}>
      <View style={styles.heardRow}>
        <View
          style={[
            styles.micTile,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,28,42,0.05)' },
          ]}>
          <Text style={[styles.micGlyph, { color: muted }]}>🎤</Text>
          <View style={[styles.micSlash, { backgroundColor: muted }]} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.heardTitle, { color: c.text }]}>{copy.title}</Text>
          <Text style={[styles.why, { color: muted }]}>{copy.reason}</Text>
        </View>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Again"
          style={[styles.again, { backgroundColor: accent }]}>
          <Text style={styles.againLabel}>Again</Text>
        </Pressable>
      </View>
    </IuiCard>
  );
}

type RowFailedProps = {
  accent: string;
  failedLabel: string;
  savedLine: string;
  onRetry: () => void;
  onLeave: () => void;
};

/** 3. A row failed — failed stays red; committed rows keep their checks. */
export function IuiTroubleRowFailed({
  failedLabel,
  savedLine,
  onRetry,
  onLeave,
}: RowFailedProps) {
  const { isDark, c } = useOrbitColors();
  return (
    <View
      style={[
        styles.failCard,
        {
          backgroundColor: `${STAGE.semantic.danger}0F`,
          borderColor: `${STAGE.semantic.danger}52`,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${failedLabel} didn't save`}>
      <View style={styles.failHead}>
        <MaterialIcons name="warning" size={19} color={STAGE.semantic.danger} />
        <Text style={[styles.failTitle, { color: c.text }]}>{failedLabel} didn’t save</Text>
      </View>
      <Text style={[styles.why, { color: isDark ? STAGE.ink.softDark : stageMuted(false) }]}>{savedLine}</Text>
      <View style={styles.failActions}>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={`Retry ${failedLabel}`}
          style={styles.retryBtn}>
          <Text style={styles.retryLabel}>Retry {failedLabel}</Text>
        </Pressable>
        <Pressable
          onPress={onLeave}
          accessibilityRole="button"
          accessibilityLabel="Leave it"
          style={[
            styles.leaveBtn,
            { borderColor: stageBorder(isDark, true) },
          ]}>
          <Text style={[styles.leaveLabel, { color: c.text }]}>Leave it</Text>
        </Pressable>
      </View>
    </View>
  );
}

type ModelDownProps = {
  accent: string;
  confirmation: string;
};

/**
 * 4. The model is down, the acts are not —
 * show the act's confirmation, never a failure sentence.
 */
export function IuiTroubleModelDown({ accent, confirmation }: ModelDownProps) {
  const { isDark, c } = useOrbitColors();
  const muted = stageMuted(isDark);
  return (
    <IuiCard accent={accent} kicker="Saved" accessibilityLabel={confirmation}>
      <Text style={[styles.q, { color: c.text }]}>{confirmation}</Text>
      <Text style={[styles.why, { color: muted }]}>
        The talking part is offline, so I’ll keep it short until it’s back. Everything you ask for
        still happens.
      </Text>
    </IuiCard>
  );
}

const styles = StyleSheet.create({
  q: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  why: { fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    minHeight: 44,
    borderRadius: STAGE.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  chipLabel: { fontSize: 13, fontWeight: '500' },
  heardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  micTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micGlyph: { fontSize: 18 },
  micSlash: {
    position: 'absolute',
    width: 22,
    height: 2,
    transform: [{ rotate: '-40deg' }],
  },
  heardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  again: {
    minHeight: 44,
    borderRadius: STAGE.radius.pill,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  againLabel: { color: STAGE.ink.onAccent, fontWeight: '700', fontSize: 13 },
  failCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  failHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  failTitle: { flex: 1, fontSize: 19, lineHeight: 24, fontWeight: '600' },
  failActions: { flexDirection: 'row', gap: 8 },
  retryBtn: {
    minHeight: 44,
    borderRadius: STAGE.radius.pill,
    paddingHorizontal: 17,
    justifyContent: 'center',
    backgroundColor: STAGE.ink.retryFill,
  },
  retryLabel: { color: STAGE.ink.retryInk, fontWeight: '700', fontSize: 13 },
  leaveBtn: {
    minHeight: 44,
    borderRadius: STAGE.radius.pill,
    paddingHorizontal: 17,
    justifyContent: 'center',
    borderWidth: 1,
  },
  leaveLabel: { fontWeight: '600', fontSize: 13 },
});
