/**
 * Shared QR + code block for Sidekick profile invites and shared-device handoff.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText as Text } from '@/components/orbit/app-text';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import { radius, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  /** Deep / web link encoded in the QR. */
  qrValue: string;
  /** Human-readable code shown under the QR (optional for shared-device links). */
  displayCode?: string | null;
  caption?: string;
  onShare?: () => void | Promise<void>;
  shareLabel?: string;
  onRegenerate?: () => void | Promise<void>;
  regenerateLabel?: string;
  regenerating?: boolean;
};

export function ProfileQrCard({
  qrValue,
  displayCode,
  caption,
  onShare,
  shareLabel = 'AirDrop / Share invite',
  onRegenerate,
  regenerateLabel = 'Generate new QR',
  regenerating = false,
}: Props) {
  const { c, glass, glassBorder } = useOrbitColors();

  return (
    <View style={styles.body}>
      <View
        style={[
          styles.qrWrap,
          {
            backgroundColor: '#FFFFFF',
            borderColor: glassBorder(0.08),
            shadowColor: '#000',
          },
        ]}>
        <QRCode value={qrValue} size={168} backgroundColor="#FFFFFF" color="#0F1C2A" />
      </View>

      {displayCode ? (
        <Text selectable style={[typography.headline, { color: c.text, textAlign: 'center' }]}>
          {displayCode}
        </Text>
      ) : null}

      {caption ? (
        <Text
          style={[
            typography.body,
            { color: c.textMuted, textAlign: 'center', lineHeight: 22, paddingHorizontal: space.sm },
          ]}>
          {caption}
        </Text>
      ) : null}

      {onShare ? (
        <Pressable
          onPress={() => void onShare()}
          style={[styles.primary, { backgroundColor: c.primary }]}
          accessibilityRole="button">
          <Text style={[typography.headline, { color: c.ink, fontWeight: '700' }]}>
            {shareLabel}
          </Text>
        </Pressable>
      ) : null}

      {displayCode ? (
        <Pressable
          onPress={() => {
            void Clipboard.setStringAsync(displayCode);
            orbitAlert('Copied', 'Invite code copied.');
          }}
          style={[styles.copyRow, { backgroundColor: glass(0.04) }]}
          hitSlop={6}
          accessibilityRole="button">
          <MaterialIcons name="content-copy" size={15} color={c.textSubtle} />
          <Text style={[typography.caption1, { color: c.textSubtle }]}>Copy code</Text>
        </Pressable>
      ) : null}

      {onRegenerate ? (
        <Pressable
          onPress={() => void onRegenerate()}
          disabled={regenerating}
          style={[
            styles.regen,
            {
              backgroundColor: glass(0.05),
              borderColor: glassBorder(0.12),
              opacity: regenerating ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={regenerateLabel}>
          {regenerating ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <>
              <MaterialIcons name="qr-code-2" size={18} color={c.primary} />
              <Text style={[typography.footnote, { color: c.primary, fontWeight: '700' }]}>
                {regenerateLabel}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'stretch',
    gap: space.md,
  },
  qrWrap: {
    alignSelf: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: space.sm,
    padding: space.lg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  primary: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    marginTop: space.xs,
    paddingVertical: 15,
  },
  copyRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.control,
    flexDirection: 'row',
    gap: space.xs,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  regen: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 13,
  },
});
