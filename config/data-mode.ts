export type DataMode = 'mock' | 'supabase';

const rawDataMode = process.env.EXPO_PUBLIC_DATA_MODE;

export const dataMode: DataMode = rawDataMode === 'supabase' ? 'supabase' : 'mock';

export const isSupabaseMode = dataMode === 'supabase';
