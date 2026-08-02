import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NovaActivitySheet } from '@/components/orbit/nova-activity-sheet';
import { NovaOrb } from '@/components/orbit/nova-orb';
import { NovaWaveform } from '@/components/orbit/nova-waveform';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { radius, space } from '@/constants/orbit-theme';
import {
  buildSheetNotifications,
  needsAttentionCount,
} from '@/lib/nova/notification-buckets';
import { greetingWord } from '@/lib/time/greeting';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import {
  isNovaRealtimeEnabled,
  NovaRealtimeSession,
  toolCallToMonitorAction,
  type NovaRealtimeVisualState,
} from '@/lib/voice/nova-realtime';
import { useOrbit } from '@/store/orbit-store';
import type { NovaMonitorAction } from '@/types/orbit';

type NovaVisualState = 'idle' | 'listening' | 'thinking' | 'speaking';

const STATE_CONFIG: Record<NovaVisualState, { label: string; color: string }> = {
  idle: { label: 'Nova · Ready', color: '#06B6D4' },
  listening: { label: 'Nova · Listening…', color: '#34D399' },
  thinking: { label: 'Nova · Thinking…', color: '#A78BFA' },
  speaking: { label: 'Nova · Speaking', color: '#38BDF8' },
};

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
    markNotificationRead,
    metrics,
    notifications,
    novaBriefing,
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

  const bellBadgeCount = useMemo(() => {
    const cards = buildSheetNotifications(notifications, novaBriefing);
    return needsAttentionCount(cards);
  }, [notifications, novaBriefing]);

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
          accessibilityLabel="Notifications and Nova Activity">
          <MaterialIcons name="notifications-none" size={18} color={c.textMuted} />
          {bellBadgeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{Math.min(9, bellBadgeCount)}</Text>
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

      <NovaActivitySheet
        visible={showActivity}
        onClose={() => setShowActivity(false)}
        notifications={notifications}
        monitorActions={monitorFeed}
        briefing={novaBriefing}
        weekly={novaWeeklyBriefing}
        metrics={metrics}
        novaActive={isActive || monitorFeed.length > 0}
        taskCompletedFallback={household.tasks.filter((t) => t.status === 'Completed').length}
        onDismissNotification={(id) => markNotificationRead(id)}
      />
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
