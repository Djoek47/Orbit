import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitColors, radius, space, typography } from '@/constants/orbit-theme';
import { parseInvitePayload } from '@/lib/invites/parse-invite';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text } from '@/components/orbit/app-text';

type InviteQrScannerProps = {
  visible: boolean;
  onClose: () => void;
  onScanned: (inviteCode: string) => void;
};

export function InviteQrScanner({ visible, onClose, onScanned }: InviteQrScannerProps) {
  const insets = useSafeAreaInsets();
  const { c } = useOrbitColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [hint, setHint] = useState('Align the invite QR in the frame');

  useEffect(() => {
    if (!visible) {
      setLocked(false);
      setHint('Align the invite QR in the frame');
    }
  }, [visible]);

  const handleBarcode = ({ data }: { data: string }) => {
    if (locked) return;
    const code = parseInvitePayload(data);
    if (!code) {
      setHint('That QR is not a Choremaxx invite — try again');
      return;
    }
    setLocked(true);
    setHint(`Found ${code}`);
    onScanned(code);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16, backgroundColor: c.background },
        ]}>
        <View style={styles.header}>
          <View>
            <Text style={[typography.body, { color: c.text }]}>Join household</Text>
            <Text style={[typography.body, { color: c.text }]}>Scan invite QR</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeChip}>
            <Text style={[styles.closeLabel, { color: c.textMuted }]}>Close</Text>
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.centered}>
            <Text style={[typography.body, { color: c.text }]}>Checking camera permission…</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.centered}>
            <Text style={[typography.body, { color: c.text }]}>
              Camera access is needed to scan household invite QR codes.
            </Text>
            <OrbitButton onPress={() => requestPermission()}>Allow camera</OrbitButton>
            <OrbitButton tone="secondary" onPress={onClose}>
              Enter code instead
            </OrbitButton>
          </View>
        ) : (
          <>
            <View style={styles.cameraShell}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={locked ? undefined : handleBarcode}
              />
              <View style={styles.frame} pointerEvents="none" />
            </View>
            <Text style={[styles.hint, { color: c.textMuted }]}>{hint}</Text>
            <OrbitButton tone="secondary" onPress={onClose}>
              Enter code manually
            </OrbitButton>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cameraShell: {
    backgroundColor: '#000',
    borderColor: orbitColors.border,
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: 1,
    flex: 1,
    marginBottom: space.md,
    minHeight: 360,
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    gap: space.md,
    justifyContent: 'center',
  },
  closeChip: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  frame: {
    borderColor: orbitColors.primary,
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 2,
    bottom: '22%',
    left: '12%',
    position: 'absolute',
    right: '12%',
    top: '22%',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  hint: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: space.md,
    textAlign: 'center',
  },
  root: {
    flex: 1,
    paddingHorizontal: space.xl,
  },
});
