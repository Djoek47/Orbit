import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { NovaOrb } from '@/components/orbit/nova-orb';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { orbitColors, orbitRadius, orbitSpacing } from '@/constants/orbit-theme';
import {
  isNovaRealtimeEnabled,
  NovaRealtimeSession,
  toolCallToMonitorAction,
  type NovaRealtimeVisualState,
} from '@/lib/voice/nova-realtime';
import { useOrbit } from '@/store/orbit-store';
import type { NovaMonitorAction, NotificationItem } from '@/types/orbit';

type NovaTab = 'chat' | 'activity';
type NovaVisualState = 'idle' | 'listening' | 'thinking' | 'speaking';

const STATE_CONFIG: Record<NovaVisualState, { label: string; color: string; speaking: boolean }> = {
  idle: { label: 'Nova · Ready', color: '#06B6D4', speaking: false },
  listening: { label: 'Nova · Listening…', color: '#34D399', speaking: false },
  thinking: { label: 'Nova · Thinking…', color: '#A78BFA', speaking: false },
  speaking: { label: 'Nova · Speaking', color: '#38BDF8', speaking: true },
};

const ACTIVITY_TYPE_CONFIG: Record<
  string,
  { icon: keyof typeof MaterialIcons.glyphMap; color: string; action: string }
> = {
  tasks: { icon: 'check-circle', color: '#34D399', action: 'Task update' },
  ai: { icon: 'lightbulb', color: '#FBBF24', action: 'Nova insight' },
  events: { icon: 'place', color: '#38BDF8', action: 'Itinerary' },
  groceries: { icon: 'notifications', color: '#FB923C', action: 'Notification' },
  rewards: { icon: 'notifications-active', color: '#A78BFA', action: 'Reminder' },
  members: { icon: 'notifications', color: '#FB923C', action: 'Notification' },
  general: { icon: 'notifications', color: '#FB923C', action: 'Notification' },
  nudge: { icon: 'campaign', color: '#FB923C', action: 'Nudge' },
  deals: { icon: 'local-offer', color: '#34D399', action: 'Deals' },
  plan: { icon: 'map', color: '#38BDF8', action: 'Plan' },
  xp_fairness: { icon: 'balance', color: '#FBBF24', action: 'XP fairness' },
  holiday: { icon: 'flight', color: '#A78BFA', action: 'Holiday' },
  ask_info: { icon: 'help-outline', color: '#38BDF8', action: 'Asked' },
  monitor: { icon: 'visibility', color: '#06B6D4', action: 'Monitor' },
};

const MONITOR_KIND_EMOJI: Record<NovaMonitorAction['kind'], string> = {
  nudge: '📣',
  deals: '🏷️',
  plan: '🗺️',
  xp_fairness: '⚖️',
  holiday: '✈️',
  ask_info: '❓',
  monitor: '👁️',
};

