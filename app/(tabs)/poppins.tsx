/**
 * The Poppins tab — layout only. Behaviour lives in usePoppinsController.
 *
 * Three fixed regions, top to bottom, and nothing ever overlaps another:
 *
 *   header  — who / what the stage is doing, and actions left today
 *   body    — flex: the orb (always mounted, 196 idle / 72 live) and, when a card is live,
 *             the stage in its own scroll view. Typing splits the body with the thread
 *             instead of floating a sheet over the card.
 *   dock    — status line, [type] [talk], the mic label, Base / Max
 *
 * The stage used to be an unbounded view: a tall card (the settle ledger, a compose card
 * with faces) grew past the body and drew under the dock, which sat on top of it and ate
 * every tap. It now scrolls inside the body and can never reach the dock.
 */
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { PoppinsDock } from '@/components/orbit/poppins/poppins-dock';
import { PoppinsThreadPanel } from '@/components/orbit/poppins/poppins-thread-panel';
import { PoppinsHourglass } from '@/components/orbit/poppins-hourglass';
import { PoppinsLiveCaption } from '@/components/orbit/poppins-live-caption';
import { PoppinsOrb } from '@/components/orbit/poppins-orb';
import { PoppinsStage } from '@/components/orbit/poppins-stage';
import {
  IuiTroubleMissingSlot,
  IuiTroubleNothingHeard,
} from '@/components/orbit/poppins-stage/iui-trouble';
import { REFRAME_CHIPS, type ReframeFamily } from '@/lib/poppins/base-session';
import { PoppinsWaveform } from '@/components/orbit/poppins-waveform';
import { useTourControls } from '@/components/orbit/tour/tour-provider';
import { TourTarget } from '@/components/orbit/tour/tour-target';
import { STAGE, stageFaint } from '@/constants/iui-stage';
import { space } from '@/constants/orbit-theme';
import { OutOfActionsSheet } from '@/components/orbit/billing/out-of-actions-sheet';
import { PoppinsTrialLock, useBoughtBalance } from '@/components/orbit/billing/poppins-trial-lock';
import { useAccess } from '@/lib/billing/access-provider';
import { usePoppinsController } from '@/lib/poppins/use-poppins-controller';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { setPoppinsTypingMode } from '@/lib/ui/typing-mode';
import { useKeyboardVisible } from '@/lib/ui/use-keyboard-visible';
import { useOrbit } from '@/store/orbit-store';
import { isSidekickRole } from '@/lib/sidekick/permissions';

type RtcViewType = ComponentType<{ streamURL: string; style?: object }>;

/** Native-only audio sink so the WebRTC remote audio is attached. */
function loadRtcView(): RtcViewType | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('react-native-webrtc') as { RTCView?: RtcViewType }).RTCView ?? null;
  } catch {
    return null;
  }
}

function PoppinsRemoteAudio({ streamURL }: { streamURL: string | null }) {
  if (!streamURL || Platform.OS === 'web') return null;
  const RTCView = loadRtcView();
  if (!RTCView) return null;
  return <RTCView streamURL={streamURL} style={styles.remoteAudio} />;
}

/** What "Ask Poppins" means, per place it was tapped. */
const POPPINS_ASK_OPENERS: Record<string, string> = {
  trips: 'Plan a run for today — group my errands into one trip.',
  plan: 'What does the house need today?',
  groceries: 'What should I add to the shopping list?',
};

