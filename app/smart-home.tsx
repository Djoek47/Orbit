import { useEffect } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitScreen, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

export default function SmartHomeScreen() {
  const {
    activateSmartScene,
    refreshSmartHome,
    smartHomeDevices,
    smartHomeScenes,
    toggleSmartDevice,
  } = useOrbit();
  const { c } = useOrbitColors();

  useEffect(() => {
    void refreshSmartHome();
  }, [refreshSmartHome]);

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={typography.footnote}>Connected home</Text>
        <Text style={typography.title1}>Smart home</Text>
        <Text style={typography.body}>Toggle devices and run household scenes.</Text>
      </View>

      <GlassCard style={styles.card}>
        <Text style={typography.headline}>Scenes</Text>
        {smartHomeScenes.length === 0 ? (
          <Text style={typography.footnote}>No scenes configured yet.</Text>
        ) : (
          smartHomeScenes.map((scene) => (
            <View key={scene.id} style={styles.sceneRow}>
              <View style={styles.sceneCopy}>
                <Text style={[styles.deviceName, { color: c.text }]}>{scene.name}</Text>
                <Text style={typography.footnote}>{scene.description || 'Household scene'}</Text>
              </View>
              <OrbitButton style={styles.compactButton} onPress={() => activateSmartScene(scene.id)}>
                Run
              </OrbitButton>
            </View>
          ))
        )}
      </GlassCard>

      <Text style={typography.title2}>Devices</Text>
      {smartHomeDevices.length === 0 ? (
        <GlassCard>
          <Text style={typography.footnote}>No devices linked for this household.</Text>
        </GlassCard>
      ) : (
        smartHomeDevices.map((device) => (
          <GlassCard key={device.id} style={styles.card}>
            <View style={orbitScreen.row}>
              <StatusPill label={device.isOnline ? 'Online' : 'Offline'} tone={device.isOnline ? 'green' : 'amber'} />
              <StatusPill label={device.isOn ? 'On' : 'Off'} tone={device.isOn ? 'cyan' : 'blue'} />
            </View>
            <Text style={[styles.deviceName, { color: c.text }]}>{device.name}</Text>
            <Text style={typography.footnote}>
              {device.room || 'Home'} · {device.deviceType}
              {device.description ? ` · ${device.description}` : ''}
            </Text>
            <OrbitButton
              disabled={!device.isOnline}
              tone="secondary"
              onPress={() => toggleSmartDevice(device.id)}>
              {device.isOn ? 'Turn off' : 'Turn on'}
            </OrbitButton>
          </GlassCard>
        ))
      )}

      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Back
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
  },
  compactButton: {
    minHeight: 44,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '700',
  },
  sceneCopy: {
    flex: 1,
    gap: 4,
  },
  sceneRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
  },
});
