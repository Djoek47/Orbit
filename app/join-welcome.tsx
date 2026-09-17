import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function JoinWelcomeScreen() {
  const { currentMember, currentUser, household, isGuestInActiveHousehold } = useOrbit();
  const { c } = useOrbitColors();
  const preassigned = useMemo(
    () =>
      household.tasks.filter(
        (task) =>
          task.assignee === currentMember?.name
      ),
    [household.tasks, currentMember?.id, currentMember?.name]
  );

  return (
    <AuthShell
      kicker="You're in"
      title={`Welcome${currentUser?.name ? `, ${currentUser.name.split(' ')[0]}` : ''}`}
      subtitle={
        isGuestInActiveHousehold
          ? `You're visiting ${household.householdName} as a guest. Your own household stays separate — switch anytime in Settings.`
          : `${household.householdName} is ready.`
      }>
      <View style={{ gap: space.lg }}>
        {preassigned.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={[typography.headline, { color: c.text }]}>Already assigned to you</Text>
            {preassigned.map((task) => (
              <Text key={task.id} style={{ color: c.textMuted }}>
                • {task.title}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={{ color: c.textMuted, lineHeight: 22 }}>
            Head to Tasks to see what needs doing, or add homework and calendar items from your tabs.
          </Text>
        )}
        <OrbitButton onPress={() => router.replace('/(tabs)/tasks' as never)}>
          Continue to Tasks
        </OrbitButton>
      </View>
    </AuthShell>
  );
}
