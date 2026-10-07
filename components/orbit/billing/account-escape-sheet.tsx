/**
 * The only settings an unpaid household can reach.
 *
 * The paywall cannot be dismissed into the app once it is the gate, but it must never be a
 * room with no door. Apple requires that anyone who can create an account can delete it from
 * inside the app (guideline 5.1.1(v)), and a person who decides not to pay is exactly the
 * person most likely to want to. So the gate keeps one link — Account — and it opens this.
 *
 * Everything here routes to screens outside the tab navigator, which is where the gate sits,
 * so none of them is itself locked.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Row = {
  key: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  hint?: string;
  danger?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onRestore: () => void;
  onSignOut: () => void;
  /** Only the owner can hand the household on or delete it. */
  isOwner: boolean;
};

export function AccountEscapeSheet({ visible, onClose, onRestore, onSignOut, isOwner }: Props) {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();

  const go = (href: string) => {
    onClose();
    // Let the sheet finish closing before the push, or the new screen opens under it.
    setTimeout(() => router.push(href as never), 220);
  };

  const rows: Row[] = [
    {
      key: 'restore',
      icon: 'restore',
      label: 'Restore purchases',
      hint: 'Already subscribed on this Apple ID',
      onPress: () => {
        onClose();
        onRestore();
      },
    },
    { key: 'support', icon: 'support-agent', label: 'Get help', onPress: () => go('/support') },
    {
      key: 'terms',
      icon: 'description',
      label: 'Terms of Use',
      onPress: () => void Linking.openURL(CHOREMAXX_LEGAL.termsUrl),
    },
    {
      key: 'privacy',
      icon: 'privacy-tip',
      label: 'Privacy Policy',
      onPress: () => void Linking.openURL(CHOREMAXX_LEGAL.privacyUrl),
    },
    ...(isOwner
      ? ([
          {
            key: 'transfer',
            icon: 'swap-horiz',
            label: 'Transfer the household',
            hint: 'Hand it to someone else to run',
            onPress: () => go('/transfer-household'),
          },
          {
            key: 'delete-household',
            icon: 'home-work',
            label: 'Delete the household',
            danger: true,
            onPress: () => go('/delete-household'),
          },
        ] as Row[])
      : []),
    {
      key: 'delete-account',
      icon: 'person-remove',
      label: 'Delete my account',
      danger: true,
      onPress: () => go('/delete-account'),
    },
    {
      key: 'sign-out',
      icon: 'logout',
      label: 'Sign out',
      onPress: () => {
        onClose();
        onSignOut();
      },
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: c.background,
            borderColor: glassBorder(0.12),
            paddingBottom: insets.bottom + 16,
          },
        ]}>
        <View style={[styles.grabber, { backgroundColor: glassBorder(0.3) }]} />
        <Text style={[styles.title, { color: c.text }]}>Account</Text>
        <ScrollView contentContainerStyle={styles.list} bounces={false}>
          {rows.map((row) => (
            <Pressable
              key={row.key}
              onPress={row.onPress}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: glass(pressed ? 0.08 : 0.04), borderColor: glassBorder(0.08) },
              ]}>
              <MaterialIcons
                name={row.icon}
                size={20}
                color={row.danger ? c.danger : c.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: row.danger ? c.danger : c.text }]}>
                  {row.label}
                </Text>
                {row.hint ? (
                  <Text style={[styles.hint, { color: c.textSubtle }]}>{row.hint}</Text>
                ) : null}
              </View>
              <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    alignSelf: 'center',
    borderCurve: 'continuous',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    bottom: 0,
    gap: 12,
    maxHeight: '80%',
    // Centred and capped on iPad, rather than a full-width slab across the glass.
    maxWidth: 560,
    paddingHorizontal: 16,
    paddingTop: 10,
    position: 'absolute',
    width: '100%',
  },
  grabber: { alignSelf: 'center', borderRadius: 3, height: 5, width: 40 },
  title: { fontSize: 20, fontWeight: '800', paddingHorizontal: 4 },
  list: { gap: 8 },
  row: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  label: { fontSize: 15.5, fontWeight: '700' },
  hint: { fontSize: 12.5, marginTop: 1 },
});
