/**
 * The Poppins dock: one status line, [type] [talk] [balance], the mic's label, and the
 * Base / Max pills.
 *
 * The dock is a fixed region below the stage — never over it. While a card is live the
 * tier pills step aside (unless the tour is pointing at them) so the card gets the room.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { PoppinsModeCards } from '@/components/orbit/poppins-mode-cards';
import { TourTarget } from '@/components/orbit/tour/tour-target';
import { STAGE } from '@/constants/iui-stage';
import { space } from '@/constants/orbit-theme';
import type { PoppinsController } from '@/lib/poppins/use-poppins-controller';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  p: PoppinsController;
  bottomInset: number;
  showTierPills: boolean;
};

export function PoppinsDock({ p, bottomInset, showTierPills }: Props) {
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const { micUi, primaryConnected, connecting, voiceSettling, captureMode } = p;
  const micDisabled = voiceSettling || (!micUi.micEnabled && !micUi.offerSwitchToBase);

  return (
    <View style={[styles.dock, { paddingBottom: Math.max(bottomInset, 16) + 8 }]}>
      {p.error ? (
        <Text style={[styles.status, { color: c.danger }]} selectable numberOfLines={8}>
          {p.error}
        </Text>
      ) : p.statusNotice ? (
        <Text style={[styles.status, { color: c.textMuted }]} selectable numberOfLines={6}>
          {p.statusNotice}
        </Text>
      ) : null}

      <View style={[styles.row, { gap: STAGE.dock.gap }]}>
        <Pressable
          onPress={() => p.setThreadOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={p.threadOpen ? 'Hide typing' : `Type to ${p.majordomo.displayName}`}
          accessibilityState={{ expanded: p.threadOpen }}
          style={[
            styles.sideBtn,
            {
              width: STAGE.dock.side,
              height: STAGE.dock.side,
              borderRadius: STAGE.dock.sideRadius,
              backgroundColor: p.threadOpen ? 'rgba(56,189,248,0.15)' : glass(0.07),
              borderColor: p.threadOpen ? 'rgba(56,189,248,0.3)' : glassBorder(0.1),
            },
          ]}>
          <MaterialIcons
            name={p.threadOpen ? 'close' : 'keyboard'}
            size={20}
            color={p.threadOpen ? '#38BDF8' : c.textMuted}
          />
        </Pressable>

        <TourTarget id="poppins.speak">
          <Pressable
            onPress={p.onMicPress}
            onLongPress={p.onMicLongPress}
            onPressOut={p.onMicPressOut}
            delayLongPress={700}
            disabled={micDisabled}
            style={[styles.micWrap, { width: STAGE.dock.mic, height: STAGE.dock.mic }]}
            accessibilityRole="button"
            accessibilityLabel={
              primaryConnected
                ? captureMode === 'tap10'
                  ? 'Stop'
                  : 'Done'
                : micUi.micEnabled
                  ? 'Speak'
                  : micUi.offerSwitchToBase
                    ? 'Switch to Base to talk'
                    : 'Voice unavailable'
            }
            accessibilityHint={
              primaryConnected
                ? 'Stops listening and keeps what is on screen'
                : micUi.micEnabled
                  ? 'Hold to talk, or tap for a 10 second window'
                  : undefined
            }
            accessibilityState={{
              busy: connecting || voiceSettling,
              selected: primaryConnected,
              disabled: micDisabled,
            }}>
            {primaryConnected ? (
              <View
                style={[
                  styles.micPulse,
                  {
                    backgroundColor: isDark ? 'rgba(52,211,153,0.2)' : 'rgba(15,111,85,0.16)',
                    borderRadius: STAGE.dock.mic / 2,
                  },
                ]}
              />
            ) : null}
            <LinearGradient
              colors={
                !micUi.micEnabled
                  ? ['rgba(100,116,139,0.7)', 'rgba(71,85,105,0.65)']
                  : primaryConnected
                    ? ['rgba(248,113,113,0.95)', 'rgba(239,68,68,0.85)']
                    : connecting
                      ? ['rgba(167,139,250,0.9)', 'rgba(139,92,246,0.8)']
                      : isDark
                        ? [STAGE.shell.mic, '#248A64']
                        : [STAGE.domainLight.chores, '#0A5A44']
              }
              style={[
                styles.micBtn,
                {
                  width: STAGE.dock.mic,
                  height: STAGE.dock.mic,
                  borderRadius: STAGE.dock.mic / 2,
                  borderColor: primaryConnected
                    ? 'rgba(255,255,255,0.25)'
                    : isDark
                      ? 'rgba(118,196,174,0.28)'
                      : 'rgba(15,111,85,0.28)',
                  opacity: micUi.micEnabled ? 1 : 0.72,
                },
              ]}>
              {primaryConnected ? (
                captureMode === 'tap10' && p.tapSecondsLeft != null ? (
                  <Text style={styles.tapCountdown}>{p.tapSecondsLeft}</Text>
                ) : (
                  <View style={styles.stopSquare} />
                )
              ) : connecting ? (
                <MaterialIcons name="graphic-eq" size={28} color="#fff" />
              ) : (
                <MaterialIcons name="mic" size={28} color="#FFFFFF" />
              )}
            </LinearGradient>
            {p.capSecondsLeft != null && p.capSecondsLeft <= 5 ? (
              <Text style={styles.capCountdown}>{p.capSecondsLeft}s</Text>
            ) : null}
          </Pressable>
        </TourTarget>

        {/* Keeps the mic centred: the dock is type + talk. */}
        <View style={{ width: STAGE.dock.side, height: STAGE.dock.side }} />
      </View>

      <Text
        style={[styles.micLabel, { color: p.isActive ? p.stateColor : c.textSubtle }]}
        accessibilityLiveRegion="polite">
        {p.micLabel}
      </Text>

      {showTierPills ? (
        <TourTarget id="poppins.mode">
          <View style={styles.pills}>
            <PoppinsModeCards
              layout="pills"
              prefs={p.interactionPrefs}
              accent={p.majordomo.accent}
              disabled={!p.canManageHousehold}
              onSelectTier={p.selectPoppinsTier}
            />
          </View>
        </TourTarget>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    flexShrink: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    alignItems: 'stretch',
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  sideBtn: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
  },
  micWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micPulse: {
    ...StyleSheet.absoluteFill,
    transform: [{ scale: 1.35 }],
  },
  micBtn: {
    alignItems: 'center',
    borderWidth: 3,
    justifyContent: 'center',
  },
  stopSquare: {
    backgroundColor: '#fff',
    borderRadius: 4,
    height: 20,
    width: 20,
  },
  tapCountdown: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  capCountdown: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
    position: 'absolute',
    top: -2,
  },
  micLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: 6,
    textAlign: 'center',
  },
  pills: {
    marginTop: 10,
  },
});
