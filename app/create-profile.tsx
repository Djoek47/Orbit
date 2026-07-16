import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { AVATAR_EMOJIS } from '@/constants/accent-themes';
import { orbitColors } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function CreateProfileScreen() {
  const { accentTheme, createProfile, currentUser, isSignedIn } = useOrbit();
  const [name, setName] = useState(currentUser?.name || 'Jordan');
  const [avatar, setAvatar] = useState(currentUser?.avatar && currentUser.avatar.length > 1 ? currentUser.avatar : '🌟');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isSignedIn) {
    return <Redirect href={'/welcome' as never} />;
  }

  const handleCreateProfile = async () => {
    if (!name.trim()) {
      setError('Add your name to finish the profile.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      await createProfile({ name: name.trim(), avatar });
      router.replace('/household-setup' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      kicker="Personal setup"
      title="Create profile"
      subtitle="This name and avatar become your identity inside the household.">
      <View style={styles.preview}>
        <View style={[styles.avatarPreview, { backgroundColor: `${accentTheme.primary}22`, borderColor: `${accentTheme.primary}55` }]}>
          <Text style={styles.avatarEmoji}>{avatar}</Text>
        </View>
        <Text style={styles.previewName}>{name.trim() || 'Your name'}</Text>
      </View>

      <OrbitInput label="Display name" value={name} onChangeText={setName} placeholder="e.g. Jordan" />

      <Text style={styles.label}>Avatar</Text>
      <View style={styles.emojiGrid}>
        {AVATAR_EMOJIS.map((emoji) => {
          const active = avatar === emoji;
          return (
            <Pressable
              key={emoji}
              onPress={() => setAvatar(emoji)}
              style={[
                styles.emojiChip,
                active && {
                  borderColor: `${accentTheme.primary}88`,
                  backgroundColor: `${accentTheme.primary}22`,
                },
              ]}>
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={() => void handleCreateProfile()} disabled={busy} style={styles.ctaWrap}>
        <LinearGradient
          colors={[accentTheme.primary, accentTheme.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cta}>
          <Text style={styles.ctaText}>{busy ? 'Saving…' : 'Continue'}</Text>
        </LinearGradient>
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', gap: 8, marginBottom: 4 },
  avatarPreview: {
    width: 72,
    height: 72,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarEmoji: { fontSize: 34 },
  previewName: { color: orbitColors.text, fontSize: 16, fontWeight: '700' },
  label: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emoji: { fontSize: 22 },
  error: { color: orbitColors.danger, fontSize: 13, fontWeight: '700' },
  ctaWrap: { borderRadius: 18, overflow: 'hidden', marginTop: 4 },
  cta: { alignItems: 'center', paddingVertical: 15 },
  ctaText: { color: '#070D1C', fontSize: 15, fontWeight: '800' },
});
