/**
 * One shared tablet on People — who's on it, and who you can add.
 *
 * Admins / owners never appear here (they run the house from their own phone). Sidekicks
 * tap on/off. The old mute pills looked dead; this card leads with faces and a clear edit.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AppText as Text } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import {
  pruneSharedDeviceLinks,
  resolveSharedDevicePeople,
  SHARED_DEVICE_MAX_PEOPLE,
  sharedDeviceLinkCandidates,
} from '@/lib/household/shared-device';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';

type Props = {
  device: HouseholdMember;
  members: HouseholdMember[];
  accent: string;
  onLinksChange: (memberIds: string[]) => void;
  onRemoveDevice: () => void;
  onOpenSwitch?: () => void;
};

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

export function SharedDeviceManageCard({
  device,
  members,
  accent,
  onLinksChange,
  onRemoveDevice,
  onOpenSwitch,
}: Props) {
  const { c, isDark, glassBorder } = useOrbitColors();
  const linkedIds = device.sharedWithMemberIds ?? [];
  const onDevice = useMemo(
    () => resolveSharedDevicePeople(device, members),
    [device, members]
  );
  const candidates = useMemo(() => sharedDeviceLinkCandidates(members), [members]);
  const available = useMemo(
    () => candidates.filter((person) => !linkedIds.includes(person.id)),
    [candidates, linkedIds]
  );
  const atCap = onDevice.length >= SHARED_DEVICE_MAX_PEOPLE;
  const deviceName = device.name?.trim() || 'Shared device';

  // Drop any admin / owner who was linked before the rule landed.
  useEffect(() => {
    const next = pruneSharedDeviceLinks(linkedIds, members);
    if (next) onLinksChange(next);
    // Only when the stored links themselves are dirty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.id, linkedIds.join('|'), members.map((m) => `${m.id}:${m.role}`).join('|')]);

  const toggle = (personId: string) => {
    if (linkedIds.includes(personId)) {
      onLinksChange(linkedIds.filter((id) => id !== personId));
      return;
    }
    if (atCap) return;
    onLinksChange([...linkedIds, personId]);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: glassFill(isDark),
          borderColor: `${accent}33`,
        },
      ]}>
      <LinearGradient
        colors={[`${accent}28`, `${accent}08`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.wash}
        pointerEvents="none"
      />

      <View style={styles.head}>
        <View style={[styles.mark, { backgroundColor: `${accent}22`, borderColor: `${accent}44` }]}>
          <MaterialIcons name="tablet-mac" size={22} color={accent} />
        </View>
        <View style={styles.headCopy}>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
            {deviceName}
          </Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            {onDevice.length === 0
              ? 'No one on this device yet'
              : `${onDevice.length} of ${SHARED_DEVICE_MAX_PEOPLE} people · tap a face to edit`}
          </Text>
        </View>
        {onDevice.length > 0 && onOpenSwitch ? (
          <Pressable
            onPress={onOpenSwitch}
            accessibilityRole="button"
            accessibilityLabel="Switch who's using this device"
            style={[styles.switchChip, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
            <MaterialIcons name="swap-horiz" size={16} color={accent} />
            <Text style={[styles.switchLabel, { color: accent }]}>Switch</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.sectionLabel, { color: accent }]}>On this device</Text>
      {onDevice.length === 0 ? (
        <View style={[styles.empty, { borderColor: glassBorder(0.12), backgroundColor: `${accent}10` }]}>
          <MaterialIcons name="person-add-alt" size={22} color={accent} />
          <Text style={[styles.emptyTitle, { color: c.text }]}>Add Sidekicks below</Text>
          <Text style={[styles.emptyBody, { color: c.textMuted }]}>
            Household admins stay on their own phones — only the people who share this tablet.
          </Text>
        </View>
      ) : (
        <View style={styles.faceRow}>
          {onDevice.map((person) => (
            <Pressable
              key={person.id}
              onPress={() => toggle(person.id)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${person.name} from ${deviceName}`}
              style={[styles.faceChip, { backgroundColor: `${accent}20`, borderColor: `${accent}55` }]}>
              <View style={[styles.faceAvatar, { backgroundColor: `${accent}33` }]}>
                {isAvatarImageUri(person.avatar) ? (
                  <Avatar name={person.name} imageUri={person.avatar} size="s" />
                ) : (
                  <Text style={[styles.faceMono, { color: accent }]}>
                    {memberDisplayEmoji(person) || monogram(person.name)}
                  </Text>
                )}
              </View>
              <Text style={[styles.faceName, { color: c.text }]} numberOfLines={1}>
                {person.name}
              </Text>
              <View style={[styles.faceRemove, { backgroundColor: `${accent}33` }]}>
                <MaterialIcons name="close" size={12} color={accent} />
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {available.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, { color: c.textSubtle }]}>
            {atCap ? 'Device is full' : 'Add people'}
          </Text>
          <View style={styles.faceRow}>
            {available.map((person) => (
              <Pressable
                key={person.id}
                disabled={atCap}
                onPress={() => toggle(person.id)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${person.name} to ${deviceName}`}
                style={[
                  styles.faceChip,
                  styles.faceChipDashed,
                  {
                    borderColor: atCap ? glassBorder(0.1) : `${accent}44`,
                    backgroundColor: atCap ? 'transparent' : `${accent}0C`,
                    opacity: atCap ? 0.45 : 1,
                  },
                ]}>
                <View style={[styles.faceAvatar, { backgroundColor: `${accent}18` }]}>
                  <Text style={[styles.faceMono, { color: accent }]}>
                    {memberDisplayEmoji(person) || monogram(person.name)}
                  </Text>
                </View>
                <Text style={[styles.faceName, { color: c.text }]} numberOfLines={1}>
                  {person.name}
                </Text>
                <View style={[styles.faceAdd, { backgroundColor: `${accent}28` }]}>
                  <MaterialIcons name="add" size={13} color={accent} />
                </View>
              </Pressable>
            ))}
          </View>
        </>
      ) : onDevice.length > 0 ? (
        <Text style={[styles.hint, { color: c.textSubtle }]}>
          Everyone who can share a tablet is already on this one.
        </Text>
      ) : null}

      <Pressable
        onPress={onRemoveDevice}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${deviceName}`}
        style={[styles.danger, { borderColor: 'rgba(248,113,113,0.4)' }]}>
        <MaterialIcons name="delete-outline" size={16} color="#F87171" />
        <Text style={styles.dangerText}>Remove device</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
    padding: 16,
  },
  wash: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  mark: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headCopy: { flex: 1, gap: 2, minWidth: 0 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  switchChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  switchLabel: { fontSize: 12, fontWeight: '800' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  empty: {
    alignItems: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptyBody: { fontSize: 13, lineHeight: 18 },
  faceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  faceChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    maxWidth: '100%',
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
  },
  faceChipDashed: {
    borderStyle: 'dashed',
  },
  faceAvatar: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 28,
  },
  faceMono: { fontSize: 12, fontWeight: '800' },
  faceName: { fontSize: 14, fontWeight: '700', maxWidth: 96 },
  faceRemove: {
    alignItems: 'center',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  faceAdd: {
    alignItems: 'center',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  hint: { fontSize: 12, lineHeight: 16 },
  danger: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 2,
    paddingVertical: 11,
  },
  dangerText: { color: '#F87171', fontSize: 13, fontWeight: '700' },
});
