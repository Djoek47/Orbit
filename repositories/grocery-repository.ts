import { locationForGroceryCategory } from '@/data/household-rooms';
import { mockHousehold } from '@/data/mock-household';
import { mapGroceryRow } from '@/lib/mappers/orbit-mappers';
import { createLocalId, getConfiguredSupabase, isMockMode, mapDbError } from '@/repositories/repository-utils';
import type { CreateGroceryInput, GroceryItem } from '@/types/orbit';

let mockGroceriesState: GroceryItem[] = clone(mockHousehold.groceries);

export function __setMockGroceriesStateForTests(items: GroceryItem[]) {
  mockGroceriesState = clone(items);
}

function resolveLocation(category: string, override?: GroceryItem['location']): GroceryItem['location'] {
  if (override) return override;
  return locationForGroceryCategory(category);
}

function locationToDb(location: NonNullable<GroceryItem['location']>) {
  return location.toLowerCase() as 'fridge' | 'freezer' | 'pantry' | 'bathroom' | 'cleaning';
}

function statusToDb(status: GroceryItem['status']) {
  return status.toLowerCase() as 'available' | 'low' | 'missing' | 'purchased';
}

export const groceryRepository = {
  async getGroceries(householdId: string | null | undefined): Promise<GroceryItem[]> {
    if (isMockMode()) {
      return clone(mockGroceriesState);
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
    const category = input.category?.trim() || 'Other';
    const item: GroceryItem = {
      id: createLocalId('grocery'),
      name: input.name.trim(),
      category,
      categoryId: input.categoryId,
      quantity: input.quantity?.trim() || '1',
      location: input.location,
      status: 'Missing',
      barcode: input.barcode,
      typicalPrice: input.typicalPrice,
      salePrice: input.salePrice,
      aisle: input.aisle,
      storeId: input.storeId,
      requestedBy: input.requestedBy,
      note: input.note?.trim() || undefined,
    };

    if (isMockMode()) {
      mockGroceriesState = [item, ...mockGroceriesState];
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
        location: item.location ? locationToDb(item.location) : 'pantry',
        status: 'missing',
        note: item.note ?? null,
      })
      .select('*')
      .single();
    mapDbError('groceryRepository.addGroceryItem', error);

    if (!data) {
      throw new Error('groceryRepository.addGroceryItem: Insert returned no row.');
    }

    return {
      ...mapGroceryRow(data),
      barcode: item.barcode,
      typicalPrice: item.typicalPrice,
      salePrice: item.salePrice,
      aisle: item.aisle,
      storeId: item.storeId,
      requestedBy: item.requestedBy,
      note: item.note,
      categoryId: item.categoryId,
    };
  },

  async updateGroceryStatus(
    item: GroceryItem,
    status: GroceryItem['status'],
    householdId?: string | null
  ): Promise<GroceryItem> {
    const updated: GroceryItem = { ...item, status };

    if (isMockMode()) {
      mockGroceriesState = mockGroceriesState.map((row) => (row.id === item.id ? updated : row));
      return updated;
    }

    const supabase = getConfiguredSupabase('groceryRepository.updateGroceryStatus');
    const { data, error } = await supabase
      .from('grocery_items')
      .update({ status: statusToDb(status) })
      .eq('id', item.id)
      .select('*')
      .single();
    mapDbError('groceryRepository.updateGroceryStatus', error);

    const resolvedHouseholdId = householdId ?? data?.household_id;
    if (status === 'Purchased' && resolvedHouseholdId) {
      const { error: historyError } = await supabase.from('grocery_purchase_history').insert({
        household_id: resolvedHouseholdId,
        grocery_item_id: item.id,
        name: item.name,
        category: item.category,
      });
      mapDbError('groceryRepository.updateGroceryStatus.history', historyError);
    }

    return data ? mapGroceryRow(data) : updated;
  },

  async markGroceryPurchased(item: GroceryItem, householdId?: string | null): Promise<GroceryItem> {
    return this.updateGroceryStatus(item, 'Purchased', householdId);
  },

  async markGroceryLow(item: GroceryItem, householdId?: string | null): Promise<GroceryItem> {
    return this.updateGroceryStatus(item, 'Low', householdId);
  },

  async markGroceryMissing(item: GroceryItem, householdId?: string | null): Promise<GroceryItem> {
    return this.updateGroceryStatus(item, 'Missing', householdId);
  },

  async updateGroceryCategory(
    item: GroceryItem,
    category: string,
    categoryId?: string,
    householdId?: string | null
  ): Promise<GroceryItem> {
    const updated: GroceryItem = {
      ...item,
      category,
      categoryId: categoryId ?? item.categoryId,
    };

    if (isMockMode()) {
      mockGroceriesState = mockGroceriesState.map((row) => (row.id === item.id ? updated : row));
      return updated;
    }

    const supabase = getConfiguredSupabase('groceryRepository.updateGroceryCategory');
    const { data, error } = await supabase
      .from('grocery_items')
      .update({ category })
      .eq('id', item.id)
      .select('*')
      .single();
    mapDbError('groceryRepository.updateGroceryCategory', error);
    void householdId;
    return data ? { ...mapGroceryRow(data), categoryId: updated.categoryId } : updated;
  },

  async removeGroceryItems(itemIds: string[], householdId?: string | null): Promise<void> {
    if (!itemIds.length) return;

    if (isMockMode()) {
      const idSet = new Set(itemIds);
      mockGroceriesState = mockGroceriesState.filter((row) => !idSet.has(row.id));
      return;
    }

    if (!householdId) {
      throw new Error('groceryRepository.removeGroceryItems: householdId is required in Supabase mode.');
    }

    const supabase = getConfiguredSupabase('groceryRepository.removeGroceryItems');
    const { error } = await supabase
      .from('grocery_items')
      .delete()
      .eq('household_id', householdId)
      .in('id', itemIds);
    mapDbError('groceryRepository.removeGroceryItems', error);
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
