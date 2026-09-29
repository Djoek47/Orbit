/**
 * Rewards & XP — WO14 §6 board layout.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import {
  DEFAULT_REWARD_MODEL,
  type RewardModel,
} from '@/lib/rewards/reward-model';
import { hasAllowanceModel } from '@/lib/rules/visibility';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';

type RewardMode = 'weighted' | 'flat';

type Props = {
  rewardModel: RewardModel;
  rewardMode: RewardMode;
  hygieneRewarded: boolean;
  hygieneXp: number;
  allowanceRequestsEnabled: boolean;
  dailyDeadlineLabel: string;
  use24h?: boolean;
  accent: string;
  onRewardModel: (model: RewardModel) => void;
  onRewardMode: (mode: RewardMode) => void;
  onHygiene: (rewarded: boolean) => void;
  onAllowanceRequests: (enabled: boolean) => void;
  onOpenDeadline: () => void;
};

const ALT: { id: RewardModel; label: string; sub: string }[] = [
  { id: 'xp_only', label: 'Points', sub: 'Levels only' },
  { id: 'allowance', label: 'Money', sub: 'Allowance only' },
  { id: 'xp_rewards', label: 'Mix', sub: 'Pick two' },
];

function BarSketch({ mode, accent }: { mode: RewardMode; accent: string }) {
  const heights = mode === 'weighted' ? [10, 16, 22] : [16, 16, 16];
  return (
    <View style={styles.bars}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={[styles.bar, { height: h, backgroundColor: accent, opacity: 0.55 + i * 0.15 }]}
        />
      ))}
    </View>
  );
}

export function RewardsXpPanel({
  rewardModel,
  rewardMode,
  hygieneRewarded,
  allowanceRequestsEnabled,
  dailyDeadlineLabel,
  accent,
  onRewardModel,
  onRewardMode,
  onHygiene,
  onAllowanceRequests,
  onOpenDeadline,
}: Props) {
  const { c, isDark, glassBorder } = useOrbitColors();
  const model = rewardModel || DEFAULT_REWARD_MODEL;
  const showAllowanceAsk = hasAllowanceModel(model);

  return (
    <View style={styles.root}>
      <Text style={[styles.purpose, { color: c.textMuted }]}>
        Nothing already earned is lost when you change this
      </Text>

      <Text style={[styles.groupLabel, { color: c.textSubtle }]}>WHAT THEY EARN</Text>
      <Pressable
        onPress={() => onRewardModel('full')}
        style={[
          styles.recommended,
          {
            backgroundColor: model === 'full' ? `${accent}22` : glassFill(isDark),
            borderColor: model === 'full' ? `${accent}66` : glassBorder(0.1),
          },
        ]}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[styles.recTitle, { color: c.text }]}>Everything</Text>
          <Text style={[styles.recSub, { color: c.textMuted }]}>
            Points, rewards and allowance
          </Text>
          <View style={styles.chipRow}>
            {['XP', 'Rewards', 'Money'].map((chip) => (
              <View key={chip} style={[styles.chip, { backgroundColor: `${accent}22` }]}>
                <Text style={[styles.chipLabel, { color: accent }]}>{chip}</Text>
              </View>
            ))}
          </View>
        </View>
        {model === 'full' ? (
          <MaterialIcons name="check-circle" size={22} color={accent} />
        ) : null}
      </Pressable>

      <View style={styles.altRow}>
        {ALT.map((opt) => {
          const selected =
            model === opt.id ||
            (opt.id === 'xp_rewards' && (model === 'xp_rewards' || model === 'xp_allowance'));
          return (
            <Pressable
              key={opt.id}
              onPress={() => onRewardModel(opt.id)}
              style={[
                styles.altCard,
                {
                  backgroundColor: selected ? `${accent}22` : glassFill(isDark),
                  borderColor: selected ? `${accent}55` : glassBorder(0.1),
                },
              ]}>
              <Text style={[styles.altTitle, { color: c.text }]}>{opt.label}</Text>
              <Text style={[styles.altSub, { color: c.textMuted }]}>{opt.sub}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* xp_allowance as Mix detail when Mix tapped twice — keep accessible via long Mix */}
      {model === 'xp_allowance' || model === 'xp_rewards' ? (
        <View style={styles.mixRow}>
          <Pressable
            onPress={() => onRewardModel('xp_rewards')}
            style={[
              styles.mixChip,
              {
                backgroundColor: model === 'xp_rewards' ? accent : glassFill(isDark),
                borderColor: glassBorder(0.1),
              },
            ]}>
            <Text style={{ color: model === 'xp_rewards' ? '#041018' : c.text, fontWeight: '600' }}>
              XP + Rewards
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onRewardModel('xp_allowance')}
            style={[
              styles.mixChip,
              {
                backgroundColor: model === 'xp_allowance' ? accent : glassFill(isDark),
                borderColor: glassBorder(0.1),
              },
            ]}>
            <Text
              style={{ color: model === 'xp_allowance' ? '#041018' : c.text, fontWeight: '600' }}>
              XP + Allowance
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={[styles.groupLabel, { color: c.textSubtle }]}>POINTS</Text>
      <View style={styles.scoreRow}>
        {(['weighted', 'flat'] as RewardMode[]).map((mode) => {
          const active = rewardMode === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => onRewardMode(mode)}
              style={[
                styles.scoreCard,
                {
                  backgroundColor: active ? `${accent}22` : glassFill(isDark),
                  borderColor: active ? `${accent}55` : glassBorder(0.1),
                },
              ]}>
              <BarSketch mode={mode} accent={accent} />
              <Text style={[styles.scoreTitle, { color: c.text }]}>
                {mode === 'weighted' ? 'By effort' : 'The same'}
              </Text>
              <Text style={[styles.scoreSub, { color: c.textMuted }]}>
                {mode === 'weighted' ? 'The bins beat a made bed' : 'Every chore is one'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.groupLabel, { color: c.textSubtle }]}>TUNING</Text>
      <View style={[styles.tuneCard, { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) }]}>
        <View style={styles.tuneRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tuneTitle, { color: c.text }]}>Points for hygiene</Text>
            <Text style={[styles.tuneSub, { color: c.textMuted }]}>
              {hygieneRewarded ? 'On' : 'Off — these build streaks'}
            </Text>
          </View>
          <Switch
            value={hygieneRewarded}
            onValueChange={onHygiene}
            trackColor={{ false: glassBorder(0.14), true: accent }}
          />
        </View>
        {showAllowanceAsk ? (
          <View style={[styles.tuneRow, styles.tuneDivider, { borderTopColor: glassBorder(0.08) }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tuneTitle, { color: c.text }]}>Kids can ask for an amount</Text>
              <Text style={[styles.tuneSub, { color: c.textMuted }]}>
                From their balance, you approve
              </Text>
            </View>
            <Switch
              value={allowanceRequestsEnabled}
              onValueChange={onAllowanceRequests}
              trackColor={{ false: glassBorder(0.14), true: accent }}
            />
          </View>
        ) : null}
        <Pressable
          onPress={onOpenDeadline}
          style={[styles.tuneRow, styles.tuneDivider, { borderTopColor: glassBorder(0.08) }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tuneTitle, { color: c.text }]}>Daily deadline</Text>
            <Text style={[styles.tuneSub, { color: c.textMuted }]}>{dailyDeadlineLabel}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  purpose: { fontSize: 14, lineHeight: 20 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 8,
  },
  recommended: {
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  recTitle: { fontSize: 20, fontWeight: '700' },
  recSub: { fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipLabel: { fontSize: 12, fontWeight: '600' },
  altRow: { flexDirection: 'row', gap: 8 },
  altCard: {
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minHeight: 72,
    padding: 12,
  },
  altTitle: { fontSize: 15, fontWeight: '700' },
  altSub: { fontSize: 12 },
  mixRow: { flexDirection: 'row', gap: 8 },
  mixChip: {
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRow: { flexDirection: 'row', gap: 10 },
  scoreCard: {
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    padding: 14,
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 24 },
  bar: { borderRadius: 3, width: 10 },
  scoreTitle: { fontSize: 16, fontWeight: '700' },
  scoreSub: { fontSize: 12, lineHeight: 16 },
  tuneCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  tuneRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tuneDivider: { borderTopWidth: StyleSheet.hairlineWidth },
  tuneTitle: { fontSize: 15, fontWeight: '600' },
  tuneSub: { fontSize: 13, marginTop: 2 },
});