function formatTime(iso?: string) {
  if (!iso) {
    return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  const date = new Date(iso);
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffMin < 24 * 60) return `${Math.round(diffMin / 60)} hr ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function activityEmoji(category: NotificationItem['category']) {
  if (category === 'ai') return '🤖';
  if (category === 'tasks') return '✅';
  if (category === 'events') return '📅';
  if (category === 'groceries') return '🛒';
  if (category === 'rewards') return '🎁';
  return '🔔';
}

export default function NovaScreen() {
  const chromePad = useTabChromePaddingTop();
  const {
    appendNovaTurn,
    askNova,
    askNovaVoice,
    household,
    metrics,
    notifications,
    novaConversation,
    novaMonitorActions,
    novaWeeklyBriefing,
    runNovaMonitor,
    suggestedNovaQuestions,
  } = useOrbit();

  const [activeTab, setActiveTab] = useState<NovaTab>('chat');
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [voiceState, setVoiceState] = useState<NovaRealtimeVisualState>('idle');
  const [localMonitorActions, setLocalMonitorActions] = useState<NovaMonitorAction[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const realtimeRef = useRef<NovaRealtimeSession | null>(null);

  const visualState: NovaVisualState =
    voiceState !== 'idle'
      ? voiceState
      : listening
        ? 'listening'
        : asking
          ? 'thinking'
          : 'idle';
  const cfg = STATE_CONFIG[visualState];

  useEffect(() => {
    return () => {
      realtimeRef.current?.disconnect();
      realtimeRef.current = null;
    };
  }, []);

  const messages = useMemo(() => {
    const mapped = novaConversation.map((msg, index) => ({
      id: `${index}-${msg.role}`,
      role: msg.role === 'user' ? ('user' as const) : ('nova' as const),
      text: msg.content,
      timestamp: formatTime(),
    }));

    if (mapped.length === 0) {
      return [
        {
          id: 'briefing',
          role: 'nova' as const,
          text: `Good morning. ${novaWeeklyBriefing.summary}`,
          timestamp: formatTime(),
        },
      ];
    }

    return mapped;
  }, [novaConversation, novaWeeklyBriefing.summary]);

  const monitorFeed = useMemo(
    () =>
      [...localMonitorActions, ...novaMonitorActions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [localMonitorActions, novaMonitorActions]
  );

  const activityItems = useMemo(() => {
    const fromMonitor = monitorFeed.map((action) => ({
      id: action.id,
      title: action.label,
      body: action.detail,
      category: action.kind as string,
      createdAt: action.createdAt,
      isMonitor: true as const,
    }));
    const aiItems = notifications
      .filter((item) => item.category === 'ai')
      .map((item) => ({ ...item, isMonitor: false as const }));
    const recent = notifications
      .filter((item) => item.category !== 'ai')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)
      .map((item) => ({ ...item, isMonitor: false as const }));
    return [...fromMonitor, ...aiItems, ...recent].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [monitorFeed, notifications]);

  const novaStats = useMemo(
    () => [
      {
        val: String(novaWeeklyBriefing.tasksCompleted || household.tasks.filter((t) => t.status === 'Completed').length),
        label: 'Tasks managed',
        emoji: '✅',
      },
      {
        val: String(household.itineraries?.length ?? 0),
        label: 'Trips created',
        emoji: '🗺️',
      },
      {
        val: `${Math.max(1, Math.abs(novaWeeklyBriefing.momentumChange) || 2)}h`,
        label: 'Time saved',
        emoji: '⏱️',
      },
    ],
    [household.itineraries?.length, household.tasks, novaWeeklyBriefing.momentumChange, novaWeeklyBriefing.tasksCompleted]
  );

  const handleSend = async (text?: string) => {
    const trimmed = (text ?? draft).trim();
    if (!trimmed || asking || listening) return;

    setAsking(true);
    setError('');
    try {
      await askNova(trimmed);
      setDraft('');
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setError('Nova could not answer right now. Try again in a moment.');
    } finally {
      setAsking(false);
    }
  };

  const ensureRealtime = async () => {
    if (!isNovaRealtimeEnabled()) {
      return null;
    }
    if (realtimeRef.current?.isConnected) {
      return realtimeRef.current;
    }
    const session = new NovaRealtimeSession({
      onStateChange: setVoiceState,
      onTranscript: () => {
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      },
      onToolCall: async (name, args) => {
        setLocalMonitorActions((current) => [toolCallToMonitorAction(name, args), ...current]);
        return { ok: true, tool: name, args };
      },
      onError: (message) => setError(message),
    });
    const ok = await session.connect(household, metrics);
    if (!ok) {
      session.disconnect();
      return null;
    }
    realtimeRef.current = session;
    return session;
  };

  const handleMicPressIn = async () => {
    if (asking || listening) return;
    setError('');
    setListening(true);
    try {
      const session = await ensureRealtime();
      if (session) {
        await session.beginListen();
      } else {
        const { startVoiceCapture } = await import('@/lib/voice/nova-voice');
        setVoiceState('listening');
        await startVoiceCapture();
      }
    } catch {
      setListening(false);
      setVoiceState('idle');
      setError('Could not access the microphone.');
    }
  };

  const handleMicPressOut = async () => {
    if (!listening) return;
    setAsking(true);
    try {
      const session = realtimeRef.current;
      if (session?.isConnected) {
        const result = await session.endListen(household, metrics);
        if (result.answer) {
          appendNovaTurn(result.answer.question, result.answer.answer);
        }
      } else {
        const { stopVoiceCapture } = await import('@/lib/voice/nova-voice');
        const uri = await stopVoiceCapture();
        setVoiceState('thinking');
        await askNovaVoice(uri);
        setVoiceState('idle');
      }
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setError('Nova voice failed. Try again or type your question.');
      setVoiceState('idle');
    } finally {
      setListening(false);
      setAsking(false);
    }
  };

  const handleRefreshMonitor = async () => {
    setAsking(true);
    try {
      await runNovaMonitor();
      setActiveTab('activity');
    } catch {
      setError('Monitor refresh failed.');
    } finally {
      setAsking(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}>
      <View style={[styles.header, { paddingTop: chromePad }]}>
        <View style={styles.headerGlow} pointerEvents="none" />
        <NovaOrb size={80} speaking={cfg.speaking} />
        <View style={styles.stateRow}>
          <View style={[styles.stateDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.stateLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={styles.subtitle}>Household majordomo</Text>
        <Pressable style={styles.refreshChip} onPress={handleRefreshMonitor} disabled={asking}>
          <MaterialIcons name="refresh" size={14} color={orbitColors.orbitBlue} />
          <Text style={styles.refreshChipText}>Run Nova check</Text>
        </Pressable>
      </View>

      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {(['chat', 'activity'] as const).map((tab) => {
            const active = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.segmentButton, active && styles.segmentButtonActive]}>
                <MaterialIcons
                  name={tab === 'chat' ? 'auto-awesome' : 'insights'}
                  size={13}
                  color={active ? orbitColors.orbitBlue : orbitColors.textSubtle}
                />
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                  {tab === 'chat' ? 'Chat' : 'Activity'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {activeTab === 'chat' ? (
        <View style={styles.chatPane}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickActions}>
            {suggestedNovaQuestions.map((action) => (
              <Pressable
                key={action}
                disabled={asking}
                onPress={() => handleSend(action)}
                style={styles.quickChip}>
                <Text style={styles.quickChipText}>{action}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}>
            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[styles.messageRow, msg.role === 'user' ? styles.messageRowUser : styles.messageRowNova]}>
                {msg.role === 'nova' ? <View style={styles.novaAvatar} /> : null}
                <View style={{ maxWidth: '78%' }}>
                  {msg.role === 'user' ? (
                    <LinearGradient
                      colors={['#0EA5E9', '#0369A1']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.userBubble}>
                      <Text style={styles.bubbleText}>{msg.text}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.novaBubble}>
                      <Text style={styles.bubbleText}>{msg.text}</Text>
                    </View>
                  )}
                  <Text style={[styles.timestamp, msg.role === 'user' && styles.timestampUser]}>{msg.timestamp}</Text>
                </View>
              </View>
            ))}

            {asking ? (
              <View style={styles.messageRowNova}>
                <View style={styles.novaAvatar} />
                <View style={styles.thinkingBubble}>
                  {[0, 1, 2].map((dot) => (
                    <View key={dot} style={[styles.thinkingDot, { opacity: 0.45 + dot * 0.2 }]} />
                  ))}
                </View>
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.inputWrap}>
            <View style={styles.inputBar}>
              <MaterialIcons name="auto-awesome" size={16} color={orbitColors.orbitBlue} />
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Ask Nova anything…"
                placeholderTextColor={orbitColors.textSubtle}
                style={styles.input}
                multiline
                editable={!asking}
              />
              <Pressable
                style={[styles.micButton, listening && styles.micButtonActive]}
                onPressIn={handleMicPressIn}
                onPressOut={handleMicPressOut}
                disabled={asking && !listening}>
                <MaterialIcons
                  name={listening ? 'mic' : 'mic-none'}
                  size={15}
                  color={listening ? '#34D399' : orbitColors.orbitBlue}
                />
              </Pressable>
              <Pressable
                disabled={asking || draft.trim().length < 1}
                onPress={() => handleSend()}
                style={styles.sendWrap}>
                {draft.trim().length > 0 && !asking ? (
                  <LinearGradient colors={['#38BDF8', '#0EA5E9']} style={styles.sendButton}>
                    <MaterialIcons name="send" size={14} color={orbitColors.ink} />
                  </LinearGradient>
                ) : (
                  <View style={styles.sendButtonDisabled}>
                    <MaterialIcons name="send" size={14} color={orbitColors.textSubtle} />
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.activityScroll} contentContainerStyle={styles.activityContent}>
          <Text style={styles.activityIntro}>
            Monitor Agent · {monitorFeed.length} actions · {activityItems.length} feed items
          </Text>

          {activityItems.map((item) => {
            const config = ACTIVITY_TYPE_CONFIG[item.category] ?? ACTIVITY_TYPE_CONFIG.general;
            const emoji =
              'isMonitor' in item && item.isMonitor
                ? MONITOR_KIND_EMOJI[(item.category as NovaMonitorAction['kind'])] ?? '👁️'
                : activityEmoji(item.category as NotificationItem['category']);
            return (
              <View key={item.id} style={styles.activityCard}>
                <View style={[styles.activityIconWrap, { backgroundColor: `${config.color}15`, borderColor: `${config.color}25` }]}>
                  <MaterialIcons name={config.icon} size={16} color={config.color} />
                </View>
                <View style={styles.activityCopy}>
                  <View style={styles.activityMeta}>
                    <Text style={[styles.activityAction, { color: config.color }]}>{item.title || config.action}</Text>
                    <Text style={styles.activityDot}>·</Text>
                    <Text style={styles.activityTime}>{formatTime(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.activityDetail}>{item.body}</Text>
                </View>
                <Text style={styles.activityEmoji}>{emoji}</Text>
              </View>
            );
          })}

          <LinearGradient
            colors={['rgba(6,182,212,0.10)', 'rgba(56,189,248,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statsCard}>
            <Text style={styles.statsEyebrow}>NOVA THIS WEEK</Text>
            <View style={styles.statsGrid}>
              {novaStats.map((stat) => (
                <View key={stat.label} style={styles.statTile}>
                  <Text style={styles.statEmoji}>{stat.emoji}</Text>
                  <Text style={styles.statValue}>{stat.val}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          <Pressable onPress={() => router.push('/notifications' as never)}>
            <Text style={styles.viewAll}>View all notifications</Text>
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  activityAction: {
    fontSize: 12,
    fontWeight: '700',
  },
  activityCard: {
    backgroundColor: orbitColors.card,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: orbitSpacing.md,
  },
  activityContent: {
    gap: 10,
    paddingBottom: 24,
    paddingHorizontal: orbitSpacing.md,
  },
  activityCopy: {
    flex: 1,
    minWidth: 0,
  },
  activityDetail: {
    color: orbitColors.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  activityDot: {
    color: orbitColors.textFaint,
    fontSize: 12,
  },
  activityEmoji: {
    fontSize: 18,
  },
  activityIconWrap: {
    alignItems: 'center',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  activityIntro: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    paddingTop: 8,
  },
  activityMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  activityScroll: {
    flex: 1,
  },
  activityTime: {
    color: orbitColors.textFaint,
    fontSize: 12,
  },
  bellBadge: {
    alignItems: 'center',
    backgroundColor: orbitColors.danger,
    borderRadius: 999,
    height: 16,
    justifyContent: 'center',
    minWidth: 16,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -2,
    top: -2,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  bellButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: orbitSpacing.md,
    top: orbitSpacing.md,
    width: 32,
  },
  bubbleText: {
    color: orbitColors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  chatPane: {
    flex: 1,
  },
  container: {
    backgroundColor: orbitColors.background,
    flex: 1,
  },
  error: {
    color: orbitColors.warning,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  header: {
    alignItems: 'center',
    backgroundColor: 'rgba(14,165,233,0.10)',
    paddingBottom: 12,
    paddingTop: 0,
    position: 'relative',
  },
  headerGlow: {
    backgroundColor: 'rgba(56,189,248,0.10)',
    borderRadius: 100,
    height: 200,
    position: 'absolute',
    top: -40,
    width: 200,
  },
  input: {
    color: orbitColors.text,
    flex: 1,
    fontSize: 14,
    maxHeight: 96,
    paddingVertical: 0,
  },
  inputBar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(56,189,248,0.18)',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: orbitSpacing.md,
    paddingVertical: 12,
  },
  inputWrap: {
    paddingBottom: orbitSpacing.md,
    paddingHorizontal: orbitSpacing.md,
    paddingTop: 4,
  },
  messageRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  messageRowNova: {
    justifyContent: 'flex-start',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messagesContent: {
    gap: 12,
    paddingBottom: 8,
    paddingHorizontal: orbitSpacing.md,
  },
  messagesScroll: {
    flex: 1,
  },
  micButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  micButtonActive: {
    backgroundColor: 'rgba(52,211,153,0.22)',
    borderColor: 'rgba(52,211,153,0.45)',
    borderWidth: 1,
  },
  refreshChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderColor: 'rgba(56,189,248,0.25)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshChipText: {
    color: orbitColors.orbitBlue,
    fontSize: 12,
    fontWeight: '700',
  },
  novaAvatar: {
    backgroundColor: '#0EA5E9',
    borderRadius: 999,
    height: 24,
    marginBottom: 2,
    width: 24,
  },
  novaBubble: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderBottomLeftRadius: 8,
    borderColor: 'rgba(56,189,248,0.12)',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    paddingHorizontal: orbitSpacing.md,
    paddingVertical: 12,
  },
  quickActions: {
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: orbitSpacing.md,
  },
  quickChip: {
    backgroundColor: 'rgba(56,189,248,0.10)',
    borderColor: 'rgba(56,189,248,0.18)',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickChipText: {
    color: orbitColors.orbitBlue,
    fontSize: 12,
    fontWeight: '500',
  },
  segment: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: orbitRadius.md,
    flexDirection: 'row',
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(56,189,248,0.18)',
    borderColor: 'rgba(56,189,248,0.3)',
  },
  segmentLabel: {
    color: orbitColors.textSubtle,
    fontSize: 14,
    fontWeight: '400',
  },
  segmentLabelActive: {
    color: orbitColors.orbitBlue,
    fontWeight: '600',
  },
  segmentWrap: {
    paddingBottom: 8,
    paddingHorizontal: orbitSpacing.md,
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  sendButtonDisabled: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  sendWrap: {
    borderRadius: 999,
  },
  stateDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  stateLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  stateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  statEmoji: {
    fontSize: 20,
  },
  statLabel: {
    color: orbitColors.textSubtle,
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
  statTile: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: orbitRadius.md,
    flex: 1,
    paddingVertical: 12,
  },
  statValue: {
    color: orbitColors.orbitBlue,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  statsCard: {
    borderColor: 'rgba(56,189,248,0.15)',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    marginTop: 8,
    padding: orbitSpacing.md,
  },
  statsEyebrow: {
    color: orbitColors.novaCyan,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  subtitle: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  thinkingBubble: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderBottomLeftRadius: 8,
    borderColor: 'rgba(56,189,248,0.12)',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: orbitSpacing.md,
    paddingVertical: 12,
  },
  thinkingDot: {
    backgroundColor: orbitColors.orbitBlue,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  timestamp: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    marginTop: 4,
    paddingLeft: 4,
  },
  timestampUser: {
    paddingLeft: 0,
    paddingRight: 4,
    textAlign: 'right',
  },
  userBubble: {
    borderBottomRightRadius: 8,
    borderRadius: orbitRadius.lg,
    paddingHorizontal: orbitSpacing.md,
    paddingVertical: 12,
  },
  viewAll: {
    color: orbitColors.orbitBlue,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
});
