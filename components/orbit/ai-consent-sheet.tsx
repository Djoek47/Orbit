/**
 * "Poppins uses OpenAI" — the permission App Review 5.1.2(i) requires before anything a person
 * says or types is sent to a third-party AI. Names the provider, says exactly what is sent and
 * why, and asks. Mounted once at the root; opens whenever something needs OpenAI without
 * permission (lib/ai/ai-consent.ts → requestAiConsent).
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
import {
  aiConsentState,
  loadAiConsent,
  onAiConsentRequested,
  setAiConsent,
} from '@/lib/ai/ai-consent';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';


export function AiConsentSheet() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { c, glassBorder } = useOrbitColors();
  const accent = useOrbitOptional()?.accentTheme.primary ?? '#D85A30';
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void loadAiConsent();
    return onAiConsentRequested(() => {
      if (aiConsentState() !== 'granted') {
        setError(null);
        setOpen(true);
      }
    });
  }, []);

  const answer = async (allowed: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await setAiConsent(allowed);
      setOpen(false);
    } catch {
      setError('Couldn’t save that. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => void answer(false)}>
      <View style={styles.scrim}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: c.background, borderColor: glassBorder(0.12), paddingBottom: insets.bottom + 18 },
          ]}
          accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.icon, { backgroundColor: `${accent}22` }]}>
              <MaterialIcons name="auto-awesome" size={26} color={accent} />
            </View>
            <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
              Poppins uses OpenAI
            </Text>
            <Text style={[styles.body, { color: c.textSoft }]}>
              What you say or type to Poppins is sent to OpenAI so it can answer you.
            </Text>
            <Pressable
              onPress={() => void Linking.openURL(CHOREMAXX_LEGAL.privacyUrl)}
              accessibilityRole="link"
              hitSlop={8}>
              <Text style={[styles.link, { color: accent }]}>Privacy policy</Text>
            </Pressable>
            {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
          </ScrollView>

          <Pressable
            disabled={busy}
            onPress={() => void answer(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, { backgroundColor: accent, opacity: pressed || busy ? 0.8 : 1 }]}>
            <Text style={styles.primaryText}>Allow</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => void answer(false)}
            accessibilityRole="button"
            style={styles.secondary}>
            <Text style={[styles.secondaryText, { color: c.textSoft }]}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: '92%',
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  content: { gap: 14, paddingBottom: 12 },
  icon: { alignItems: 'center', borderRadius: 18, height: 52, justifyContent: 'center', width: 52 },
  title: { fontSize: 24, fontWeight: '800' },
  body: { fontSize: 16, lineHeight: 23 },
  card: { borderRadius: 18, borderWidth: 1, gap: 10, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  rowText: { flex: 1, fontSize: 15, lineHeight: 21 },
  note: { fontSize: 13, lineHeight: 19 },
  link: { fontSize: 15, fontWeight: '700' },
  error: { fontSize: 14 },
  primary: { alignItems: 'center', borderRadius: 18, justifyContent: 'center', marginTop: 6, minHeight: 54 },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  secondary: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  secondaryText: { fontSize: 16, fontWeight: '600' },
});
