import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { NovaOrb } from '@/components/orbit/nova-orb';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { NovaConversationAnswer } from '@/types/orbit';

export default function NovaScreen() {
  const {
    askNova,
    metrics,
    novaBriefing,
    novaRecommendations,
    novaWeeklyBriefing,
    suggestedNovaQuestions,
  } = useOrbit();
  const [conversation, setConversation] = useState<NovaConversationAnswer | null>(null);

  const handleQuestion = async (question: string) => {
    const answer = await askNova(question);
    setConversation(answer);
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Local intelligence mode</Text>
        <Text style={orbitTypography.display}>Nova</Text>
        <Text style={orbitTypography.body}>Briefings are generated from current household state. No OpenAI calls yet.</Text>
      </View>

      <GlassCard elevated style={styles.hero}>
        <NovaOrb />
        <View style={styles.heroCopy}>
          <StatusPill label={`${metrics.momentum}% Momentum`} tone={metrics.momentum >= 80 ? 'green' : 'amber'} />
          <Text style={orbitTypography.title}>{novaBriefing.title}</Text>
          <Text style={styles.summary}>{novaBriefing.summary}</Text>
        </View>
      </GlassCard>

      <GlassCard>
        <View style={orbitScreen.row}>
          <Text style={orbitTypography.cardTitle}>Daily briefing</Text>
          <StatusPill label="Today" tone="cyan" />
        </View>
        <Text style={orbitTypography.body}>{novaBriefing.summary}</Text>
        {novaBriefing.actions.map((action) => (
          <View key={action} style={styles.actionRow}>
            <View style={styles.dot} />
            <Text style={styles.actionText}>{action}</Text>
          </View>
        ))}
      </GlassCard>

      <GlassCard>
        <View style={orbitScreen.row}>
          <Text style={orbitTypography.cardTitle}>Weekly report</Text>
          <StatusPill label={`${novaWeeklyBriefing.momentumChange >= 0 ? '+' : ''}${novaWeeklyBriefing.momentumChange}`} tone="blue" />
        </View>
        <Text style={orbitTypography.caption}>{novaWeeklyBriefing.summary}</Text>
        <View style={styles.metricGrid}>
          <Metric label="Completed" value={novaWeeklyBriefing.tasksCompleted} />
          <Metric label="Missed" value={novaWeeklyBriefing.tasksMissed} />
          <Metric label="Purchased" value={novaWeeklyBriefing.groceriesPurchased} />
          <Metric label="XP earned" value={novaWeeklyBriefing.xpEarned} />
        </View>
        <Text style={styles.weeklyLeader}>Most active: {novaWeeklyBriefing.mostActiveMember}</Text>
      </GlassCard>

      <GlassCard>
        <Text style={orbitTypography.cardTitle}>Recommendations</Text>
        {novaRecommendations.map((recommendation) => (
          <View key={recommendation.id} style={styles.recommendation}>
            <StatusPill label={recommendation.title} tone={recommendation.tone} />
            <Text style={orbitTypography.caption}>{recommendation.detail}</Text>
          </View>
        ))}
      </GlassCard>

      <GlassCard>
        <Text style={orbitTypography.cardTitle}>Ask Nova</Text>
        <View style={styles.questionGrid}>
          {suggestedNovaQuestions.map((question) => (
            <Pressable key={question} onPress={() => handleQuestion(question)} style={styles.questionChip}>
              <Text style={styles.questionText}>{question}</Text>
            </Pressable>
          ))}
        </View>
        {conversation ? (
          <View style={styles.answerBox}>
            <Text style={styles.questionLabel}>{conversation.question}</Text>
            <Text style={orbitTypography.body}>{conversation.answer}</Text>
          </View>
        ) : null}
      </GlassCard>

      <OrbitButton tone="secondary" onPress={() => setConversation({
        question: 'Voice mode',
        answer: 'Voice is a placeholder for now. Realtime audio will be added only when OpenAI Realtime is connected.',
      })}>
        Voice Button Placeholder
      </OrbitButton>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: number | string; value: number | string }) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: orbitSpacing.sm,
  },
  actionText: {
    color: orbitColors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  answerBox: {
    backgroundColor: 'rgba(0, 194, 255, 0.08)',
    borderColor: 'rgba(0, 194, 255, 0.24)',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    gap: orbitSpacing.xs,
    padding: orbitSpacing.md,
  },
  dot: {
    backgroundColor: orbitColors.novaCyan,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  heroCopy: {
    flex: 1,
    gap: orbitSpacing.sm,
    paddingLeft: orbitSpacing.md,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: orbitSpacing.sm,
  },
  metricLabel: {
    color: orbitColors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  metricTile: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: orbitRadius.sm,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 4,
    padding: orbitSpacing.md,
  },
  metricValue: {
    color: orbitColors.text,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
  },
  questionChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    paddingHorizontal: orbitSpacing.md,
    paddingVertical: orbitSpacing.sm,
  },
  questionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: orbitSpacing.sm,
  },
  questionLabel: {
    color: orbitColors.novaCyan,
    fontSize: 13,
    fontWeight: '900',
  },
  questionText: {
    color: orbitColors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  recommendation: {
    gap: orbitSpacing.xs,
  },
  summary: {
    color: orbitColors.textMuted,
    fontSize: 16,
    lineHeight: 23,
  },
  weeklyLeader: {
    color: orbitColors.novaCyan,
    fontSize: 14,
    fontWeight: '900',
  },
});
