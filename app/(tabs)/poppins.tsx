import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
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
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import {
  isPoppinsRealtimeEnabled,
  PoppinsRealtimeSession,
  toolCallToMonitorAction,
  type PoppinsRealtimeVisualState,
} from '@/lib/voice/poppins-realtime';
import { useOrbit } from '@/store/orbit-store';
import type { PoppinsMonitorAction } from '@/types/orbit';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';

type PoppinsVisualState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success';

/**
 * Make v9 Poppins — voice-first orb + live transcript + Poppins Activity sheet.
 * Realtime: set EXPO_PUBLIC_POPPINS_REALTIME=1 with live Poppins AI + supabase edge
 * `poppins-realtime-session`. Falls back to Whisper + askPoppins when gated off.
 * Majordomo profile (Settings) swaps Character → Personality → Voice; tools stay shared.
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

  const STATE_CONFIG: Record<PoppinsVisualState, { label: string; color: string }> = {
    idle: { label: `${majordomo.displayName} · Ready`, color: majordomo.accent },
    listening: { label: `${majordomo.displayName} · Listening…`, color: '#34D399' },
    thinking: { label: `${majordomo.displayName} · Thinking…`, color: '#A78BFA' },
    speaking: { label: `${majordomo.displayName} · Speaking`, color: '#38BDF8' },
    success: { label: `${majordomo.displayName} · Done`, color: '#34D399' },
  };
  const [showText, setShowText] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [voiceState, setVoiceState] = useState<PoppinsRealtimeVisualState>('idle');
  const [userTranscript, setUserTranscript] = useState('');
  const [poppinsTranscript, setPoppinsTranscript] = useState('');
  const [localMonitorActions, setLocalMonitorActions] = useState<PoppinsMonitorAction[]>([]);
  const [toolFlash, setToolFlash] = useState<string | null>(null);
  const realtimeRef = useRef<PoppinsRealtimeSession | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashToolSuccess = (label: string) => {
    setToolFlash(label);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setToolFlash(null), 1600);
  };

  const visualState: PoppinsVisualState = toolFlash
    ? 'success'
    : voiceState !== 'idle'
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
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // Remint Realtime session when majordomo (voice) changes.
  useEffect(() => {
    realtimeRef.current?.disconnect();
    realtimeRef.current = null;
  }, [majordomo.id]);

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
    } else {
      setPoppinsTranscript(text);
    }
  };

  const ensureRealtime = async () => {
    if (!isPoppinsRealtimeEnabled()) return null;
    if (realtimeRef.current?.isConnected) return realtimeRef.current;
    const session = new PoppinsRealtimeSession({
      onStateChange: setVoiceState,
      onTranscript: applyTranscript,
      onToolCall: async (name, args) => {
        const result = await executePoppinsToolCall(name, args);
        const action = toolCallToMonitorAction(name, args, result);
        setLocalMonitorActions((current) => [action, ...current]);
        flashToolSuccess(action.label || name.replace(/_/g, ' '));
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
    if (!trimmed || asking || listening) return;
    setDraft('');
    setUserTranscript(trimmed);
    setPoppinsTranscript('');
    setAsking(true);
    setError('');
    setVoiceState('thinking');
    try {
      const result = await askPoppins(trimmed);
      setVoiceState('speaking');
      setPoppinsTranscript(result.answer);
      if (result.actions?.length) {
        setLocalMonitorActions((current) => [...result.actions!, ...current]);
        flashToolSuccess(result.actions[0]!.label);
      }
    } catch {
      setError('Poppins could not answer right now. Try again in a moment.');
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

    if (asking || listening) return;
    setError('');
    setUserTranscript('');
    setPoppinsTranscript('');
    setListening(true);
    try {
      const session = await ensureRealtime();
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
        : userTranscript ||
          (visualState === 'idle'
            ? ''
            : '');

  const idleHint = `${greetingWord()}. Tap to speak with ${majordomo.displayName}`;

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
          <PoppinsOrb size={176} state={visualState} speaking={visualState === 'speaking'} />
        </Pressable>

        <View style={styles.waveWrap}>
          <PoppinsWaveform
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
              placeholder={`Type to ${majordomo.displayName}…`}
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
            accessibilityLabel={listening ? 'Stop listening' : `Talk to ${majordomo.displayName}`}>
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
              ) : visualState === 'success' ? (
                <MaterialIcons name="check" size={30} color="#fff" />
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
