import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { LEGACY_HOUSEHOLD_INVITE_MESSAGE } from '@/lib/invites/invite-intent';
import { normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export default function InviteUnsupportedScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { c } = useOrbitColors();
  const raw = Array.isArray(params.code) ? params.code[0] : params.code;
  const code =
    parseInvitePayload(raw ?? '') ?? (raw?.trim() ? normalizeInviteCode(raw) : null) ?? 'invite';

  return (
    <AuthShell
      showBack
      kicker="Invite"
      title="Personal invite needed"
      subtitle={LEGACY_HOUSEHOLD_INVITE_MESSAGE}>
      <View style={{ gap: 16 }}>
        {code ? (
          <Text style={{ color: c.textMuted, fontSize: 14, textAlign: 'center' }}>{code}</Text>
        ) : null}
        <OrbitButton onPress={() => router.replace('/welcome' as never)}>Back to Get Started</OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.replace('/welcome' as never)}>
          Scan another invite
        </OrbitButton>
      </View>
    </AuthShell>
  );
}
