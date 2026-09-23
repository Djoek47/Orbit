/**
 * WO12 §D2 — coach_steps card: numbered how-to + Walk me through / Just do it.
 * Domain-cyan (household) kicker. Teaching never arms a hold.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { IuiCard } from '@/components/orbit/poppins-stage/iui-card';
import { STAGE, stageFaint, stageMuted } from '@/constants/iui-stage';
import type { IuiPayload } from '@/lib/poppins/ui-scenes';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  payload: IuiPayload;
  accent: string;
  onWalkThrough: () => void;
  onJustDoIt?: () => void;
};

export function IuiCoachCard({ payload, accent, onWalkThrough, onJustDoIt }: Props) {
  const { isDark, c } = useOrbitColors();
  const muted = stageMuted(isDark);
  const faint = stageFaint(isDark);
  const steps = payload.coachSteps ?? [];
  const canDo = payload.canDoItForYou === true && Boolean(onJustDoIt);

  return (
    <View style={styles.wrap}>
      <IuiCard
        accent={accent}
        kicker="Teaching · free"
        countLabel="No actions used"
        accessibilityLabel={`How to: ${payload.title ?? 'teach'}`}>
        <View style={styles.head}>
          <Text style={[styles.titleKicker, { color: accent }]} numberOfLines={1}>
            {(payload.title ?? 'How to').toUpperCase()}
          </Text>
          <Text style={[styles.answer, { color: c.text }]}>
            {payload.coachLine ?? payload.subtitle ?? 'Here is how.'}
          </Text>
          {payload.sourceUtterance ? (
            <Text style={[styles.quote, { color: muted }]} numberOfLines={2}>
              “{payload.sourceUtterance}”
            </Text>
          ) : null}
        </View>

        <View style={styles.steps}>
          {steps.map((step, index) => (
            <View
              key={step.id}
              style={[
                styles.stepRow,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,28,42,0.04)',
                },
              ]}>
              <View style={[styles.stepNum, { backgroundColor: `${accent}2E` }]}>
                <Text style={[styles.stepNumLabel, { color: accent }]}>{index + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: c.text }]}>{step.text}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.footer, { backgroundColor: `${accent}14`, borderTopColor: `${accent}33` }]}>
          <Pressable
            onPress={onWalkThrough}
            accessibilityRole="button"
            accessibilityLabel="Walk me through it"
            style={[styles.primaryBtn, { backgroundColor: accent }]}>
            <Text style={styles.primaryLabel}>Walk me through it</Text>
          </Pressable>
          {canDo ? (
            <Pressable
              onPress={onJustDoIt}
              accessibilityRole="button"
              accessibilityLabel="Just do it"
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,28,42,0.06)',
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,28,42,0.10)',
                },
              ]}>
              <Text style={[styles.secondaryLabel, { color: c.text }]}>Just do it</Text>
            </Pressable>
          ) : null}
        </View>
      </IuiCard>

      <View
        style={[
          styles.note,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.13)' : 'rgba(15,28,42,0.13)',
          },
        ]}>
        <Text style={[styles.noteText, { color: muted }]}>
          Teaching never costs an action. Asking how something works is free — only doing it counts.
        </Text>
      </View>
      <Text style={[styles.freeHint, { color: faint }]}>0 actions</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 12, alignItems: 'center' },
  head: { gap: 8, paddingBottom: 4 },
  titleKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  answer: { fontSize: 21, lineHeight: 27, fontWeight: '600' },
  quote: { fontSize: 13, lineHeight: 18 },
  steps: { gap: 8, paddingBottom: 4 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumLabel: { fontSize: 12, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 14, lineHeight: 19 },
  footer: {
    marginHorizontal: -4,
    marginBottom: -4,
    marginTop: 4,
    paddingTop: 14,
    paddingBottom: 4,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: STAGE.radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryLabel: { color: '#061424', fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    minHeight: 44,
    borderRadius: STAGE.radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryLabel: { fontWeight: '600', fontSize: 14 },
  note: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  noteText: { fontSize: 12, lineHeight: 17 },
  freeHint: { fontSize: 11, fontWeight: '600', letterSpacing: 1.1 },
});
