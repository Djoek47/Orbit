import { mockHousehold } from '@/data/mock-household';
import { mapGroceryRow } from '@/lib/mappers/orbit-mappers';
import { createLocalId, getConfiguredSupabase, isMockMode, mapDbError } from '@/repositories/repository-utils';
import type { CreateGroceryInput, GroceryItem } from '@/types/orbit';

function resolveLocation(category: string): GroceryItem['location'] {
  if (category === 'Household') return 'Cleaning';
  if (category === 'Dairy') return 'Fridge';
  return 'Pantry';
}

function locationToDb(location: GroceryItem['location']) {
  return location.toLowerCase() as 'fridge' | 'freezer' | 'pantry' | 'bathroom' | 'cleaning';
}

export const groceryRepository = {
  async getGroceries(householdId: string | null | undefined): Promise<GroceryItem[]> {
    if (isMockMode()) {
      return clone(mockHousehold.groceries);
    }

    if (!householdId) {
      return [];
    }

    const supabase = getConfiguredSupabase('groceryRepository.getGroceries');
    const { data, error } = await supabase
      .from('grocery_items')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });
    mapDbError('groceryRepository.getGroceries', error);

    return (data ?? []).map((row) => mapGroceryRow(row));
  },

  async addGroceryItem(
    householdId: string | null | undefined,
    input: CreateGroceryInput
  ): Promise<GroceryItem> {
    const item: GroceryItem = {
      id: createLocalId('grocery'),
      name: input.name.trim(),
      category: input.category,
      quantity: '1 item',
      location: resolveLocation(input.category),
      status: 'Missing',
    };

    if (isMockMode()) {
      return item;
    }

    if (!householdId) {
      throw new Error('groceryRepository.addGroceryItem: householdId is required in Supabase mode.');
    }

    const supabase = getConfiguredSupabase('groceryRepository.addGroceryItem');
    const { data, error } = await supabase
      .from('grocery_items')
      .insert({
        household_id: householdId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        location: locationToDb(item.location),
        status: 'missing',
      })
      .select('*')
      .single();
    mapDbError('groceryRepository.addGroceryItem', error);

    if (!data) {
      throw new Error('groceryRepository.addGroceryItem: Insert returned no row.');
    }

    return mapGroceryRow(data);
  },

  async markGroceryPurchased(
    item: GroceryItem,
    householdId?: string | null
  ): Promise<GroceryItem> {
    const purchased: GroceryItem = {
      ...item,
      status: 'Purchased',
    };

    if (isMockMode()) {
      return purchased;
    }

    const supabase = getConfiguredSupabase('groceryRepository.markGroceryPurchased');
    const { data, error } = await supabase
      .from('grocery_items')
      .update({ status: 'purchased' })
      .eq('id', item.id)
      .select('*')
      .single();
    mapDbError('groceryRepository.markGroceryPurchased', error);

    const resolvedHouseholdId = householdId ?? data?.household_id;
    if (resolvedHouseholdId) {
      const { error: historyError } = await supabase.from('grocery_purchase_history').insert({
        household_id: resolvedHouseholdId,
        grocery_item_id: item.id,
        name: item.name,
        category: item.category,
      });
      mapDbError('groceryRepository.markGroceryPurchased.history', historyError);
    }

    return data ? mapGroceryRow(data) : purchased;
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
