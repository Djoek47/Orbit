import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PoppinsActivitySheet } from '@/components/orbit/poppins-activity-sheet';
import { PoppinsHourglass } from '@/components/orbit/poppins-hourglass';
import { PoppinsOrb } from '@/components/orbit/poppins-orb';
import { PoppinsWaveform } from '@/components/orbit/poppins-waveform';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { radius, space } from '@/constants/orbit-theme';
import { greetingWord } from '@/lib/time/greeting';
import {
  getMajordomoProfile,
  resolveMajordomoProfileId,
} from '@/lib/ai/majordomo-profiles';
import { flattenUiActions } from '@/lib/poppins/ui-tool-map';
import { poppinsUiOrchestrator, usePoppinsUiDrive } from '@/lib/poppins/ui-orchestrator';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import {
  isPoppinsRealtimeEnabled,
  PoppinsRealtimeSession,
  toolCallToMonitorAction,
  type PoppinsRealtimeVisualState,
} from '@/lib/voice/poppins-realtime';
import {
  isPoppinsNativeVoiceAvailable,
  PoppinsVoiceSession,
  type PoppinsPendingConfirmation,
  type PoppinsVoiceVisualState,
} from '@/lib/voice/poppins-voice-session';
import { useOrbit } from '@/store/orbit-store';
import type { PoppinsMonitorAction } from '@/types/orbit';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';

type PoppinsVisualState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success';

/**
 * Poppins Divine Voice — Connect/End continuous WebRTC on TestFlight;
 * Expo Go keeps text twin + optional Whisper tap fallback.
 */
