import { createLocalId, getConfiguredSupabase, isMockMode, mapDbError } from '@/repositories/repository-utils';
import type { SmartHomeDevice, SmartHomeScene } from '@/types/orbit';
import type { Json } from '@/types/database';

const mockDevices: SmartHomeDevice[] = [
  {
    id: 'device-1',
    householdId: 'hh-rivera',
    externalId: 'light-living',
    name: 'Living room lights',
    room: 'Living room',
    deviceType: 'light',
    description: 'Ceiling fixtures',
    isOnline: true,
    isOn: true,
    state: { on: true, brightness: 70 },
  },
  {
    id: 'device-2',
    householdId: 'hh-rivera',
    externalId: 'thermostat-main',
    name: 'Main thermostat',
    room: 'Hallway',
    deviceType: 'thermostat',
    description: 'Whole-home climate',
    isOnline: true,
    isOn: true,
    state: { on: true, temperature: 21 },
  },
];

const mockScenes: SmartHomeScene[] = [
  {
    id: 'scene-1',
    householdId: 'hh-rivera',
    name: 'Goodnight',
    description: 'Dim lights and lower temperature',
    actions: [
      { deviceExternalId: 'light-living', state: { on: false } },
      { deviceExternalId: 'thermostat-main', state: { temperature: 18 } },
    ],
  },
  {
    id: 'scene-2',
    householdId: 'hh-rivera',
    name: 'Morning',
    description: 'Brighten living room and warm up',
    actions: [
      { deviceExternalId: 'light-living', state: { on: true, brightness: 90 } },
      { deviceExternalId: 'thermostat-main', state: { temperature: 21 } },
    ],
  },
];

let mockDeviceState = clone(mockDevices);
let mockSceneState = clone(mockScenes);

function mapDeviceRow(row: {
  id: string;
  household_id: string;
  external_id: string;
  name: string;
  room: string | null;
  device_type: string;
  state: Json;
  is_online: boolean;
}): SmartHomeDevice {
  const state =
    row.state && typeof row.state === 'object' && !Array.isArray(row.state)
      ? (row.state as Record<string, unknown>)
      : {};
  const isOn = typeof state.on === 'boolean' ? state.on : Boolean(state.powered ?? state.active ?? true);

  return {
    id: row.id,
    householdId: row.household_id,
    externalId: row.external_id,
    name: row.name,
    room: row.room ?? undefined,
    deviceType: row.device_type,
    isOnline: row.is_online,
    isOn,
    state,
  };
}

function mapSceneRow(row: {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  actions: Json;
}): SmartHomeScene {
  const actions = Array.isArray(row.actions)
    ? (row.actions.filter((item) => item && typeof item === 'object') as Record<string, unknown>[])
    : [];

  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    description: row.description ?? undefined,
    actions,
  };
}

