/**
 * Sidekick / profile invite sheet — QR + AirDrop for CMX-NAME codes.
 * No email, no token rotation — parent already created the profile.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText as Text } from '@/components/orbit/app-text';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { radius, space, typography } from '@/constants/orbit-theme';
import { ensureProfileInviteCode } from '@/lib/household/profile-codes';
import { buildInviteLinks } from '@/lib/invites/parse-invite';
import { shareInvite } from '@/lib/invites/share-invite';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';

type Props = {
  visible: boolean;
  member: HouseholdMember | null;
  householdName?: string;
  onClose: () => void;
};

export function ProfileInviteSheet({ visible, member, householdName, onClose }: Props) {
  const { c, glass, glassBorder } = useOrbitColors();

  if (!member) return null;

  const code = ensureProfileInviteCode(member);
  const links = buildInviteLinks(code);
  const displayLink = links.webLink;

  const share = async () => {
    await shareInvite({
      householdName,
      inviteCode: links.code,
      deepLink: links.deepLink,
      webLink: links.webLink,
      kind: 'kid',
      childName: member.name,
    });
  };

  return (
    <BottomSheet visible={visible} onDismiss={onClose} heightRatio={0.72}>
      <View style={styles.body}>
        <Text style={[typography.caption1, { color: c.textMuted, textAlign: 'center' }]}>
          Sidekick invite · no email needed
        </Text>
        <Text style={[typography.title2, { color: c.text, textAlign: 'center', marginTop: 4 }]}>
          {member.name}
        </Text>

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

        <Text selectable style={[typography.headline, { color: c.text, textAlign: 'center' }]}>
          {links.code}
        </Text>

        <Text
          style={[
            typography.body,
            { color: c.textMuted, textAlign: 'center', lineHeight: 22, paddingHorizontal: space.sm },
          ]}>
          Scan or AirDrop this to {member.name}&apos;s phone. They open Get Started → Sidekick — no
          sign-in.
        </Text>

        <Pressable
          onPress={() => void share()}
          style={[styles.primary, { backgroundColor: c.primary }]}>
          <Text style={[typography.headline, { color: c.ink, fontWeight: '700' }]}>
            AirDrop / Share invite
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            void Clipboard.setStringAsync(links.code);
            Alert.alert('Copied', 'Invite code copied.');
          }}
          style={[styles.copyRow, { backgroundColor: glass(0.04) }]}
          hitSlop={6}>
          <MaterialIcons name="content-copy" size={15} color={c.textSubtle} />
          <Text style={[typography.caption1, { color: c.textSubtle }]}>Copy code</Text>
        </Pressable>
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
  primary: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    marginTop: space.xs,
    paddingVertical: 15,
  },
  copyRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.control,
    flexDirection: 'row',
    gap: space.xs,
    justifyContent: 'center',
    marginTop: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
});