export default function PoppinsScreen() {
  const chromePad = useTabChromePaddingTop();
  const insets = useSafeAreaInsets();
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const {
    appendPoppinsTurn,
    askPoppins,
    askPoppinsVoice,
    executePoppinsToolCall,
    household,
    currentMember,
    markNotificationRead,
    metrics,
    notifications,
    poppinsBriefing,
    poppinsMonitorActions,
    poppinsWeeklyBriefing,
    orbitPalette,
  } = useOrbit();

  const majordomo = useMemo(() => {
    const id = resolveMajordomoProfileId({
      householdProfileId: household.majordomoProfileId,
      memberProfileId: currentMember?.majordomoProfileId,
    });
    return getMajordomoProfile(id);
  }, [currentMember?.majordomoProfileId, household.majordomoProfileId]);

  const nativeVoice = isPoppinsNativeVoiceAvailable();

  const STATE_CONFIG: Record<PoppinsVisualState, { label: string; color: string }> = {
    idle: {
      label: nativeVoice
        ? `${majordomo.displayName} · Tap when you need me`
        : `${majordomo.displayName} · Ready`,
      color: majordomo.accent,
    },
    listening: { label: `${majordomo.displayName} · Listening…`, color: '#34D399' },
    thinking: { label: `${majordomo.displayName} · Thinking…`, color: '#A78BFA' },
    speaking: { label: `${majordomo.displayName} · Speaking`, color: '#38BDF8' },
    success: { label: `${majordomo.displayName} · Done`, color: '#34D399' },
  };

  const [showText, setShowText] = useState(true);
  const [showActivity, setShowActivity] = useState(false);
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [listening, setListening] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [voiceState, setVoiceState] = useState<PoppinsRealtimeVisualState | PoppinsVoiceVisualState>(
    'idle'
  );
  const [userTranscript, setUserTranscript] = useState('');
  const [poppinsTranscript, setPoppinsTranscript] = useState('');
  const [localMonitorActions, setLocalMonitorActions] = useState<PoppinsMonitorAction[]>([]);
  const [toolFlash, setToolFlash] = useState<string | null>(null);
  const [pendingConfirmations, setPendingConfirmations] = useState<PoppinsPendingConfirmation[]>(
    []
  );
  const voiceRef = useRef<PoppinsVoiceSession | null>(null);
  const realtimeRef = useRef<PoppinsRealtimeSession | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drive = usePoppinsUiDrive();
  const kidSession = currentMember?.role === 'child';
  const memberNames = useMemo(
    () => household.members.map((member) => member.name),
    [household.members]
  );
  const memberNamesRef = useRef(memberNames);
  memberNamesRef.current = memberNames;
  const kidSessionRef = useRef(kidSession);
  kidSessionRef.current = kidSession;

  const flashToolSuccess = (label: string) => {
    setToolFlash(label);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setToolFlash(null), 1600);
  };

  const mapVisual = (state: typeof voiceState): PoppinsVisualState => {
    if (state === 'needs_attention' || state === 'connecting') return 'thinking';
    if (state === 'listening' || state === 'thinking' || state === 'speaking') return state;
    return 'idle';
  };

  const visualState: PoppinsVisualState = toolFlash
    ? 'success'
    : mapVisual(voiceState) !== 'idle'
      ? mapVisual(voiceState)
      : listening
        ? 'listening'
        : asking || connecting
          ? 'thinking'
          : 'idle';
  const cfg = STATE_CONFIG[visualState];
  const isActive = visualState !== 'idle' || liveConnected;

  useEffect(() => {
    return () => {
      voiceRef.current?.disconnect();
      voiceRef.current = null;
      realtimeRef.current?.disconnect();
      realtimeRef.current = null;
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    voiceRef.current?.disconnect();
    voiceRef.current = null;
    realtimeRef.current?.disconnect();
    realtimeRef.current = null;
    setLiveConnected(false);
  }, [majordomo.id]);

  useEffect(() => {
    if (drive.live) setShowActivity(true);
  }, [drive.live]);

  useEffect(() => {
    poppinsUiOrchestrator.setPendingHandler((approved, ids) => {
      voiceRef.current?.notifyConfirmationResolved(ids, approved);
      setPendingConfirmations((current) => current.filter((item) => !ids.includes(item.id)));
      if (approved) flashToolSuccess('Confirmed');
    });
    return () => poppinsUiOrchestrator.setPendingHandler(null);
  }, []);

  const monitorFeed = useMemo(
    () =>
      [...localMonitorActions, ...poppinsMonitorActions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [localMonitorActions, poppinsMonitorActions]
  );

  const applyTranscript = (role: 'user' | 'assistant', text: string) => {
    if (role === 'user') {
      setUserTranscript(text);
      setPoppinsTranscript('');
      if (poppinsUiOrchestrator.applySpeech(text, memberNamesRef.current)) {
        setShowActivity(true);
      }
    } else {
      setPoppinsTranscript(text);
    }
  };

  const applyUiActions = (actions: Array<Record<string, unknown>>, replace = false) => {
    if (!actions.length) return;
    poppinsUiOrchestrator.drive(actions, { kid: kidSessionRef.current, replace });
    setShowActivity(true);
  };

  const connectNativeVoice = async () => {
    if (voiceRef.current?.isConnected) return voiceRef.current;
    setConnecting(true);
    setError('');
    const session = new PoppinsVoiceSession({
      onStateChange: (state) => {
        setVoiceState(state);
        setLiveConnected(state !== 'idle');
      },
      onTranscript: applyTranscript,
      onPendingConfirmations: (items) => {
        setPendingConfirmations(items);
        setVoiceState('needs_attention');
        applyUiActions(
          items.map((item) => ({
            type: 'confirm',
            confirmSummary: item.summary,
            confirmationIds: [item.id],
          }))
        );
      },
      onUiActions: applyUiActions,
      onSessionEnd: () => {
        setLiveConnected(false);
        setVoiceState('idle');
        poppinsUiOrchestrator.clear();
      },
      onSoftIdlePrompt: () => {
        setLocalMonitorActions((current) => [
          {
            id: `idle-${Date.now()}`,
            kind: 'monitor',
            label: 'Soft idle check-in',
            detail: 'Still there?',
            createdAt: new Date().toISOString(),
          },
          ...current,
        ]);
      },
      onError: (message) => setError(message),
    });
    const ok = await session.connect(household, metrics, currentMember?.majordomoProfileId, {
      pageContext: 'poppins tab',
      capabilityProfile: 'Daily',
    });
    setConnecting(false);
    if (!ok) {
      session.disconnect();
      return null;
    }
    voiceRef.current = session;
    setLiveConnected(true);
    return session;
  };

  const endNativeVoice = async () => {
    await voiceRef.current?.end('manual');
    voiceRef.current = null;
    setLiveConnected(false);
    setVoiceState('idle');
    setListening(false);
  };

  const ensureWhisperRealtime = async () => {
    if (!isPoppinsRealtimeEnabled()) return null;
    if (realtimeRef.current?.isConnected) return realtimeRef.current;
    const session = new PoppinsRealtimeSession({
      onStateChange: setVoiceState,
      onTranscript: applyTranscript,
      onToolCall: async (name, args) => {
        const result = await executePoppinsToolCall(name, args, {
          forceRiskyConfirmation: true,
        });
        const action = toolCallToMonitorAction(name, args, result as Record<string, unknown>);
        setLocalMonitorActions((current) => [action, ...current]);
        flashToolSuccess(action.label || name.replace(/_/g, ' '));
        const ui = flattenUiActions([result as Record<string, unknown>]);
        if (ui.length) applyUiActions(ui);
        return result;
      },
      onError: (message) => setError(message),
    });
    const ok = await session.connect(household, metrics, currentMember?.majordomoProfileId);
    if (!ok) {
      session.disconnect();
      return null;
    }
    realtimeRef.current = session;
    return session;
  };

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || asking) return;
    setDraft('');
    setUserTranscript(trimmed);
    setPoppinsTranscript('');
    setError('');

    // Live duplex: inject into the same WebRTC conversation.
    if (voiceRef.current?.isConnected) {
      voiceRef.current.sendUserText(trimmed);
      appendPoppinsTurn(trimmed, '(live voice)');
      return;
    }

    setAsking(true);
    setVoiceState('thinking');
    try {
      const result = await askPoppins(trimmed);
      setVoiceState('speaking');
      setPoppinsTranscript(result.answer);
      appendPoppinsTurn(trimmed, result.answer);
      if (result.actions?.length) {
        setLocalMonitorActions((current) => [...result.actions!, ...current]);
        flashToolSuccess(result.actions[0]!.label);
      }
      if (result.ui_actions?.length) {
        applyUiActions(result.ui_actions, true);
      }
    } catch {
      setError('Poppins could not answer right now. Try again in a moment.');
    } finally {
      setAsking(false);
      setTimeout(() => setVoiceState('idle'), 1800);
    }
  };

  const toggleConnect = async () => {
    if (liveConnected || voiceRef.current?.isConnected) {
      await endNativeVoice();
      return;
    }

    if (nativeVoice) {
      await connectNativeVoice();
      return;
    }

    // Expo Go / no WebRTC: tap-to-talk Whisper fallback.
    if (isActive && listening) {
      setAsking(true);
      try {
        const session = realtimeRef.current;
        if (session?.isConnected) {
          const result = await session.endListen(household, metrics);
          if (result.answer) {
            applyTranscript('user', result.answer.question);
            applyTranscript('assistant', result.answer.answer);
            appendPoppinsTurn(result.answer.question, result.answer.answer);
          }
        } else {
          const { stopVoiceCapture } = await import('@/lib/voice/poppins-voice');
          const uri = await stopVoiceCapture();
          setVoiceState('thinking');
          const result = await askPoppinsVoice(uri);
          applyTranscript('user', result.question);
          setVoiceState('speaking');
          applyTranscript('assistant', result.answer);
          if (result.ui_actions?.length) applyUiActions(result.ui_actions, true);
        }
      } catch {
        setError('Poppins voice failed. Try again or type your question.');
        setVoiceState('idle');
      } finally {
        setListening(false);
        setAsking(false);
        setTimeout(() => setVoiceState('idle'), 1600);
      }
      return;
    }

    if (asking || listening || connecting) return;
    setError(
      nativeVoice
        ? ''
        : 'Continuous voice needs the TestFlight build. Type below, or tap-to-talk Whisper.'
    );
    setUserTranscript('');
    setPoppinsTranscript('');
    setListening(true);
    try {
      const session = await ensureWhisperRealtime();
      if (session) {
        await session.beginListen();
      } else {
        const { startVoiceCapture } = await import('@/lib/voice/poppins-voice');
        setVoiceState('listening');
        await startVoiceCapture();
      }
    } catch {
      setListening(false);
      setVoiceState('idle');
      setError('Could not access the microphone.');
    }
  };

  const confirmPending = (approved: boolean) => {
    const ids = pendingConfirmations.map((p) => p.id);
    voiceRef.current?.notifyConfirmationResolved(ids, approved);
    setPendingConfirmations([]);
    if (approved) {
      flashToolSuccess('Confirmed');
    }
  };

  const ambient =
    visualState === 'listening'
      ? 'rgba(52,211,153,0.12)'
      : visualState === 'speaking'
        ? 'rgba(56,189,248,0.14)'
        : visualState === 'thinking'
          ? 'rgba(167,139,250,0.12)'
          : visualState === 'success'
            ? 'rgba(52,211,153,0.16)'
            : isDark
              ? 'rgba(56,189,248,0.06)'
              : `${orbitPalette.primary}18`;

  const transcriptRoleLabel =
    visualState === 'success'
      ? 'DONE'
      : visualState === 'speaking' && poppinsTranscript
        ? majordomo.displayName.toUpperCase()
        : visualState === 'thinking'
          ? 'PROCESSING'
          : userTranscript
            ? 'YOU'
            : null;

  const transcriptBody =
    visualState === 'success' && toolFlash
      ? toolFlash
      : visualState === 'speaking' && poppinsTranscript
        ? poppinsTranscript
        : userTranscript || '';

  const idleHint = nativeVoice
    ? `${greetingWord()}. Tap Connect for a live conversation with ${majordomo.displayName}`
    : `${greetingWord()}. Type below — continuous voice needs TestFlight`;

  const primaryConnected = liveConnected || (listening && !nativeVoice);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? '#000000' : orbitPalette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={24}>
      <View style={[styles.ambient, { backgroundColor: ambient }]} pointerEvents="none" />

      <View style={[styles.header, { paddingTop: chromePad }]}>
        <Text style={[styles.kicker, { color: isDark ? 'rgba(255,255,255,0.3)' : c.textSubtle }]}>
          {majordomo.displayName.toUpperCase()}
        </Text>
        <Pressable
          style={[
            styles.activityBtn,
            {
              backgroundColor: glass(0.06),
              borderColor: glassBorder(0.1),
            },
          ]}
          onPress={() => setShowActivity(true)}
          accessibilityLabel="Poppins Activity">
          <PoppinsHourglass size={18} color="#2DD4BF" active={isActive || monitorFeed.length > 0} />
        </Pressable>
      </View>

      {drive.live ? (
        <View
          style={[
            styles.rail,
            { borderColor: glassBorder(0.1), backgroundColor: glass(0.06) },
          ]}>
          <Text style={[styles.railText, { color: c.text }]} numberOfLines={1}>
            {majordomo.displayName} ·{' '}
            {drive.playlist[drive.index]?.payload.title ||
              drive.thinkingLine ||
              'working…'}
          </Text>
        </View>
      ) : null}

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
                    <View
                      key={i}
                      style={[styles.dot, { backgroundColor: cfg.color, opacity: 0.5 + i * 0.2 }]}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text
              style={[styles.idleHint, { color: isDark ? 'rgba(255,255,255,0.25)' : c.textMuted }]}>
              {idleHint}
            </Text>
          )}
        </View>

        <Pressable onPress={() => void toggleConnect()} accessibilityRole="button">
          <PoppinsOrb size={176} state={visualState} speaking={visualState === 'speaking'} />
        </Pressable>

        <View style={styles.waveWrap}>
          <PoppinsWaveform
            active={visualState === 'listening' || visualState === 'speaking'}
            color={cfg.color}
          />
        </View>
      </View>

      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

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
              placeholder={
                liveConnected
                  ? `Type into the live session…`
                  : `Type to ${majordomo.displayName}…`
              }
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
            onPress={() => void toggleConnect()}
            style={styles.micWrap}
            accessibilityLabel={
              primaryConnected ? 'End conversation' : `Connect to ${majordomo.displayName}`
            }>
            {primaryConnected ? (
              <View style={[styles.micPulse, { backgroundColor: 'rgba(52,211,153,0.2)' }]} />
            ) : null}
            <LinearGradient
              colors={
                primaryConnected
                  ? ['rgba(248,113,113,0.95)', 'rgba(239,68,68,0.85)']
                  : connecting
                    ? ['rgba(167,139,250,0.9)', 'rgba(139,92,246,0.8)']
                    : isDark
                      ? ['rgba(52,211,153,0.9)', 'rgba(16,185,129,0.8)']
                      : [`${c.primary}55`, `${c.primary}33`]
              }
              style={[
                styles.micBtn,
                {
                  borderColor: primaryConnected ? 'rgba(255,255,255,0.25)' : glassBorder(0.14),
                },
              ]}>
              {primaryConnected ? (
                <View style={styles.stopSquare} />
              ) : connecting ? (
                <MaterialIcons name="graphic-eq" size={28} color="#fff" />
              ) : (
                <MaterialIcons name="call" size={30} color={isDark ? '#fff' : c.text} />
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
          {primaryConnected
            ? nativeVoice
              ? 'End · always available'
              : cfg.label
            : nativeVoice
              ? 'Connect'
              : cfg.label}
        </Text>
      </View>

      <Modal
        visible={pendingConfirmations.length > 0 && !drive.live}
        transparent
        animationType="fade"
        onRequestClose={() => confirmPending(false)}>
        <View style={styles.confirmBackdrop}>
          <View
            style={[
              styles.confirmSheet,
              {
                backgroundColor: isDark ? '#12141A' : '#F7F5F2',
                borderColor: glassBorder(0.14),
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}>
            <Text style={[styles.confirmTitle, { color: c.text }]}>Confirm with Poppins</Text>
            <Text style={[styles.confirmSub, { color: c.textMuted }]}>
              Risky actions stay approval-first.
            </Text>
            {pendingConfirmations.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.confirmCard,
                  { borderColor: glassBorder(0.12), backgroundColor: glass(0.05) },
                ]}>
                <Text style={[styles.confirmTool, { color: c.text }]}>
                  {item.tool.replace(/_/g, ' ')}
                </Text>
                <Text style={[styles.confirmDetail, { color: c.textMuted }]}>{item.summary}</Text>
              </View>
            ))}
            <View style={styles.confirmRow}>
              <Pressable
                onPress={() => confirmPending(false)}
                style={[styles.confirmBtn, { backgroundColor: glass(0.08) }]}>
                <Text style={{ color: c.text, fontWeight: '600' }}>Decline</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmPending(true)}
                style={[styles.confirmBtn, { backgroundColor: '#38BDF8' }]}>
                <Text style={{ color: '#041018', fontWeight: '700' }}>Approve</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <PoppinsActivitySheet
        visible={showActivity}
        onClose={() => setShowActivity(false)}
        variant="activity"
        notifications={notifications}
        monitorActions={monitorFeed}
        briefing={poppinsBriefing}
        weekly={poppinsWeeklyBriefing}
        metrics={metrics}
        poppinsActive={isActive || monitorFeed.length > 0}
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
  rail: {
    marginHorizontal: space.lg,
    marginBottom: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  railText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  activityBtn: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
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
  confirmBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  confirmSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    width: '100%',
  },
  confirmTitle: { fontSize: 18, fontWeight: '700' },
  confirmSub: { fontSize: 13, marginBottom: 4 },
  confirmCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 12,
  },
  confirmTool: { fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  confirmDetail: { fontSize: 12, marginTop: 4 },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  confirmBtn: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    paddingVertical: 14,
  },
});
