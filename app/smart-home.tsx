import { useEffect } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function SmartHomeScreen() {
  const {
    activateSmartScene,
    refreshSmartHome,
    smartHomeDevices,
    smartHomeScenes,
    toggleSmartDevice,
  } = useOrbit();

  useEffect(() => {
    void refreshSmartHome();
  }, [refreshSmartHome]);

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Connected home</Text>
        <Text style={orbitTypography.display}>Smart home</Text>
        <Text style={orbitTypography.body}>Toggle devices and run household scenes.</Text>
      </View>

      <GlassCard style={styles.card}>
        <Text style={orbitTypography.cardTitle}>Scenes</Text>
        {smartHomeScenes.length === 0 ? (
          <Text style={orbitTypography.caption}>No scenes configured yet.</Text>
        ) : (
          smartHomeScenes.map((scene) => (
            <View key={scene.id} style={styles.sceneRow}>
              <View style={styles.sceneCopy}>
                <Text style={styles.deviceName}>{scene.name}</Text>
                <Text style={orbitTypography.caption}>{scene.description || 'Household scene'}</Text>
              </View>
              <OrbitButton style={styles.compactButton} onPress={() => activateSmartScene(scene.id)}>
                Run
              </OrbitButton>
            </View>
          ))
        )}
      </GlassCard>

      <Text style={orbitTypography.title}>Devices</Text>
      {smartHomeDevices.length === 0 ? (
        <GlassCard>
          <Text style={orbitTypography.caption}>No devices linked for this household.</Text>
        </GlassCard>
      ) : (
        smartHomeDevices.map((device) => (
          <GlassCard key={device.id} style={styles.card}>
            <View style={orbitScreen.row}>
              <StatusPill label={device.isOnline ? 'Online' : 'Offline'} tone={device.isOnline ? 'green' : 'amber'} />
              <StatusPill label={device.isOn ? 'On' : 'Off'} tone={device.isOn ? 'cyan' : 'blue'} />
            </View>
            <Text style={styles.deviceName}>{device.name}</Text>
            <Text style={orbitTypography.caption}>
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
    gap: orbitSpacing.md,
  },
  compactButton: {
    minHeight: 44,
    paddingHorizontal: orbitSpacing.md,
    paddingVertical: orbitSpacing.sm,
  },
  deviceName: {
    color: orbitColors.text,
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
    gap: orbitSpacing.md,
  },
});
