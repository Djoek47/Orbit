/**
 * Sidekick / profile invite sheet — thin wrapper around ProfileQrCard.
 */
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { ProfileQrCard } from '@/components/orbit/members/profile-qr-card';
import { space, typography } from '@/constants/orbit-theme';
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
  onRegenerate?: () => void | Promise<void>;
  regenerating?: boolean;
};

export function ProfileInviteSheet({
  visible,
  member,
  householdName,
  onClose,
  onRegenerate,
  regenerating,
}: Props) {
  const { c } = useOrbitColors();

  if (!member) return null;

  const code = ensureProfileInviteCode(member);
  const links = buildInviteLinks(code);

  return (
    <BottomSheet visible={visible} onDismiss={onClose} heightRatio={0.72} scrollable>
      <View style={styles.body}>
        <Text style={[typography.caption1, { color: c.textMuted, textAlign: 'center' }]}>
          Sidekick invite · no email needed
        </Text>
        <Text style={[typography.title2, { color: c.text, textAlign: 'center', marginTop: 4 }]}>
          {member.name}
        </Text>
        <ProfileQrCard
          qrValue={links.webLink}
          displayCode={links.code}
          caption={`Scan or AirDrop this to ${member.name}'s phone. They open Get Started → Sidekick — no sign-in.`}
          onShare={async () => {
            await shareInvite({
              householdName,
              inviteCode: links.code,
              deepLink: links.deepLink,
              webLink: links.webLink,
              kind: 'kid',
              childName: member.name,
            });
          }}
          onRegenerate={onRegenerate}
          regenerating={regenerating}
        />
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
});
