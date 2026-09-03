import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { MemberConnectionCaption } from '@/components/orbit/member-connection-badge';
import { space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { memberCanReceiveInvite } from '@/lib/household/member-invite-routing';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

type Props = {
  person: HouseholdMember;
  active: boolean;
  accent: string;
  canManage: boolean;
  onSwitch: () => void;
  onPersonalize: () => void;
  onShareInvite?: () => void;
  onUnlink?: () => void;
  onRemove?: () => void;
};

/** Person linked to a shared iPad — nested under the device card. */
export function SharedAccountRow({
  person,
  active,
  accent,
  canManage,
  onSwitch,
  onPersonalize,
  onShareInvite,
  onUnlink,
  onRemove,
}: Props) {
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const photo = isAvatarImageUri(person.avatar);

  return (
    <View style={[styles.block, { borderTopColor: glassBorder(0.08) }]}>
      <View style={styles.row}>
        <Pressable
          onPress={onPersonalize}
          accessibilityLabel={`Personalize look for ${person.name}`}
          style={[styles.avatar, { backgroundColor: `${active ? accent : c.textSubtle}33` }]}>
          {photo ? (
            <Image source={{ uri: person.avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarEmoji}>{memberDisplayEmoji(person)}</Text>
          )}
        </Pressable>

        <Pressable style={styles.identity} onPress={onSwitch}>
          <Text style={[typography.headline, styles.name, { color: c.text }]} numberOfLines={1}>
            {person.name}
          </Text>
          <MemberConnectionCaption member={person} />
          <Text style={[styles.hint, { color: c.textSubtle }]}>On this iPad · own XP & redeem</Text>
          <Text style={[styles.xp, { color: accent }]}>
            {person.xp} XP · week {person.weekXp ?? 0}
          </Text>
        </Pressable>

        {active ? (
          <View style={[styles.activeDot, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
            <MaterialIcons name="check" size={14} color={accent} />
          </View>
        ) : null}
      </View>

      {canManage ? (
        <View style={styles.actions}>
          {onShareInvite && memberCanReceiveInvite(person) ? (
            <Pressable
              onPress={onShareInvite}
              style={[
                styles.chip,
                { backgroundColor: `${accent}14`, borderColor: `${accent}44` },
              ]}>
              <MaterialIcons name="qr-code-2" size={14} color={accent} />
              <Text style={[styles.chipText, { color: accent }]}>Share invite</Text>
            </Pressable>
          ) : null}
          {onUnlink ? (
            <Pressable
              onPress={onUnlink}
              style={[
                styles.chip,
                { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
              ]}>
              <Text style={[styles.chipText, { color: c.textMuted }]}>Unlink</Text>
            </Pressable>
          ) : null}
          {onRemove ? (
            <Pressable
              onPress={onRemove}
              style={[styles.chip, styles.chipDanger, { backgroundColor: glass(0.04) }]}>
              <Text style={[styles.chipText, { color: '#F87171' }]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
    paddingTop: space.sm,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: space.sm,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  avatarImage: { height: 48, width: 48 },
  avatarEmoji: { fontSize: 24 },
  identity: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  name: {
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
  },
  xp: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeDot: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipDanger: {
    borderColor: 'rgba(248,113,113,0.35)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
