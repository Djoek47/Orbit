import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitColors, radius, space, typography } from '@/constants/orbit-theme';

type ProductBarcodeScannerProps = {
  onCode: (barcode: string) => void;
  onClose: () => void;
};

const PRODUCT_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'qr',
] as const;

export function ProductBarcodeScanner({ onCode, onClose }: ProductBarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return (
      <View style={styles.wrap}>
        <Text style={typography.body}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.wrap}>
        <Text style={typography.body}>Camera access is needed to scan product barcodes.</Text>
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
        barcodeScannerSettings={{ barcodeTypes: [...PRODUCT_TYPES] }}
        onBarcodeScanned={({ data }) => {
          if (scanned || !data?.trim()) {
            return;
          }
          setScanned(true);
          onCode(data.trim());
        }}
      />
      <View style={styles.overlay}>
        <Text style={styles.hint}>Align the product barcode inside the frame</Text>
        <Pressable onPress={onClose} style={styles.close}>
          <Text style={styles.closeText}>Close scanner</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    borderRadius: radius.cardLarge,
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
  },
  close: {
    alignSelf: 'center',
    marginTop: space.md,
    padding: space.sm,
  },
  closeText: {
    color: orbitColors.orbitBlue,
    fontWeight: '700',
  },
  hint: {
    color: orbitColors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  overlay: {
    marginTop: space.md,
  },
  wrap: {
    gap: space.md,
    minHeight: 320,
  },
});
