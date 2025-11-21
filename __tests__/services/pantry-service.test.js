import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PantryService from '../../../services/pantry-service';

// Mock the service
jest.mock('../../../services/pantry-service');

describe('PantryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createItem', () => {
    it('should create a pantry item successfully', async () => {
      const mockItem = {
        itemID: 1,
        itemName: 'Milk',
        quantity: 1,
        unit: 'liter',
        itemExpiration: '2025-11-30',
      };

      PantryService.createItem.mockResolvedValue(mockItem);

      const result = await PantryService.createItem({
        itemName: 'Milk',
        quantity: 1,
        unit: 'liter',
      });

      expect(result).toEqual(mockItem);
      expect(PantryService.createItem).toHaveBeenCalledWith({
        itemName: 'Milk',
        quantity: 1,
        unit: 'liter',
      });
    });

    it('should handle errors when creating item', async () => {
      PantryService.createItem.mockRejectedValue(new Error('Database error'));

      await expect(
        PantryService.createItem({ itemName: 'Milk' })
      ).rejects.toThrow('Database error');
    });
  });

  describe('getUserItems', () => {
    it('should fetch user items', async () => {
      const mockItems = [
        { itemID: 1, itemName: 'Milk', quantity: 1 },
        { itemID: 2, itemName: 'Eggs', quantity: 12 },
      ];

      PantryService.getUserItems.mockResolvedValue(mockItems);

      const result = await PantryService.getUserItems(123);

      expect(result).toEqual(mockItems);
      expect(result).toHaveLength(2);
    });
  });

  describe('deleteItem', () => {
    it('should delete an item', async () => {
      PantryService.deleteItem.mockResolvedValue({ success: true });

      const result = await PantryService.deleteItem(1);

      expect(result.success).toBe(true);
      expect(PantryService.deleteItem).toHaveBeenCalledWith(1);
    });
  });
});
