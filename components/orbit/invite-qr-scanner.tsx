import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitColors, orbitRadius, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { parseInvitePayload } from '@/lib/invites/parse-invite';

type InviteQrScannerProps = {
  visible: boolean;
  onClose: () => void;
  onScanned: (inviteCode: string) => void;
};

export function InviteQrScanner({ visible, onClose, onScanned }: InviteQrScannerProps) {
  const insets = useSafeAreaInsets();
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
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <View>
            <Text style={orbitTypography.caption}>Join household</Text>
            <Text style={orbitTypography.title}>Scan invite QR</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeChip}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.centered}>
            <Text style={orbitTypography.caption}>Checking camera permission…</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.centered}>
            <Text style={orbitTypography.body}>
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
            <Text style={styles.hint}>{hint}</Text>
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
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    flex: 1,
    marginBottom: orbitSpacing.md,
    minHeight: 360,
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    gap: orbitSpacing.md,
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
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  frame: {
    borderColor: orbitColors.primary,
    borderCurve: 'continuous',
    borderRadius: orbitRadius.md,
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
    marginBottom: orbitSpacing.md,
  },
  hint: {
    color: orbitColors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: orbitSpacing.md,
    textAlign: 'center',
  },
  root: {
    backgroundColor: orbitColors.background,
    flex: 1,
    paddingHorizontal: orbitSpacing.lg,
  },
});
