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
import { Redirect, router } from 'expo-router';
import type { ComponentType } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { PoppinsDock } from '@/components/orbit/poppins/poppins-dock';
import { PoppinsThreadPanel } from '@/components/orbit/poppins/poppins-thread-panel';
import { PoppinsHourglass } from '@/components/orbit/poppins-hourglass';
import { PoppinsLiveCaption } from '@/components/orbit/poppins-live-caption';
import { PoppinsOrb } from '@/components/orbit/poppins-orb';
import { PoppinsStage } from '@/components/orbit/poppins-stage';
import { IuiTroubleNothingHeard } from '@/components/orbit/poppins-stage/iui-trouble';
import { PoppinsWaveform } from '@/components/orbit/poppins-waveform';
import { useTourControls } from '@/components/orbit/tour/tour-provider';
import { TourTarget } from '@/components/orbit/tour/tour-target';
import { STAGE, stageFaint } from '@/constants/iui-stage';
import { space } from '@/constants/orbit-theme';
import { usePoppinsController } from '@/lib/poppins/use-poppins-controller';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

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

export default function PoppinsScreen() {
  const chromePad = useTabChromePaddingTop();
  const insets = useSafeAreaInsets();
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const { orbitPalette } = useOrbit();
  const tour = useTourControls();
  const p = usePoppinsController();

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
              {p.dailyLeft} LEFT
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
              {p.nothingHeard ? (
                <IuiTroubleNothingHeard
                  accent={STAGE.domain.chores}
                  failed={p.nothingHeard}
                  onRetry={p.retryAfterNothingHeard}
                />
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
              {p.holdTip ? (
                <Text style={[styles.holdTip, { color: c.textMuted }]}>{p.holdTip}</Text>
              ) : null}
            </View>
          ) : null}

          <View
            key="orb"
            style={[styles.orbSlot, live || p.threadOpen ? styles.orbSlotLive : styles.orbSlotIdle]}
            accessible
            accessibilityRole="image"
            accessibilityLabel={p.orb.label}>
            <PoppinsOrb
              size={p.orb.size}
              state={p.orb.state}
              speaking={p.orb.speaking}
              dailyFill={p.orb.dailyFill}
              monthGlow={p.orb.monthGlow}
              accent={p.orb.accent}
              drainPreview={p.orb.drainPreview}
            />
          </View>

          {live ? (
            <ScrollView
              style={styles.stageScroll}
              contentContainerStyle={styles.stageScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
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

        {p.threadOpen ? <PoppinsThreadPanel p={p} /> : null}
      </View>

      {/* Dock */}
      <PoppinsDock p={p} bottomInset={insets.bottom} showTierPills={!live || tourOnPoppins} />
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
    maxHeight: 260,
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
  idleHint: { fontSize: 14, letterSpacing: 0.2, textAlign: 'center' },
  orbSlot: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  orbSlotIdle: { flex: 1, minHeight: 196 },
  orbSlotLive: { flexGrow: 0, flexShrink: 0, paddingBottom: 10, paddingTop: 4 },
  stageScroll: { flex: 1, minHeight: 0, width: '100%' },
  stageScrollContent: {
    flexGrow: 1,
    paddingBottom: space.lg,
    paddingHorizontal: space.md,
  },
  stageTour: { width: '100%' },
  waveWrap: { marginTop: space.lg, width: '100%' },
  remoteAudio: { height: 0, opacity: 0, width: 0 },
});
