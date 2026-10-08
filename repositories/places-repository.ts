import {
  isMissingPlacesTableError,
  mapSavedPlaceRow,
  savedPlaceToRow,
} from '@/lib/places/saved-places';
import { loadLocalSavedPlaces, saveLocalSavedPlaces } from '@/lib/places/saved-places-store';
import {
  getConfiguredSupabase,
  isMockMode,
  isPersistedHouseholdId,
} from '@/repositories/repository-utils';
import type { SavedPlace } from '@/types/orbit';

export const placesRepository = {
  /** `null` = never persisted; caller should keep snapshot defaults. */
  async list(householdId: string | null | undefined): Promise<SavedPlace[] | null> {
    if (!householdId) return null;

    if (isMockMode() || !isPersistedHouseholdId(householdId)) {
      return loadLocalSavedPlaces(householdId);
    }

    try {
      const supabase = getConfiguredSupabase('placesRepository.list');
      const { data, error } = await supabase
        .from('household_saved_places')
        .select('*')
        .eq('household_id', householdId)
        .order('sort_order', { ascending: true });
      if (error) {
        if (isMissingPlacesTableError(error)) {
          return loadLocalSavedPlaces(householdId);
        }
        console.warn('placesRepository.list', error.message);
        return loadLocalSavedPlaces(householdId);
      }
      const mapped = (data ?? []).map((row, index) =>
        mapSavedPlaceRow(row as Parameters<typeof mapSavedPlaceRow>[0], `place-${index}`)
      );
      if (mapped.length > 0) return mapped;
      const local = await loadLocalSavedPlaces(householdId);
      if (local?.length) {
        await placesRepository.saveAll(householdId, local);
        return local;
      }
      return mapped;
    } catch (error) {
      console.warn('placesRepository.list', error);
      return loadLocalSavedPlaces(householdId);
    }
  },

  async saveAll(householdId: string | null | undefined, places: SavedPlace[]): Promise<void> {
    if (!householdId) return;
    await saveLocalSavedPlaces(householdId, places);

    if (isMockMode() || !isPersistedHouseholdId(householdId)) {
      return;
    }

    try {
      const supabase = getConfiguredSupabase('placesRepository.saveAll');
      const { data: existing, error: existingError } = await supabase
        .from('household_saved_places')
        .select('client_key')
        .eq('household_id', householdId);
      if (existingError) {
        if (isMissingPlacesTableError(existingError)) return;
        console.warn('placesRepository.saveAll.list', existingError.message);
        return;
      }

      const keep = new Set(places.map((place) => place.id));
      const stale = (existing ?? [])
        .map((row) => String((row as { client_key?: string }).client_key ?? ''))
        .filter((key) => key && !keep.has(key));
      if (stale.length > 0) {
        const { error: deleteError } = await supabase
          .from('household_saved_places')
          .delete()
          .eq('household_id', householdId)
          .in('client_key', stale);
        if (deleteError && !isMissingPlacesTableError(deleteError)) {
          console.warn('placesRepository.saveAll.delete', deleteError.message);
        }
      }

      if (!places.length) return;

      const { error: upsertError } = await supabase.from('household_saved_places').upsert(
        places.map((place, index) => savedPlaceToRow(householdId, place, index)) as never,
        { onConflict: 'household_id,client_key' }
      );
      if (upsertError && !isMissingPlacesTableError(upsertError)) {
        console.warn('placesRepository.saveAll.upsert', upsertError.message);
      }
    } catch (error) {
      console.warn('placesRepository.saveAll', error);
    }
  },
};
