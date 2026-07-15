import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { GlassCard } from '@/components/orbit/glass-card';
import { NovaOrb, type NovaOrbState } from '@/components/orbit/nova-orb';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { isLiveNovaEnabled } from '@/lib/ai/ai-provider';
import { startVoiceCapture, stopVoiceCapture, speakNova, stopSpeaking } from '@/lib/voice/nova-voice';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function NovaScreen() {
  const {
    askNova,
    askNovaVoice,
    metrics,
    novaAskCount,
    novaBriefing,
    novaConversation,
    novaRecommendations,
    novaWeeklyBriefing,
    suggestedNovaQuestions,
  } = useOrbit();
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const orbState: NovaOrbState = useMemo(() => {
    if (voiceBusy) return 'listening';
    if (asking) return 'thinking';
    return 'idle';
  }, [asking, voiceBusy]);

  const thread = useMemo(() => {
    const pairs: { question: string; answer: string }[] = [];
    for (let i = 0; i < novaConversation.length; i += 2) {
      const user = novaConversation[i];
      const assistant = novaConversation[i + 1];
      if (user?.role === 'user' && assistant?.role === 'assistant') {
        pairs.push({ question: user.content, answer: assistant.content });
      }
    }
    return pairs;
  }, [novaConversation]);

  const handleQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || asking) {
      return;
    }
    setAsking(true);
    setError('');
    try {
      const answer = await askNova(trimmed);
      setDraft('');
      if (answer.answer.includes('could not') && isLiveNovaEnabled()) {
        setError('Nova had trouble reaching the AI service. Showing the best available answer.');
      }
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setError('Nova could not answer right now. Try again in a moment.');
    } finally {
      setAsking(false);
    }
  };

  const handleVoice = async () => {
    if (voiceBusy || asking) {
      return;
    }
    setVoiceBusy(true);
    setError('');
    try {
      await stopSpeaking();
      await startVoiceCapture();
      const uri = await stopVoiceCapture();
      setVoiceBusy(false);
      setAsking(true);
      const answer = await askNovaVoice(uri);
      await speakNova(answer.answer);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setError('Voice capture failed. Check microphone permission and try again.');
    } finally {
      setVoiceBusy(false);
      setAsking(false);
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Household co-manager</Text>
        <Text style={orbitTypography.display}>Nova</Text>
        <Text style={orbitTypography.body}>
          Calm briefings and answers grounded in today’s household state.
        </Text>
      </View>

      <GlassCard elevated style={styles.hero}>
        <NovaOrb state={orbState} />
        <View style={styles.heroCopy}>
          <StatusPill
            label={isLiveNovaEnabled() ? 'Live GPT' : 'Demo mode'}
            tone={isLiveNovaEnabled() ? 'green' : 'blue'}
          />
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
          <Pressable onPress={() => router.push('/weekly-report' as never)}>
            <Text style={styles.linkHint}>Open</Text>
          </Pressable>
        </View>
        <Text style={orbitTypography.caption}>{novaWeeklyBriefing.summary}</Text>
        <Text style={styles.weeklyLeader}>Most active: {novaWeeklyBriefing.mostActiveMember}</Text>
      </GlassCard>

      <GlassCard>
        <Text style={orbitTypography.cardTitle}>Recommendations</Text>
        {novaRecommendations.length === 0 ? (
          <Text style={orbitTypography.caption}>Nova will surface recommendations as activity picks up.</Text>
        ) : (
          novaRecommendations.map((recommendation) => (
            <View key={recommendation.id} style={styles.recommendation}>
              <StatusPill label={recommendation.title} tone={recommendation.tone} />
              <Text style={orbitTypography.caption}>{recommendation.detail}</Text>
            </View>
          ))
        )}
      </GlassCard>

      <GlassCard>
        <View style={orbitScreen.row}>
          <Text style={orbitTypography.cardTitle}>Conversation</Text>
          <StatusPill label={`${novaAskCount} asks`} tone="blue" />
        </View>

        <View style={styles.questionGrid}>
          {suggestedNovaQuestions.map((question) => (
            <Pressable
              key={question}
              disabled={asking || voiceBusy}
              onPress={() => handleQuestion(question)}
              style={styles.questionChip}>
              <Text style={styles.questionText}>{question}</Text>
            </Pressable>
          ))}
        </View>

        {thread.length === 0 ? (
          <Text style={orbitTypography.caption}>Ask a suggested question, type below, or talk to Nova.</Text>
        ) : (
          thread.map((item, index) => (
            <View key={`${item.question}-${index}`} style={styles.threadBlock}>
              <View style={styles.userBubble}>
                <Text style={styles.userBubbleText}>{item.question}</Text>
              </View>
              <View style={styles.answerBox}>
                <Text style={styles.questionLabel}>Nova</Text>
                <Text style={orbitTypography.body}>{item.answer}</Text>
              </View>
            </View>
          ))
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask Nova anything about the household…"
          placeholderTextColor={orbitColors.textSubtle}
          style={styles.input}
          multiline
        />
        <OrbitButton disabled={asking || voiceBusy || draft.trim().length < 2} onPress={() => handleQuestion(draft)}>
          {asking ? 'Thinking…' : 'Send'}
        </OrbitButton>
        <OrbitButton disabled={asking || voiceBusy} tone="secondary" onPress={handleVoice}>
          {voiceBusy ? 'Listening…' : 'Talk to Nova'}
        </OrbitButton>
      </GlassCard>
    </ScrollView>
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
  error: {
    color: orbitColors.warning,
    fontSize: 13,
    fontWeight: '700',
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
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    color: orbitColors.text,
    fontSize: 16,
    minHeight: 56,
    padding: orbitSpacing.md,
    textAlignVertical: 'top',
  },
  linkHint: {
    color: orbitColors.novaCyan,
    fontSize: 13,
    fontWeight: '700',
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
  threadBlock: {
    gap: orbitSpacing.sm,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(41, 121, 255, 0.22)',
    borderRadius: orbitRadius.md,
    maxWidth: '88%',
    paddingHorizontal: orbitSpacing.md,
    paddingVertical: orbitSpacing.sm,
  },
  userBubbleText: {
    color: orbitColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  weeklyLeader: {
    color: orbitColors.novaCyan,
    fontSize: 14,
    fontWeight: '900',
  },
});
