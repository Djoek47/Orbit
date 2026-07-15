import { dataMode } from '@/config/data-mode';
import { createLocalId, requireMockOrSupabaseReady } from '@/repositories/repository-utils';
import type { CreateGroceryInput, GroceryItem } from '@/types/orbit';

export const groceryRepository = {
  async getGroceries(groceries: GroceryItem[]): Promise<GroceryItem[]> {
    if (dataMode === 'mock') {
      return [...groceries];
    }

    requireMockOrSupabaseReady('groceryRepository.getGroceries');
    return [...groceries];
  },

  async addGroceryItem(input: CreateGroceryInput): Promise<GroceryItem> {
    if (dataMode !== 'mock') {
      requireMockOrSupabaseReady('groceryRepository.addGroceryItem');
    }

    return {
      id: createLocalId('grocery'),
      name: input.name.trim(),
      category: input.category,
      quantity: '1 item',
      location: input.category === 'Household' ? 'Cleaning' : input.category === 'Dairy' ? 'Fridge' : 'Pantry',
      status: 'Missing',
    };
  },

  async markGroceryPurchased(item: GroceryItem): Promise<GroceryItem> {
    if (dataMode !== 'mock') {
      requireMockOrSupabaseReady('groceryRepository.markGroceryPurchased');
    }

    return {
      ...item,
      status: 'Purchased',
    };
  },
};
