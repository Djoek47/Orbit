import { Pressable, StyleSheet, View } from 'react-native';

import { HouseholdSwitcher } from '@/components/orbit/household-switcher';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { AppText as Text } from '@/components/orbit/app-text';
import { space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function HouseholdSwitchSheet({ visible, onClose }: Props) {
  const { c } = useOrbitColors();
  const { accentTheme } = useOrbit();

  return (
    <BottomSheet visible={visible} onDismiss={onClose} heightRatio={0.52} accentColor={accentTheme.primary}>
      <View style={styles.body}>
        <Text style={[typography.title3, { color: c.text, textAlign: 'center', fontWeight: '700' }]}>
          Switch household
        </Text>
        <Text style={[typography.footnote, { color: c.textMuted, textAlign: 'center', marginBottom: space.sm }]}>
          You&apos;re signed in to more than one household. Pick which one to open.
        </Text>
        <HouseholdSwitcher onSwitched={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space.md,
    paddingHorizontal: space.xs,
  },
});
