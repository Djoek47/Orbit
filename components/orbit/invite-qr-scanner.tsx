import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OrbitButton } from '@/components/orbit/orbit-button';
import { parseInviteCodeFromUrl } from '@/lib/invite/deep-links';
import { orbitColors, orbitRadius, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';

type InviteQrScannerProps = {
  onCode: (code: string) => void;
  onClose: () => void;
};

export function InviteQrScanner({ onCode, onClose }: InviteQrScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return (
      <View style={styles.wrap}>
        <Text style={orbitTypography.body}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.wrap}>
        <Text style={orbitTypography.body}>Camera access is needed to scan household invite QR codes.</Text>
        <OrbitButton onPress={() => requestPermission()}>Allow camera</OrbitButton>
        <OrbitButton tone="secondary" onPress={onClose}>
          Cancel
        </OrbitButton>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (scanned) {
            return;
          }
          const code = parseInviteCodeFromUrl(data) ?? data.trim().toUpperCase();
          if (!code) {
            return;
          }
          setScanned(true);
          onCode(code);
        }}
      />
      <View style={styles.overlay}>
        <Text style={styles.hint}>Align the invite QR inside the frame</Text>
        <Pressable onPress={onClose} style={styles.close}>
          <Text style={styles.closeText}>Close scanner</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    borderRadius: orbitRadius.lg,
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
  },
  close: {
    alignSelf: 'center',
    marginTop: orbitSpacing.md,
    padding: orbitSpacing.sm,
  },
  closeText: {
    color: orbitColors.novaCyan,
    fontWeight: '700',
  },
  hint: {
    color: orbitColors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  overlay: {
    gap: orbitSpacing.sm,
    marginTop: orbitSpacing.md,
  },
  wrap: {
    gap: orbitSpacing.md,
  },
});
