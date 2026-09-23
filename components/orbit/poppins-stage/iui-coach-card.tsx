/**
 * WO12 §D2 — coach_steps card (Coach.html).
 * Teaching never arms a hold and never costs an action.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
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
  const teach = STAGE.shell.teach;
  const teachNum = STAGE.shell.teachNum;
  const steps = payload.coachSteps ?? [];
  const canDo = payload.canDoItForYou === true && Boolean(onJustDoIt);
  const headline = payload.coachLine ?? payload.subtitle ?? 'Here is how.';
  const detail =
    payload.subtitle && payload.subtitle !== headline ? payload.subtitle : undefined;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.92)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,28,42,0.10)',
          },
        ]}
        accessibilityLabel={`How to: ${payload.title ?? 'teach'}`}>
        <View style={styles.head}>
          <Text style={[styles.titleKicker, { color: teach }]} numberOfLines={1}>
            {(payload.title ?? 'How to').toUpperCase()}
          </Text>
          <Text style={[styles.answer, { color: c.text }]}>{headline}</Text>
          {detail ? (
            <Text style={[styles.detail, { color: muted }]}>{detail}</Text>
          ) : payload.sourceUtterance ? (
            <Text style={[styles.detail, { color: muted }]} numberOfLines={2}>
              “{payload.sourceUtterance}”
            </Text>
          ) : null}
        </View>

        <View style={styles.steps}>
          {steps.map((step, index) => {
            const navigates = Boolean(step.route || step.targetId);
            return (
              <View
                key={step.id}
                style={[
                  styles.stepRow,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,28,42,0.04)',
                  },
                ]}>
                <View style={[styles.stepNum, { backgroundColor: `${STAGE.domain.household}2E` }]}>
                  <Text style={[styles.stepNumLabel, { color: teachNum }]}>{index + 1}</Text>
                </View>
                <Text style={[styles.stepText, { color: c.text }]}>{step.text}</Text>
                {navigates ? (
                  <Text style={[styles.chevron, { color: faint }]}>›</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <View
          style={[
            styles.footer,
            {
              backgroundColor: `${STAGE.domain.household}14`,
              borderTopColor: `${STAGE.domain.household}33`,
            },
          ]}>
          <Pressable
            onPress={onWalkThrough}
            accessibilityRole="button"
            accessibilityLabel="Walk me through it"
            style={[styles.primaryBtn, { backgroundColor: teach }]}>
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
              <Text style={[styles.secondaryLabel, { color: isDark ? '#C8D8F0' : c.text }]}>
                Just do it
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 12, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
  },
  head: { gap: 8, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 14 },
  titleKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  answer: { fontSize: 21, lineHeight: 27, fontWeight: '600' },
  detail: { fontSize: 13, lineHeight: 19 },
  steps: { gap: 8, paddingHorizontal: 20, paddingBottom: 16 },
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
  chevron: { fontSize: 22, fontWeight: '300', lineHeight: 24 },
  footer: {
    paddingTop: 14,
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: STAGE.radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryLabel: { color: '#061424', fontWeight: '600', fontSize: 14 },
  secondaryBtn: {
    minHeight: 46,
    borderRadius: STAGE.radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 13,
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
});
