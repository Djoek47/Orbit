/**
 * Revision F §3 — per-member invite sheet.
 * One QR, one action, quiet expiry — no shouting.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { useEffect } from 'react';
import { Share, Alert, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText as Text } from '@/components/orbit/app-text';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { radius, space, typography } from '@/constants/orbit-theme';
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
  const { c, glass, glassBorder } = useOrbitColors();

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
    <BottomSheet visible={visible} onDismiss={onClose} heightRatio={0.7}>
      <View style={styles.body}>
        <Text style={[typography.caption1, { color: c.textMuted, textAlign: 'center' }]}>
          Invite
        </Text>
        <Text style={[typography.title2, { color: c.text, textAlign: 'center', marginTop: 4 }]}>
          {member.name}
        </Text>

        {displayLink ? (
          <View
            style={[
              styles.qrWrap,
              {
                backgroundColor: '#FFFFFF',
                borderColor: glassBorder(0.08),
                shadowColor: '#000',
              },
            ]}>
            <QRCode value={displayLink} size={168} backgroundColor="#FFFFFF" color="#0F1C2A" />
          </View>
        ) : (
          <View style={[styles.qrPlaceholder, { backgroundColor: glass(0.05) }]} />
        )}

        <Text
          style={[
            typography.body,
            { color: c.textMuted, textAlign: 'center', lineHeight: 22, paddingHorizontal: space.sm },
          ]}>
          Scan this on {member.name}&apos;s device to add them to the household.
        </Text>

        <Pressable
          onPress={() => void share()}
          style={[styles.primary, { backgroundColor: c.primary }]}>
          <Text style={[typography.headline, { color: c.ink, fontWeight: '700' }]}>
            Share invite link
          </Text>
        </Pressable>

        <Pressable onPress={regenerate} hitSlop={10} style={styles.secondary}>
          <Text style={[typography.subheadline, { color: c.textSoft, fontWeight: '600' }]}>
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
            style={[styles.copyRow, { backgroundColor: glass(0.04) }]}
            hitSlop={6}>
            <MaterialIcons name="link" size={15} color={c.textSubtle} />
            <Text
              style={[typography.caption1, { color: c.textSubtle, flex: 1 }]}
              numberOfLines={1}>
              {displayLink}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'stretch',
    gap: space.md,
    paddingBottom: space.sm,
    paddingHorizontal: space.xs,
  },
  qrWrap: {
    alignSelf: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: space.sm,
    padding: space.lg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  qrPlaceholder: {
    alignSelf: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    height: 200,
    marginVertical: space.sm,
    width: 200,
  },
  primary: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    marginTop: space.xs,
    paddingVertical: 15,
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: space.xs,
  },
  copyRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.control,
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
});
