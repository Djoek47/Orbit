/**
 * One shared tablet on People — who's on it, and who you can add.
 *
 * Admins / owners never appear here (they run the house from their own phone). Sidekicks
 * tap on/off. The old mute pills looked dead; this card leads with faces and a clear edit.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AppText as Text } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { MemberPresencePill } from '@/components/orbit/members/member-presence-pill';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { formatLastSeen, memberIsLive } from '@/lib/household/member-presence';
import {
  pruneSharedDeviceLinks,
  resolveSharedDevicePeople,
  SHARED_DEVICE_MAX_PEOPLE,
  sharedDeviceLinkCandidates,
} from '@/lib/household/shared-device';
import {
  sharedDeviceFullHint,
  sharedDeviceFullMessage,
  sharedDeviceFullTitle,
} from '@/lib/household/shared-device-cap-copy';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';

type Props = {
  device: HouseholdMember;
  members: HouseholdMember[];
  accent: string;
  onLinksChange: (memberIds: string[]) => void;
  /** Resolves when the device is gone (or rejects with an Error). */
  onRemoveDevice: () => void | Promise<void>;
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
}: Props) {
  const { c, isDark, glassBorder } = useOrbitColors();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
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

  const confirmAndRemove = async () => {
    if (removing) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await onRemoveDevice();
    } catch (error) {
      setConfirmRemove(false);
      setRemoveError(
        error instanceof Error && error.message
          ? error.message
          : 'Could not remove this device. Try again.'
      );
    } finally {
      setRemoving(false);
    }
  };

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
    if (atCap) {
      orbitAlert(sharedDeviceFullTitle(), sharedDeviceFullMessage(deviceName), undefined, {
        record: false,
      });
      return;
    }
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
              : onDevice.some((p) => memberIsLive(p))
                ? `${onDevice.length} people · someone connected`
                : (() => {
                    const times = onDevice
                      .map((p) => p.lastSeenAt)
                      .filter((iso): iso is string => Boolean(iso?.trim()))
                      .map((iso) => new Date(iso).getTime())
                      .filter((ms) => !Number.isNaN(ms));
                    const latest = times.length ? Math.max(...times) : null;
                    return latest
                      ? `${onDevice.length} people · last active ${formatLastSeen(new Date(latest).toISOString())}`
                      : `${onDevice.length} of ${SHARED_DEVICE_MAX_PEOPLE} people · tap a profile to edit`;
                  })()}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => router.push(`/setup-kid-device?deviceId=${encodeURIComponent(device.id)}` as never)}
        accessibilityRole="button"
        accessibilityLabel={`Show QR code for ${deviceName}`}
        style={[styles.showQr, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }]}>
        <MaterialIcons name="qr-code-2" size={18} color={accent} />
        <Text style={[styles.showQrText, { color: accent }]}>Show the code</Text>
        <MaterialIcons name="chevron-right" size={18} color={accent} />
      </Pressable>

      <Text style={[styles.sectionLabel, { color: accent }]}>Who can use it</Text>
      <Text style={[styles.linkHint, { color: c.textMuted }]}>
        These people appear on the tablet when it is unlocked.
      </Text>
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
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={[styles.faceName, { color: c.text }]} numberOfLines={1}>
                  {person.name}
                </Text>
                <MemberPresencePill
                  member={person}
                  variant="compact"
                  channel="shared"
                  sharedDeviceId={device.id}
                />
              </View>
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
            {atCap ? 'Tablet is full' : 'Add people'}
          </Text>
          {atCap ? (
            <Text style={[styles.linkHint, { color: c.textMuted }]}>{sharedDeviceFullHint()}</Text>
          ) : null}
          <View style={styles.faceRow}>
            {available.map((person) => (
              <Pressable
                key={person.id}
                onPress={() => toggle(person.id)}
                accessibilityRole="button"
                accessibilityLabel={
                  atCap
                    ? `${person.name}. ${sharedDeviceFullTitle()}`
                    : `Add ${person.name} to ${deviceName}`
                }
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

      {removeError ? (
        <Text style={styles.removeError} accessibilityLiveRegion="polite">
          {removeError}
        </Text>
      ) : null}

      {confirmRemove ? (
        <View
          style={[styles.confirmBox, { borderColor: 'rgba(248,113,113,0.45)', backgroundColor: 'rgba(248,113,113,0.1)' }]}>
          <Text style={[styles.confirmTitle, { color: c.text }]}>Remove {deviceName}?</Text>
          <Text style={[styles.confirmBody, { color: c.textMuted }]}>
            People stay in the household. This tablet just won’t list them anymore.
          </Text>
          <View style={styles.confirmRow}>
            <Pressable
              disabled={removing}
              onPress={() => setConfirmRemove(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel remove"
              style={[styles.confirmBtn, { borderColor: glassBorder(0.14), backgroundColor: glassFill(isDark) }]}>
              <Text style={[styles.confirmBtnText, { color: c.textSoft }]}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={removing}
              onPress={() => void confirmAndRemove()}
              accessibilityRole="button"
              accessibilityLabel={`Confirm remove ${deviceName}`}
              style={[styles.confirmBtn, styles.confirmDanger]}>
              {removing ? (
                <ActivityIndicator size="small" color="#F87171" />
              ) : (
                <Text style={styles.dangerText}>Remove</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            setRemoveError(null);
            setConfirmRemove(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${deviceName}`}
          style={[styles.danger, { borderColor: 'rgba(248,113,113,0.4)' }]}>
          <MaterialIcons name="delete-outline" size={16} color="#F87171" />
          <Text style={styles.dangerText}>Remove device</Text>
        </Pressable>
      )}
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
  linkHint: { fontSize: 12, fontWeight: '500', lineHeight: 16, marginTop: -4 },
  showQr: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  showQrText: { flex: 1, fontSize: 14, fontWeight: '700' },
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
  removeError: { color: '#F87171', fontSize: 12, lineHeight: 16 },
  confirmBox: {
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  confirmTitle: { fontSize: 15, fontWeight: '800' },
  confirmBody: { fontSize: 13, lineHeight: 18 },
  confirmRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  confirmBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingVertical: 10,
  },
  confirmDanger: {
    backgroundColor: 'rgba(248,113,113,0.16)',
    borderColor: '#F87171',
  },
  confirmBtnText: { fontSize: 13, fontWeight: '700' },
});
