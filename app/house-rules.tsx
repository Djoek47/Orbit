/**
 * House Rules — adult + kid views from the live registry (Revision D §4).
 * Custom rules are display-only and must not alter app mechanics.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { VOCAB } from '@/constants/vocabulary';
import { space, typography } from '@/constants/orbit-theme';
import {
  rulesFor,
  validateCustomHouseRule,
  type CustomHouseRule,
} from '@/lib/rules/registry';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function HouseRulesScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const { household, currentMember, permissions } = useOrbit();
  const [voice, setVoice] = useState<'adult' | 'kid'>(
    currentMember?.role === 'child' ? 'kid' : 'adult'
  );
  const [custom, setCustom] = useState<CustomHouseRule[]>([]);
  const [draft, setDraft] = useState('');

  const entries = useMemo(
    () =>
      rulesFor(
        {
          rewardModel: household.rewardModel ?? 'full',
          rewardMode: household.rewardMode === 'flat' ? 'equity' : 'meritocracy',
          defaultDeadlineLabel: '7:00 PM',
        },
        {
          id: currentMember?.id ?? 'self',
          homeworkProofRequired: true,
        },
        voice
      ),
    [household, currentMember, voice]
  );

  const addCustom = () => {
    const result = validateCustomHouseRule(draft, custom.length);
    if (!result.ok) {
      Alert.alert(VOCAB.houseRules, result.message);
      return;
    }
    // Display-only — must not alter any app mechanic (Revision D §4.4.b).
    setCustom((prev) => [
      ...prev,
      { id: `custom_${Date.now()}`, body: result.body, sortOrder: prev.length },
    ]);
    setDraft('');
  };

  return (
    <View style={[styles.shell, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.subheadline, { color: c.accent }]}>‹ Settings</Text>
        </Pressable>
        <Text style={[typography.title3, { color: c.text }]}>{VOCAB.houseRules}</Text>
        <View style={{ width: 64 }} />
      </View>

      {permissions.canManageHousehold ? (
        <View style={[styles.toggle, { backgroundColor: glass(0.06) }]}>
          {(['adult', 'kid'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setVoice(v)}
              style={[
                styles.toggleBtn,
                voice === v && { backgroundColor: `${c.accent}28` },
              ]}
            >
              <Text
                style={[
                  typography.footnote,
                  { color: voice === v ? c.accent : c.textSubtle, fontWeight: voice === v ? '700' : '500' },
                ]}
              >
                {v === 'adult' ? 'Adult' : 'Kid'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {voice === 'kid' ? (
        // HARD CONSTRAINT: one screen, no scroll at default text on 390pt.
        <View style={[styles.kidCard, { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) }]}>
          <Text style={[typography.caption1, { color: c.textMuted }]}>HOW IT WORKS</Text>
          {custom.length ? (
            <View style={{ gap: 6 }}>
              <Text style={[typography.caption1, { color: c.textMuted }]}>Our {VOCAB.houseRules}</Text>
              {custom.map((r) => (
                <Text key={r.id} style={[typography.body, { color: c.text }]}>
                  {r.body}
                </Text>
              ))}
            </View>
          ) : null}
          {entries.map((r) => (
            <Text key={r.id} style={[typography.body, { color: c.text }]}>
              {r.text}
            </Text>
          ))}
        </View>
      ) : (
        <PersistentScrollView contentContainerStyle={styles.content}>
          {custom.length ? (
            <View style={styles.section}>
              <Text style={[typography.caption1, { color: c.textMuted }]}>Our {VOCAB.houseRules}</Text>
              {custom.map((r) => (
                <Text key={r.id} style={[typography.body, { color: c.text }]}>
                  {r.body}
                </Text>
              ))}
            </View>
          ) : null}
          {entries.map((r) => (
            <View key={r.id} style={styles.section}>
              <Text style={[typography.caption2, { color: c.textSubtle }]}>{r.section}</Text>
              <Text style={[typography.body, { color: c.text }]}>{r.text}</Text>
            </View>
          ))}

          {permissions.canManageHousehold ? (
            <View style={styles.section}>
              <Text style={[typography.caption1, { color: c.textMuted }]}>Add a house rule</Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Screens off at 8:30"
                placeholderTextColor={c.textSubtle}
                maxLength={500}
                style={[
                  styles.input,
                  { color: c.text, borderColor: glassBorder(0.12), backgroundColor: glass(0.04) },
                ]}
              />
              <Pressable onPress={addCustom}>
                <Text style={[typography.subheadline, { color: c.accent, fontWeight: '700' }]}>Save rule</Text>
              </Pressable>
            </View>
          ) : null}
        </PersistentScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  toggle: {
    borderRadius: 12,
    flexDirection: 'row',
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    padding: 4,
  },
  toggleBtn: {
    borderRadius: 10,
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  content: {
    gap: space.md,
    paddingBottom: 40,
    paddingHorizontal: space.lg,
  },
  section: { gap: 4 },
  kidCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: space.sm,
    marginHorizontal: space.lg,
    padding: space.lg,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