function PoppinsScreenInner() {
  const chromePad = useTabChromePaddingTop();
  const insets = useSafeAreaInsets();
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const { orbitPalette, household } = useOrbit();
  const tour = useTourControls();
  const p = usePoppinsController();
  const innerAccess = useAccess();
  // Out of actions on a paying household: the glass top-up sheet, once per time it runs out.
  // Admins only — Poppins is theirs, and a pack is a purchase.
  const [topUpOpen, setTopUpOpen] = useState(false);
  // A purchase made anywhere lands here: the orb drains, then fills back up, with "+700".
  const [refill, setRefill] = useState<{ tokens: number; draining: boolean } | null>(null);
  const checkRefill = useCallback(async () => {
    const { takePendingRefill } = await import('@/lib/billing/token-grants');
    const tokens = await takePendingRefill(household.id);
    if (tokens <= 0) return;
    setRefill({ tokens, draining: true });
    setTimeout(() => setRefill({ tokens, draining: false }), 450);
    setTimeout(() => setRefill(null), 3200);
  }, [household.id]);
  useFocusEffect(
    useCallback(() => {
      void checkRefill();
    }, [checkRefill])
  );
  const shownForTripRef = useRef(false);
  useEffect(() => {
    const out = p.outOfActions && p.canManageHousehold && innerAccess.view.level !== 'locked';
    if (out && !shownForTripRef.current) {
      shownForTripRef.current = true;
      setTopUpOpen(true);
    }
    if (!p.outOfActions) shownForTripRef.current = false;
  }, [p.outOfActions, p.canManageHousehold, innerAccess.view.level]);
  // "Ask Poppins" elsewhere in the app lands here with a topic, so the tab opens ready to talk
  // about that thing instead of a blank stage. Nothing is sent — the words are theirs to send.
  const askParams = useLocalSearchParams<{ ask?: string }>();
  const askedRef = useRef<string | null>(null);
  useEffect(() => {
    const topic = typeof askParams.ask === 'string' ? askParams.ask : null;
    if (!topic || askedRef.current === topic) return;
    askedRef.current = topic;
    const opener = POPPINS_ASK_OPENERS[topic];
    if (!opener) return;
    p.setThreadOpen(true);
    p.setDraft(opener);
  }, [askParams.ask, p]);
  // Typing mode is the chat being open — not just the keyboard being up. With the keyboard down
  // the old layout came straight back (mic, pills, full tab bar) and the thread was a sliver.
  // It gets its own layout: thread tall, orb and dock folded, tab bar down to its icons.
  const typing = p.threadOpen;
  const softKeyboard = useKeyboardVisible();
  useFocusEffect(
    useCallback(() => {
      setPoppinsTypingMode(typing);
      return () => setPoppinsTypingMode(false);
    }, [typing])
  );

  if (!p.poppinsAllowed) {
    return <Redirect href={'/(tabs)' as never} />;
  }

  const live = p.drive.live;
  const tourOnPoppins = Boolean(tour?.activeStepId?.startsWith('poppins.'));
  const background = isDark ? STAGE.shell.groundDark : live ? STAGE.shell.groundLight : orbitPalette.background;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={24}>
      <PoppinsRemoteAudio streamURL={p.remoteStreamUrl} />
      <View style={[styles.ambient, { backgroundColor: p.ambient }]} pointerEvents="none" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: chromePad }]}>
        <View style={styles.headerLead} accessible accessibilityRole="header">
          <View style={[styles.headerDot, { backgroundColor: p.headerDot }]} />
          <Text
            style={[styles.kicker, { color: isDark ? STAGE.text.mutedDark : STAGE.text.mutedLight }]}
            numberOfLines={1}>
            {p.headerLabel}
          </Text>
        </View>
        <View style={styles.headerTrail}>
          <TourTarget id="poppins.meter">
            <Text
              style={[styles.kicker, { color: stageFaint(isDark) }]}
              accessibilityLabel={`${p.dailyLeft} actions left today`}>
              {p.meterLabel}
            </Text>
          </TourTarget>
          {!live ? (
            <Pressable
              style={[styles.activityBtn, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}
              onPress={() =>
                router.push({
                  pathname: '/notifications',
                  params: { tab: 'activity', from: 'poppins' },
                } as never)
              }
              accessibilityRole="button"
              accessibilityLabel="Activity">
              <PoppinsHourglass size={18} color="#2DD4BF" active={p.isActive} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.stageRegion}>
          {!live ? (
            <View style={styles.idleTop}>
              {p.baseTrouble?.kind === 'unknown' ? (
                <View style={styles.troubleWrap}>
                  <IuiTroubleMissingSlot
                    accent={STAGE.domain.chores}
                    question={p.baseTrouble.title}
                    why={p.baseTrouble.reason}
                    chips={REFRAME_CHIPS}
                    onPick={(id) => p.reframeBaseSentence(id as ReframeFamily)}
                  />
                </View>
              ) : p.baseTrouble ? (
                <View style={styles.troubleWrap}>
                  <IuiTroubleNothingHeard
                    accent={STAGE.domain.chores}
                    title={p.baseTrouble.title}
                    reason={p.baseTrouble.reason}
                    actionLabel={
                      p.baseTrouble.action === 'settings'
                        ? 'Settings'
                        : p.baseTrouble.action === 'type'
                          ? 'Type'
                          : 'Again'
                    }
                    onRetry={() => p.onBaseTroubleAction(p.baseTrouble?.action ?? 'again')}
                  />
                </View>
              ) : p.nothingHeard ? (
                <View style={styles.troubleWrap}>
                  <IuiTroubleNothingHeard
                    accent={STAGE.domain.chores}
                    failed={p.nothingHeard}
                    onRetry={p.retryAfterNothingHeard}
                  />
                </View>
              ) : p.micUi.hint && !p.micUi.micEnabled ? (
                <View style={styles.transportHint}>
                  <Text style={[styles.transportHintText, { color: c.textMuted }]}>{p.micUi.hint}</Text>
                  {p.micUi.offerSwitchToBase && p.canManageHousehold ? (
                    <Pressable
                      onPress={p.switchToBaseFromMic}
                      accessibilityRole="button"
                      accessibilityLabel="Switch to Base"
                      style={[styles.switchBaseBtn, { backgroundColor: glass(0.08), borderColor: glassBorder(0.12) }]}>
                      <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>Switch to Base</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : p.caption.speaker ? (
                <PoppinsLiveCaption
                  key={p.caption.speaker}
                  speaker={p.caption.speaker}
                  label={p.caption.label}
                  text={p.caption.text}
                  accent={p.caption.accent}
                  textColor={p.caption.textColor}
                  showDots={p.caption.showDots}
                />
              ) : (
                <Text style={[styles.idleHint, { color: isDark ? 'rgba(255,255,255,0.25)' : c.textMuted }]}>
                  {p.continueHint ?? p.idleHint}
                </Text>
              )}
              {p.baseAfter && !p.baseTrouble ? (
                <Text
                  style={[styles.baseAfter, { color: isDark ? STAGE.text.mutedDark : STAGE.text.mutedLight }]}
                  accessibilityLiveRegion="polite">
                  {p.baseAfter}
                </Text>
              ) : null}
              {p.holdTip ? (
                <Text style={[styles.holdTip, { color: c.textMuted }]}>{p.holdTip}</Text>
              ) : null}
            </View>
          ) : null}

          {/* The orb collapses while you type — it's decoration, and the keyboard needs the room.
              It stays mounted, so nothing restarts when the keyboard closes. */}
          <View
            key="orb"
            style={[
              styles.orbSlot,
              live || p.threadOpen ? styles.orbSlotLive : styles.orbSlotIdle,
              typing && styles.orbSlotTyping,
            ]}
            accessible={!typing}
            accessibilityElementsHidden={typing}
            accessibilityRole="image"
            accessibilityLabel={p.orb.label}>
            <PoppinsOrb
              size={p.orb.size}
              speaking={p.orb.speaking}
              dailyFill={refill?.draining ? 0 : p.orb.dailyFill}
              monthGlow={refill?.draining ? 0 : p.orb.monthGlow}
              state={refill && !refill.draining ? 'success' : p.orb.state}
              accent={p.orb.accent}
              drainPreview={p.orb.drainPreview}
            />
            {refill && !refill.draining ? (
              <Animated.Text
                entering={FadeInUp.springify().damping(14)}
                exiting={FadeOut.duration(400)}
                style={[styles.refillBadge, { color: p.orb.accent ?? '#FFB347' }]}
                accessibilityLiveRegion="polite">
                +{refill.tokens.toLocaleString()} actions
              </Animated.Text>
            ) : null}
          </View>

          {live ? (
            <ScrollView
              style={[styles.stageScroll, typing && styles.stageScrollTyping]}
              contentContainerStyle={styles.stageScrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}>
              {p.heard ? (
                <Text
                  style={[
                    styles.heard,
                    {
                      color: isDark ? STAGE.text.mutedDark : STAGE.text.mutedLight,
                      opacity: p.heard.live ? 0.6 : 1,
                    },
                  ]}
                  numberOfLines={3}
                  accessibilityLabel={`You said: ${p.heard.text}`}>
                  “{p.heard.text}”
                </Text>
              ) : null}
              <TourTarget id="poppins.stage" style={styles.stageTour}>
                <PoppinsStage onVoiceTaskCreated={p.onVoiceTaskCreated} />
              </TourTarget>
            </ScrollView>
          ) : (
            <View style={styles.waveWrap}>
              <PoppinsWaveform
                active={p.visualState === 'listening' || p.visualState === 'speaking'}
                color={p.stateColor}
                levelDb={p.waveLevelDb}
              />
            </View>
          )}
        </View>

        {p.threadOpen ? (
          <PoppinsThreadPanel p={p} keyboardUp={softKeyboard} stageLive={Boolean(live)} />
        ) : null}
      </View>

      {/* Dock */}
      <PoppinsDock
        p={p}
        bottomInset={insets.bottom}
        showTierPills={!live || tourOnPoppins}
        folded={typing}
      />
      <OutOfActionsSheet
        visible={topUpOpen}
        balance={p.tokensRemaining}
        onTrial={innerAccess.view.level === 'trial'}
        onClose={() => {
          setTopUpOpen(false);
          // If they bought, play the refill on the big orb too.
          setTimeout(() => void checkRefill(), 350);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  ambient: {
    position: 'absolute',
    top: 96,
    left: '50%',
    marginLeft: -310,
    width: 620,
    height: 620,
    borderRadius: 999,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  headerLead: { alignItems: 'center', flexDirection: 'row', gap: 10, flexShrink: 1 },
  headerDot: { width: 7, height: 7, borderRadius: 4 },
  headerTrail: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2 },
  activityBtn: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  body: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  stageRegion: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  idleTop: {
    alignItems: 'center',
    gap: 8,
    maxHeight: 340,
    minHeight: 96,
    overflow: 'hidden',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    width: '100%',
  },
  transportHint: { alignItems: 'center', gap: 8 },
  transportHintText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  switchBaseBtn: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  holdTip: { fontSize: 13, textAlign: 'center' },
  baseAfter: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: space.md },
  troubleWrap: { alignSelf: 'stretch' },
  heard: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  idleHint: { fontSize: 14, letterSpacing: 0.2, textAlign: 'center' },
  orbSlot: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  orbSlotIdle: { flex: 1, minHeight: 196 },
  orbSlotLive: { flexGrow: 0, flexShrink: 0, paddingBottom: 10, paddingTop: 4 },
  orbSlotTyping: { height: 0, opacity: 0, overflow: 'hidden', paddingBottom: 0, paddingTop: 0 },
  stageScroll: { flex: 1, minHeight: 0, width: '100%' },
  /** Typing + a live card: the stage keeps the room; the composer is a strip under it. */
  stageScrollTyping: { flexGrow: 1, flexShrink: 1, minHeight: 220 },
  stageScrollContent: {
    flexGrow: 1,
    paddingBottom: space.lg,
    paddingHorizontal: space.md,
  },
  stageTour: { width: '100%' },
  waveWrap: { marginTop: space.lg, width: '100%' },
  remoteAudio: { height: 0, opacity: 0, width: 0 },
  refillBadge: {
    alignSelf: 'center',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 10,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 8,
  },
});

/** Sidekicks never get Poppins — any way in (a link, a notification, a stale tab) lands on Home. */
export default function PoppinsScreen() {
  const { currentMember } = useOrbit();
  const access = useAccess();
  const bought = useBoughtBalance();
  if (isSidekickRole(currentMember?.role)) {
    return <Redirect href={'/(tabs)' as never} />;
  }
  // On a free trial the monthly allowance is zero: Poppins runs on bought actions only. With
  // none bought, show what it costs rather than a stage that will refuse every request.
  // Waits for both reads, so a household with credits never sees the lock flash.
  if (access.ready && access.view.level === 'trial' && bought !== null && bought <= 0) {
    return <PoppinsTrialLock />;
  }
  return <PoppinsScreenInner />;
}