export const smartHomeRepository = {
  async listDevices(householdId: string | null | undefined): Promise<SmartHomeDevice[]> {
    if (isMockMode()) {
      return householdId
        ? mockDeviceState.filter((device) => device.householdId === householdId)
        : clone(mockDeviceState);
    }

    if (!householdId) {
      return [];
    }

    const supabase = getConfiguredSupabase('smartHomeRepository.listDevices');
    const { data, error } = await supabase
      .from('smart_home_devices')
      .select('*')
      .eq('household_id', householdId)
      .order('name', { ascending: true });
    mapDbError('smartHomeRepository.listDevices', error);

    return (data ?? []).map((row) => mapDeviceRow(row));
  },

  async listScenes(householdId: string | null | undefined): Promise<SmartHomeScene[]> {
    if (isMockMode()) {
      return householdId
        ? mockSceneState.filter((scene) => scene.householdId === householdId)
        : clone(mockSceneState);
    }

    if (!householdId) {
      return [];
    }

    const supabase = getConfiguredSupabase('smartHomeRepository.listScenes');
    const { data, error } = await supabase
      .from('smart_home_scenes')
      .select('*')
      .eq('household_id', householdId)
      .order('name', { ascending: true });
    mapDbError('smartHomeRepository.listScenes', error);

    return (data ?? []).map((row) => mapSceneRow(row));
  },

  async toggleDevice(deviceId: string, isOn?: boolean): Promise<SmartHomeDevice | null> {
    if (isMockMode()) {
      mockDeviceState = mockDeviceState.map((device) => {
        if (device.id !== deviceId) {
          return device;
        }
        const nextOn = typeof isOn === 'boolean' ? isOn : !device.isOn;
        return {
          ...device,
          isOn: nextOn,
          state: { ...device.state, on: nextOn },
        };
      });
      return mockDeviceState.find((device) => device.id === deviceId) ?? null;
    }

    const supabase = getConfiguredSupabase('smartHomeRepository.toggleDevice');
    const { data: current, error: currentError } = await supabase
      .from('smart_home_devices')
      .select('*')
      .eq('id', deviceId)
      .maybeSingle();
    mapDbError('smartHomeRepository.toggleDevice.lookup', currentError);

    if (!current) {
      return null;
    }

    const currentState =
      current.state && typeof current.state === 'object' && !Array.isArray(current.state)
        ? (current.state as Record<string, unknown>)
        : {};
    const currentOn =
      typeof currentState.on === 'boolean' ? currentState.on : Boolean(currentState.powered ?? true);
    const nextOn = typeof isOn === 'boolean' ? isOn : !currentOn;
    const nextState = { ...currentState, on: nextOn };

    const { data, error } = await supabase
      .from('smart_home_devices')
      .update({ state: nextState as Json })
      .eq('id', deviceId)
      .select('*')
      .single();
    mapDbError('smartHomeRepository.toggleDevice.update', error);

    return data ? mapDeviceRow(data) : null;
  },

  async activateScene(sceneId: string): Promise<SmartHomeScene | null> {
    if (isMockMode()) {
      const scene = mockSceneState.find((item) => item.id === sceneId);
      if (!scene) {
        return null;
      }

      mockDeviceState = mockDeviceState.map((device) => {
        const action = scene.actions.find(
          (item) => item.deviceExternalId === device.externalId || item.deviceId === device.id
        );
        if (!action || typeof action.state !== 'object' || !action.state) {
          return device;
        }
        const nextState = { ...device.state, ...(action.state as Record<string, unknown>) };
        const nextOn =
          typeof nextState.on === 'boolean' ? nextState.on : device.isOn;
        return { ...device, state: nextState, isOn: nextOn };
      });

      return scene;
    }

    const supabase = getConfiguredSupabase('smartHomeRepository.activateScene');
    const { data: scene, error: sceneError } = await supabase
      .from('smart_home_scenes')
      .select('*')
      .eq('id', sceneId)
      .maybeSingle();
    mapDbError('smartHomeRepository.activateScene.lookup', sceneError);

    if (!scene) {
      return null;
    }

    const mapped = mapSceneRow(scene);
    for (const action of mapped.actions) {
      const externalId = typeof action.deviceExternalId === 'string' ? action.deviceExternalId : null;
      const deviceId = typeof action.deviceId === 'string' ? action.deviceId : null;
      const nextState =
        action.state && typeof action.state === 'object' && !Array.isArray(action.state)
          ? (action.state as Record<string, unknown>)
          : null;

      if (!nextState) {
        continue;
      }

      let query = supabase.from('smart_home_devices').update({ state: nextState as Json });
      if (deviceId) {
        query = query.eq('id', deviceId);
      } else if (externalId) {
        query = query.eq('household_id', scene.household_id).eq('external_id', externalId);
      } else {
        continue;
      }

      const { error } = await query;
      mapDbError('smartHomeRepository.activateScene.apply', error);
    }

    return mapped;
  },

  async ensureMockSeed(householdId = 'hh-rivera') {
    if (!isMockMode()) {
      return;
    }
    if (!mockDeviceState.some((device) => device.householdId === householdId)) {
      mockDeviceState = [
        ...mockDeviceState,
        ...mockDevices.map((device) => ({
          ...device,
          id: createLocalId('device'),
          householdId,
        })),
      ];
    }
    if (!mockSceneState.some((scene) => scene.householdId === householdId)) {
      mockSceneState = [
        ...mockSceneState,
        ...mockScenes.map((scene) => ({
          ...scene,
          id: createLocalId('scene'),
          householdId,
        })),
      ];
    }
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
