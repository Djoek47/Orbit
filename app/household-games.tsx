import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { GAME_VIBE_LABEL, HOUSEHOLD_GAMES } from '@/data/household-games';
import { useOrbit } from '@/store/orbit-store';

const NEED_LABEL: Record<string, string> = {
  phone: 'Phone',
  camera: 'Camera',
  speakers: 'Speakers',
  cards: 'Cards',
  cups: 'Cups',
  none: 'Nothing',
};

export default function HouseholdGamesScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, orbitPalette } = useOrbit();

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, backgroundColor: orbitPalette.backgroundSoft },
      ]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.handle} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="close" size={18} color={orbitPalette.textMuted} />
        </Pressable>
        <View style={styles.headerCopy}>
          <ChoremaxxBadge />
          <Text style={[styles.title, { color: orbitPalette.text }]}>Household Games</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.lead, { color: orbitPalette.textSoft }]}>
          Roomate nights, family Uno, guessing games — playable packs land later. Browse what is coming.
        </Text>

        {HOUSEHOLD_GAMES.map((game) => (
          <View key={game.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.emoji}>{game.emoji}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.cardTitle, { color: orbitPalette.text }]}>{game.title}</Text>
                <Text style={[styles.vibe, { color: accentTheme.primary }]}>
                  {GAME_VIBE_LABEL[game.vibe]}
                </Text>
              </View>
              <View style={[styles.soonPill, { backgroundColor: `${accentTheme.primary}22` }]}>
                <Text style={[styles.soonText, { color: accentTheme.primary }]}>Soon</Text>
              </View>
            </View>
            <Text style={[styles.blurb, { color: orbitPalette.textMuted }]}>{game.blurb}</Text>
            <View style={styles.needs}>
              {game.needs.map((need) => (
                <View key={need} style={styles.needChip}>
                  <Text style={[styles.needText, { color: orbitPalette.textSubtle }]}>
                    {NEED_LABEL[need] ?? need}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  handle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    height: 4,
    marginBottom: 4,
    marginTop: 8,
    width: 40,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerCopy: { alignItems: 'center', flex: 1, gap: 6 },
  title: { fontSize: 18, fontWeight: '800' },
  content: { gap: 12, padding: 16 },
  lead: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  emoji: { fontSize: 28 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  vibe: { fontSize: 12, fontWeight: '700' },
  soonPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  soonText: { fontSize: 11, fontWeight: '800' },
  blurb: { fontSize: 13, lineHeight: 18 },
  needs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  needChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  needText: { fontSize: 11, fontWeight: '700' },
});
