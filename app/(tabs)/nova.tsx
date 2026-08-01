import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NovaOrb } from '@/components/orbit/nova-orb';
import { NovaWaveform } from '@/components/orbit/nova-waveform';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { radius, space } from '@/constants/orbit-theme';
import { greetingWord } from '@/lib/time/greeting';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import {
  isNovaRealtimeEnabled,
  NovaRealtimeSession,
  toolCallToMonitorAction,
  type NovaRealtimeVisualState,
} from '@/lib/voice/nova-realtime';
import { useOrbit } from '@/store/orbit-store';
import type { NovaMonitorAction, NotificationItem } from '@/types/orbit';

type NovaVisualState = 'idle' | 'listening' | 'thinking' | 'speaking';

const STATE_CONFIG: Record<NovaVisualState, { label: string; color: string }> = {
  idle: { label: 'Nova · Ready', color: '#06B6D4' },
  listening: { label: 'Nova · Listening…', color: '#34D399' },
  thinking: { label: 'Nova · Thinking…', color: '#A78BFA' },
  speaking: { label: 'Nova · Speaking', color: '#38BDF8' },
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
  completed: { icon: 'check-circle', color: '#34D399', action: 'Marked complete' },
  reminder: { icon: 'notifications-active', color: '#A78BFA', action: 'Sent reminder' },
  insight: { icon: 'lightbulb', color: '#FBBF24', action: 'Insight detected' },
  itinerary: { icon: 'place', color: '#38BDF8', action: 'Itinerary created' },
  notification: { icon: 'notifications', color: '#FB923C', action: 'Notification sent' },
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

/**
 * Make v9 Nova — voice-first orb + live transcript + Nova Activity sheet.
 * Realtime: set EXPO_PUBLIC_NOVA_REALTIME=1 with live Nova AI + supabase edge
 * `nova-realtime-session`. Falls back to Whisper + askNova when gated off.
 */
export default function NovaScreen() {
  const chromePad = useTabChromePaddingTop();
  const insets = useSafeAreaInsets();
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const {
    appendNovaTurn,
    askNova,
    askNovaVoice,
    household,
    metrics,
    notifications,
    novaMonitorActions,
    novaWeeklyBriefing,
    orbitPalette,
  } = useOrbit();

  const [showText, setShowText] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [voiceState, setVoiceState] = useState<NovaRealtimeVisualState>('idle');
  const [userTranscript, setUserTranscript] = useState('');
  const [novaTranscript, setNovaTranscript] = useState('');
  const [localMonitorActions, setLocalMonitorActions] = useState<NovaMonitorAction[]>([]);
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
  const isActive = visualState !== 'idle';

  useEffect(() => {
    return () => {
      realtimeRef.current?.disconnect();
      realtimeRef.current = null;
    };
  }, []);

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
      emoji: MONITOR_KIND_EMOJI[action.kind] ?? '🔔',
      actionLabel: ACTIVITY_TYPE_CONFIG[action.kind]?.action ?? action.label,
    }));
    const fromNotes = notifications
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12)
      .map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        category: item.category,
        createdAt: item.createdAt,
        emoji: activityEmoji(item.category),
        actionLabel: ACTIVITY_TYPE_CONFIG[item.category]?.action ?? item.title,
      }));
    return [...fromMonitor, ...fromNotes]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 16);
  }, [monitorFeed, notifications]);

  const recentBadgeCount = useMemo(
    () =>
      activityItems.filter((item) => {
        const mins = (Date.now() - new Date(item.createdAt).getTime()) / 60000;
        return mins < 60;
      }).length,
    [activityItems]
  );

  const novaStats = useMemo(
    () => [
      {
        val: String(
          novaWeeklyBriefing.tasksCompleted ||
            household.tasks.filter((t) => t.status === 'Completed').length
        ),
        label: 'Managed',
        emoji: '✅',
      },
      {
        val: String(household.itineraries?.length ?? 0),
        label: 'Trips',
        emoji: '🗺️',
      },
      {
        val: `${Math.max(1, Math.abs(novaWeeklyBriefing.momentumChange) || 2)}h`,
        label: 'Saved',
        emoji: '⏱️',
      },
    ],
    [
      household.itineraries?.length,
      household.tasks,
      novaWeeklyBriefing.momentumChange,
      novaWeeklyBriefing.tasksCompleted,
    ]
  );

  const applyTranscript = (role: 'user' | 'assistant', text: string) => {
    if (role === 'user') {
      setUserTranscript(text);
      setNovaTranscript('');
    } else {
      setNovaTranscript(text);
    }
  };

  const ensureRealtime = async () => {
    if (!isNovaRealtimeEnabled()) return null;
    if (realtimeRef.current?.isConnected) return realtimeRef.current;
    const session = new NovaRealtimeSession({
      onStateChange: setVoiceState,
      onTranscript: applyTranscript,
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

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || asking || listening) return;
    setDraft('');
    setUserTranscript(trimmed);
    setNovaTranscript('');
    setAsking(true);
    setError('');
    setVoiceState('thinking');
    try {
      const result = await askNova(trimmed);
      setVoiceState('speaking');
      setNovaTranscript(result.answer);
    } catch {
      setError('Nova could not answer right now. Try again in a moment.');
    } finally {
      setAsking(false);
      setTimeout(() => setVoiceState('idle'), 1800);
    }
  };

  const toggleMic = async () => {
    if (isActive && listening) {
      // Cancel / end listen
      setAsking(true);
      try {
        const session = realtimeRef.current;
        if (session?.isConnected) {
          const result = await session.endListen(household, metrics);
          if (result.answer) {
            applyTranscript('user', result.answer.question);
            applyTranscript('assistant', result.answer.answer);
            appendNovaTurn(result.answer.question, result.answer.answer);
          }
        } else {
          const { stopVoiceCapture } = await import('@/lib/voice/nova-voice');
          const uri = await stopVoiceCapture();
          setVoiceState('thinking');
          const result = await askNovaVoice(uri);
          applyTranscript('user', result.question);
          setVoiceState('speaking');
          applyTranscript('assistant', result.answer);
        }
      } catch {
        setError('Nova voice failed. Try again or type your question.');
        setVoiceState('idle');
      } finally {
        setListening(false);
        setAsking(false);
        setTimeout(() => setVoiceState('idle'), 1600);
      }
      return;
    }

    if (asking || listening) return;
    setError('');
    setUserTranscript('');
    setNovaTranscript('');
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

  const ambient =
    visualState === 'listening'
      ? 'rgba(52,211,153,0.12)'
      : visualState === 'speaking'
        ? 'rgba(56,189,248,0.14)'
        : visualState === 'thinking'
          ? 'rgba(167,139,250,0.12)'
          : isDark
            ? 'rgba(56,189,248,0.06)'
            : `${orbitPalette.primary}18`;

  const transcriptRoleLabel =
    visualState === 'speaking' && novaTranscript
      ? 'NOVA'
      : visualState === 'thinking'
        ? 'PROCESSING'
        : userTranscript
          ? 'YOU'
          : null;

  const transcriptBody =
    visualState === 'speaking' && novaTranscript
      ? novaTranscript
      : userTranscript ||
        (visualState === 'idle'
          ? ''
          : '');

  const idleHint = `${greetingWord()}. Tap to speak with Nova`;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? '#000000' : orbitPalette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={24}>
      <View
        style={[styles.ambient, { backgroundColor: ambient }]}
        pointerEvents="none"
      />

      <View style={[styles.header, { paddingTop: chromePad }]}>
        <Text style={[styles.kicker, { color: isDark ? 'rgba(255,255,255,0.3)' : c.textSubtle }]}>
          NOVA AI
        </Text>
        <Pressable
          style={[
            styles.bellBtn,
            {
              backgroundColor: glass(0.06),
              borderColor: glassBorder(0.1),
            },
          ]}
          onPress={() => setShowActivity(true)}
          accessibilityLabel="Nova Activity">
          <MaterialIcons name="notifications-none" size={18} color={c.textMuted} />
          {recentBadgeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{Math.min(9, recentBadgeCount)}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.stage}>
        <View style={styles.transcriptBlock}>
          {transcriptRoleLabel && (transcriptBody || visualState === 'thinking') ? (
            <>
              <Text style={[styles.roleLabel, { color: cfg.color }]}>{transcriptRoleLabel}</Text>
              <Text
                style={[
                  styles.transcriptText,
                  { color: isDark ? 'rgba(255,255,255,0.9)' : c.text },
                ]}>
                {transcriptBody ||
                  (visualState === 'thinking' ? 'Working on your household…' : '')}
              </Text>
              {visualState === 'thinking' ? (
                <View style={styles.dots}>
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: cfg.color, opacity: 0.5 + i * 0.2 }]} />
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={[styles.idleHint, { color: isDark ? 'rgba(255,255,255,0.25)' : c.textMuted }]}>
              {idleHint}
            </Text>
          )}
        </View>

        <Pressable onPress={() => void toggleMic()} accessibilityRole="button">
          <NovaOrb size={176} state={visualState} speaking={visualState === 'speaking'} />
        </Pressable>

        <View style={styles.waveWrap}>
          <NovaWaveform
            active={visualState === 'listening' || visualState === 'speaking'}
            color={cfg.color}
          />
        </View>
      </View>

      {error ? (
        <Text style={[styles.error, { color: c.danger }]}>{error}</Text>
      ) : null}

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {showText ? (
          <View
            style={[
              styles.textComposer,
              {
                backgroundColor: glass(0.06),
                borderColor: glassBorder(0.12),
              },
            ]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type to Nova…"
              placeholderTextColor={c.textSubtle}
              style={[styles.textInput, { color: c.text }]}
              onSubmitEditing={() => void handleSend()}
              returnKeyType="send"
            />
            <Pressable
              onPress={() => void handleSend()}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: draft.trim() ? '#38BDF8' : glass(0.08),
                },
              ]}>
              <MaterialIcons
                name="send"
                size={16}
                color={draft.trim() ? '#041018' : c.textSubtle}
              />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.controlRow}>
          <Pressable
            onPress={() => setShowText((v) => !v)}
            style={[
              styles.sideBtn,
              {
                backgroundColor: showText ? 'rgba(56,189,248,0.15)' : glass(0.07),
                borderColor: showText ? 'rgba(56,189,248,0.3)' : glassBorder(0.1),
              },
            ]}>
            <MaterialIcons
              name={showText ? 'close' : 'keyboard'}
              size={20}
              color={showText ? '#38BDF8' : c.textMuted}
            />
          </Pressable>

          <Pressable
            onPress={() => void toggleMic()}
            style={styles.micWrap}
            accessibilityLabel={listening ? 'Stop listening' : 'Talk to Nova'}>
            {visualState === 'listening' ? (
              <View style={[styles.micPulse, { backgroundColor: 'rgba(52,211,153,0.2)' }]} />
            ) : null}
            <LinearGradient
              colors={
                visualState === 'listening'
                  ? ['rgba(52,211,153,0.95)', 'rgba(16,185,129,0.85)']
                  : isActive
                    ? ['rgba(56,189,248,0.9)', 'rgba(14,165,233,0.8)']
                    : isDark
                      ? ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)']
                      : [`${c.primary}33`, `${c.primary}18`]
              }
              style={[
                styles.micBtn,
                {
                  borderColor: isActive ? 'rgba(255,255,255,0.25)' : glassBorder(0.14),
                },
              ]}>
              {visualState === 'idle' ? (
                <MaterialIcons name="mic" size={32} color={isDark ? '#fff' : c.text} />
              ) : visualState === 'listening' ? (
                <View style={styles.stopSquare} />
              ) : (
                <MaterialIcons name="graphic-eq" size={28} color="#fff" />
              )}
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => setShowActivity(true)}
            style={[
              styles.sideBtn,
              {
                backgroundColor: glass(0.07),
                borderColor: glassBorder(0.1),
              },
            ]}>
            <MaterialIcons name="keyboard-arrow-up" size={22} color={c.textMuted} />
          </Pressable>
        </View>

        <Text style={[styles.stateLabel, { color: isActive ? cfg.color : c.textSubtle }]}>
          {cfg.label}
        </Text>
      </View>

      <Modal
        visible={showActivity}
        animationType="slide"
        transparent
        onRequestClose={() => setShowActivity(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowActivity(false)} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? 'rgba(10,10,18,0.98)' : c.cardStrong,
              borderColor: glassBorder(0.1),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.sheetTitle, { color: c.text }]}>Nova Activity</Text>
              <Text style={[styles.sheetSub, { color: c.textMuted }]}>
                Recent actions & insights
              </Text>
            </View>
            <Pressable
              onPress={() => setShowActivity(false)}
              style={[styles.sheetClose, { backgroundColor: glass(0.08) }]}>
              <MaterialIcons name="close" size={18} color={c.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}>
            {activityItems.length === 0 ? (
              <Text style={{ color: c.textMuted, fontSize: 14 }}>
                Nova hasn&apos;t logged activity yet. Ask a question or run a household check.
              </Text>
            ) : (
              activityItems.map((item) => {
                const tc = ACTIVITY_TYPE_CONFIG[item.category] ?? ACTIVITY_TYPE_CONFIG.general;
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.activityCard,
                      {
                        backgroundColor: glass(0.04),
                        borderColor: glassBorder(0.08),
                      },
                    ]}>
                    <View
                      style={[
                        styles.activityIcon,
                        {
                          backgroundColor: `${tc.color}18`,
                          borderColor: `${tc.color}33`,
                        },
                      ]}>
                      <MaterialIcons name={tc.icon} size={16} color={tc.color} />
                    </View>
                    <View style={styles.activityCopy}>
                      <View style={styles.activityMeta}>
                        <Text style={[styles.activityAction, { color: tc.color }]}>
                          {item.actionLabel}
                        </Text>
                        <Text style={[styles.activityTime, { color: c.textSubtle }]}>
                          · {formatTime(item.createdAt)}
                        </Text>
                      </View>
                      <Text style={[styles.activityDetail, { color: c.textSoft }]} numberOfLines={3}>
                        {item.body || item.title}
                      </Text>
                    </View>
                    <Text style={styles.activityEmoji}>{item.emoji}</Text>
                  </View>
                );
              })
            )}

            <View
              style={[
                styles.weekCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(6,182,212,0.08)'
                    : `${c.novaCyan}12`,
                  borderColor: isDark ? 'rgba(56,189,248,0.12)' : `${c.novaCyan}33`,
                },
              ]}>
              <Text style={[styles.weekLabel, { color: c.novaCyan }]}>THIS WEEK</Text>
              <View style={styles.weekRow}>
                {novaStats.map((stat) => (
                  <View
                    key={stat.label}
                    style={[styles.weekStat, { backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : glass(0.06) }]}>
                    <Text style={styles.weekEmoji}>{stat.emoji}</Text>
                    <Text style={[styles.weekVal, { color: '#38BDF8' }]}>{stat.val}</Text>
                    <Text style={[styles.weekStatLabel, { color: c.textSubtle }]}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  ambient: {
    position: 'absolute',
    top: '12%',
    left: '10%',
    right: '10%',
    height: 340,
    borderRadius: 999,
    opacity: 0.9,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    zIndex: 2,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  bellBtn: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 8,
    height: 16,
    justifyContent: 'center',
    minWidth: 16,
    position: 'absolute',
    right: -2,
    top: -2,
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  stage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    zIndex: 2,
  },
  transcriptBlock: {
    alignItems: 'center',
    marginBottom: space.lg,
    minHeight: 96,
    paddingHorizontal: space.sm,
    width: '100%',
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  transcriptText: {
    fontSize: 20,
    fontWeight: '300',
    letterSpacing: -0.2,
    lineHeight: 30,
    textAlign: 'center',
  },
  idleHint: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 14,
  },
  dot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  waveWrap: {
    marginTop: space.lg,
    width: '100%',
  },
  error: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: space.lg,
    textAlign: 'center',
  },
  controls: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    zIndex: 2,
  },
  textComposer: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    minHeight: 28,
    paddingVertical: 4,
  },
  sendBtn: {
    alignItems: 'center',
    borderRadius: 12,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  controlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
  },
  sideBtn: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  micWrap: {
    alignItems: 'center',
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  micPulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 40,
    transform: [{ scale: 1.35 }],
  },
  micBtn: {
    alignItems: 'center',
    borderRadius: 40,
    borderWidth: 1.5,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  stopSquare: {
    backgroundColor: '#fff',
    borderRadius: 4,
    height: 20,
    width: 20,
  },
  stateLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: 12,
    textAlign: 'center',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    bottom: 0,
    left: 0,
    maxHeight: '80%',
    position: 'absolute',
    right: 0,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(128,128,128,0.35)',
    borderRadius: 999,
    height: 4,
    marginTop: 10,
    width: 40,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  sheetSub: { fontSize: 12, marginTop: 2 },
  sheetClose: {
    alignItems: 'center',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  sheetScroll: { flexGrow: 0 },
  sheetContent: {
    gap: 10,
    paddingHorizontal: space.md,
    paddingBottom: space.lg,
  },
  activityCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  activityIcon: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  activityCopy: { flex: 1, minWidth: 0 },
  activityMeta: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  activityAction: { fontSize: 12, fontWeight: '700' },
  activityTime: { fontSize: 12 },
  activityDetail: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  activityEmoji: { fontSize: 18 },
  weekCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: 4,
    padding: 14,
  },
  weekLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  weekRow: { flexDirection: 'row', gap: 8 },
  weekStat: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    paddingVertical: 12,
  },
  weekEmoji: { fontSize: 16 },
  weekVal: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  weekStatLabel: { fontSize: 9, marginTop: 2 },
});
