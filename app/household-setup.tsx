import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { orbitColors } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function HouseholdSetupScreen() {
  const { accentTheme, currentUser, hasHousehold, isSignedIn } = useOrbit();

  if (!isSignedIn) {
    return <Redirect href={'/welcome' as never} />;
  }

  if (!currentUser?.profileComplete) {
    return <Redirect href={'/create-profile' as never} />;
  }

  if (hasHousehold) {
    return <Redirect href={'/' as never} />;
  }

  return (
    <AuthShell
      kicker="Household setup"
      title="Create or join"
      subtitle="Orbit needs one household before tasks, groceries, and rewards can sync.">
      <Pressable onPress={() => router.push('/create-household' as never)} style={styles.pathCard}>
        <LinearGradient
          colors={[`${accentTheme.primary}33`, `${accentTheme.secondary}14`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pathIcon}>
          <MaterialIcons name="home" size={22} color={accentTheme.primary} />
        </LinearGradient>
        <View style={styles.pathCopy}>
          <Text style={[styles.pathEyebrow, { color: accentTheme.primary }]}>Owner path</Text>
          <Text style={styles.pathTitle}>Create a new household</Text>
          <Text style={styles.pathBody}>Start a home, become owner, then invite members when you are ready.</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={orbitColors.textSubtle} />
      </Pressable>

      <Pressable onPress={() => router.push('/join-household' as never)} style={styles.pathCard}>
        <View style={[styles.pathIcon, styles.pathIconMuted]}>
          <MaterialIcons name="qr-code-2" size={22} color={orbitColors.novaCyan} />
        </View>
        <View style={styles.pathCopy}>
          <Text style={[styles.pathEyebrow, { color: orbitColors.novaCyan }]}>Member path</Text>
          <Text style={styles.pathTitle}>Join with an invite</Text>
          <Text style={styles.pathBody}>Scan a QR or enter a code, then wait for owner approval.</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={orbitColors.textSubtle} />
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  pathCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 14,
  },
  pathIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathIconMuted: {
    backgroundColor: 'rgba(6,182,212,0.12)',
  },
  pathCopy: { flex: 1, gap: 3 },
  pathEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  pathTitle: { color: orbitColors.text, fontSize: 15, fontWeight: '700' },
  pathBody: { color: orbitColors.textMuted, fontSize: 12, lineHeight: 17 },
});
