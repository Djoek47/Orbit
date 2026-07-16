import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { orbitColors } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function WelcomeScreen() {
  const { accentTheme, currentUser, hasHousehold, isLoading, isSignedIn } = useOrbit();

  if (!isLoading && isSignedIn && currentUser?.profileComplete && hasHousehold) {
    return <Redirect href="/" />;
  }

  return (
    <AuthShell
      brandHero
      title="A calmer command center for home"
      subtitle="Tasks, groceries, Plan, ranks, and Nova — one shared household rhythm. Have an invite QR? Sign in and your code carries through to Join."
      footer={
        <View style={styles.footer}>
          <Pressable onPress={() => router.push('/sign-in' as never)} style={styles.ctaWrap}>
            <LinearGradient
              colors={[accentTheme.primary, accentTheme.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}>
              <Text style={styles.ctaText}>Sign in</Text>
              <MaterialIcons name="arrow-forward" size={18} color="#070D1C" />
            </LinearGradient>
          </Pressable>
          <Pressable onPress={() => router.push('/sign-up' as never)} style={styles.secondary}>
            <Text style={[styles.secondaryText, { color: accentTheme.primary }]}>Create account</Text>
          </Pressable>
        </View>
      }>
      <View style={styles.points}>
        {[
          { emoji: '✅', label: 'Shared tasks & homework' },
          { emoji: '🛒', label: 'Grocery intelligence' },
          { emoji: '✨', label: 'Nova, your household co-manager' },
        ].map((item) => (
          <View key={item.label} style={styles.pointRow}>
            <Text style={styles.pointEmoji}>{item.emoji}</Text>
            <Text style={styles.pointText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  points: { gap: 12 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointEmoji: { fontSize: 18 },
  pointText: { color: orbitColors.textSoft, fontSize: 14, fontWeight: '600', flex: 1 },
  footer: { gap: 10 },
  ctaWrap: { borderRadius: 18, overflow: 'hidden' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  ctaText: { color: '#070D1C', fontSize: 15, fontWeight: '800' },
  secondary: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 15,
  },
  secondaryText: { fontSize: 15, fontWeight: '800' },
});
