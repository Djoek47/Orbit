/**
 * Revision F §3 — per-member invite sheet.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { useEffect } from 'react';
import { Share, Alert, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText as Text } from '@/components/orbit/app-text';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { typography } from '@/constants/orbit-theme';
import {
  activeInviteForMember,
  buildMemberInviteDeepLink,
  createMemberInvite,
  generateInviteToken,
  revokePreviousInvites,
  type MemberInvite,
} from '@/lib/household/member-invites';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';

type Props = {
  visible: boolean;
  member: HouseholdMember | null;
  householdId: string;
  adminId: string;
  invites: MemberInvite[];
  onChangeInvites: (next: MemberInvite[]) => void;
  onClose: () => void;
};

export function MemberInviteSheet({
  visible,
  member,
  householdId,
  adminId,
  invites,
  onChangeInvites,
  onClose,
}: Props) {
  const { c, glassBorder } = useOrbitColors();

  useEffect(() => {
    if (!visible || !member) return;
    if (activeInviteForMember(invites, member.id)) return;
    const token = generateInviteToken();
    const revoked = revokePreviousInvites(invites, member.id);
    const next = createMemberInvite({
      householdId,
      memberId: member.id,
      createdBy: adminId,
      token,
    });
    onChangeInvites([...revoked, next]);
    // Intentionally only when opening for a member without an invite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, member?.id]);

  if (!member) return null;

  const display = activeInviteForMember(invites, member.id);
  const displayLink = display ? buildMemberInviteDeepLink(display.token) : null;

  const share = async () => {
    if (!displayLink) return;
    await Share.share({
      message: `Scan this on ${member.name}'s device to add them to the household.\n${displayLink}`,
      url: displayLink,
    });
  };

  const regenerate = () => {
    Alert.alert('Generate a new code', 'The old code will stop working.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Generate',
        style: 'destructive',
        onPress: () => {
          const token = generateInviteToken();
          const revoked = revokePreviousInvites(invites, member.id);
          const next = createMemberInvite({
            householdId,
            memberId: member.id,
            createdBy: adminId,
            token,
          });
          onChangeInvites([...revoked, next]);
        },
      },
    ]);
  };

  return (
    <BottomSheet visible={visible} onDismiss={onClose} heightRatio={0.72}>
      <View style={styles.body}>
        <Text style={[typography.headline, { color: c.text, textAlign: 'center' }]}>
          {member.name.toUpperCase()}
        </Text>
        {displayLink ? (
          <View style={[styles.qrWrap, { backgroundColor: '#fff', borderColor: glassBorder(0.12) }]}>
            <QRCode value={displayLink} size={180} />
          </View>
        ) : null}
        <Text style={[typography.body, { color: c.textSoft, textAlign: 'center' }]}>
          Scan this on {member.name}&apos;s device to add them to the household.
        </Text>
        <Pressable onPress={() => void share()} style={[styles.primary, { backgroundColor: c.primary }]}>
          <Text style={[typography.headline, { color: '#041018' }]}>Share invite link</Text>
        </Pressable>
        <Pressable onPress={regenerate}>
          <Text style={[typography.subheadline, { color: c.primary, textAlign: 'center' }]}>
            Generate a new code
          </Text>
        </Pressable>
        <Text style={[typography.caption1, { color: c.textSubtle, textAlign: 'center' }]}>
          Expires in 7 days · works once
        </Text>
        {displayLink ? (
          <Pressable
            onPress={() => {
              void Clipboard.setStringAsync(displayLink);
              Alert.alert('Copied', 'Invite link copied.');
            }}
            style={styles.copyRow}>
            <MaterialIcons name="content-copy" size={16} color={c.textMuted} />
            <Text style={[typography.caption1, { color: c.textMuted }]} numberOfLines={1}>
              {displayLink}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingBottom: 8, paddingHorizontal: 4 },
  qrWrap: {
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  primary: {
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
  },
  copyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
