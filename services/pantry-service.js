import { supabase } from '../lib/supabase';
import ImageConverter from '../utils/image-converter';

/**
 * Pantry Service
 * Handles all pantry-related database operations for inventories and items
 * Includes image upload to Supabase Storage with WebP conversion
 */

class PantryService {
  // =====================================================
  // IMAGE UPLOAD OPERATIONS
  // =====================================================

  /**
   * Upload image to Supabase Storage with WebP conversion
   * @param {string} imageUri - Local image URI from picker
   * @param {string} userID - User ID for organizing files
   * @param {string} itemName - Item name for filename
   * @returns {Promise<string>} Public URL of uploaded image
   */
  async uploadItemImage(imageUri, userID, itemName) {
    try {
      console.log('📤 Uploading pantry item image...');

      // Step 1: Convert image to WebP
      const convertedImage = await ImageConverter.convertToWebP(
        imageUri,
        ImageConverter.ConversionPresets.RECIPE_THUMBNAIL // 600x600, good for pantry items
      );

      // Step 2: Generate unique filename
      const timestamp = Date.now();
      const sanitizedName = itemName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `${userID}_${sanitizedName}_${timestamp}.webp`;
      const filePath = `pantry-items/${userID}/${fileName}`;

      // Step 3: Convert base64 to blob for upload
      const base64Data = convertedImage.base64.replace(/^data:image\/\w+;base64,/, '');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'image/webp' });

      // Step 4: Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('pantry-images')
        .upload(filePath, blob, {
          contentType: 'image/webp',
          upsert: false
        });

      if (error) throw error;

      // Step 5: Get public URL
      const { data: urlData } = supabase.storage
        .from('pantry-images')
        .getPublicUrl(filePath);

      console.log('✅ Image uploaded successfully!');
      console.log('🔗 URL:', urlData.publicUrl);

      return urlData.publicUrl;
    } catch (error) {
      console.error('❌ Image upload failed:', error);
      // Don't throw error, just return null - item can be created without image
      console.warn('⚠️ Proceeding without image...');
      return null;
    }
  }

  /**
   * Upload group/inventory image to Supabase Storage with WebP conversion
   * @param {string} imageUri - Local image URI from picker
   * @param {string} userID - User ID for organizing files
   * @param {string} groupName - Group name for filename
   * @returns {Promise<string>} Public URL of uploaded image
   */
  async uploadGroupImage(imageUri, userID, groupName) {
    try {
      console.log('📤 Uploading inventory group image...');

      // Step 1: Convert image to WebP (smaller size for group icons)
      const convertedImage = await ImageConverter.convertToWebP(
        imageUri,
        {
          width: 300,
          height: 300,
          quality: 85,
          format: 'webp'
        }
      );

      // Step 2: Generate unique filename
      const timestamp = Date.now();
      const sanitizedName = groupName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `${userID}_${sanitizedName}_${timestamp}.webp`;
      const filePath = `groups/${userID}/${fileName}`;

      // Step 3: Convert base64 to blob for upload
      const base64Data = convertedImage.base64.replace(/^data:image\/\w+;base64,/, '');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'image/webp' });

      // Step 4: Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('pantry-images')
        .upload(filePath, blob, {
          contentType: 'image/webp',
          upsert: false
        });

      if (error) throw error;

      // Step 5: Get public URL
      const { data: urlData } = supabase.storage
        .from('pantry-images')
        .getPublicUrl(filePath);

      console.log('✅ Group image uploaded successfully!');
      console.log('🔗 URL:', urlData.publicUrl);

      return urlData.publicUrl;
    } catch (error) {
      console.error('❌ Group image upload failed:', error);
      console.warn('⚠️ Proceeding without group image...');
      return null;
    }
  }

  /**
   * Delete image from Supabase Storage
   * @param {string} imageURL - Full URL of the image to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteItemImage(imageURL) {
    try {
      if (!imageURL || !imageURL.includes('pantry-images')) {
        return true; // No image to delete
      }

      // Extract file path from URL
      const url = new URL(imageURL);
      const pathParts = url.pathname.split('/pantry-images/');
      if (pathParts.length < 2) return true;
      
      const filePath = pathParts[1];

      const { error } = await supabase.storage
        .from('pantry-images')
        .remove([filePath]);

      if (error) {
        console.warn('⚠️ Failed to delete image:', error.message);
        return false;
      }

      console.log('✅ Image deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Error deleting image:', error);
      return false;
    }
  }

  /**
   * Delete group image from Supabase Storage (alias for deleteItemImage)
   * @param {string} imageURL - Full URL of the image to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteGroupImage(imageURL) {
    return this.deleteItemImage(imageURL); // Same logic, different context
  }

  // =====================================================
  // INVENTORY (GROUPS) OPERATIONS
  // =====================================================

  /**
   * Check if user is verified and can create inventories
   * @param {number} userID - The user's ID
   * @returns {Promise<boolean>} Whether user is verified
   */
  async checkUserVerified(userID) {
    try {
      const { data, error } = await supabase
        .from('tbl_users')
        .select('isverified')
        .eq('userID', userID)
        .single();

      if (error) throw error;
      return data?.isverified || false;
    } catch (error) {
      console.error('Error checking user verification:', error);
      return false;
    }
  }

  /**
   * Get user's total item count across all inventories
   * @param {number} userID - The user's ID
   * @returns {Promise<number>} Total number of items
   */
  async getUserTotalItemCount(userID) {
    try {
      const { count, error } = await supabase
        .from('tbl_items')
        .select('*', { count: 'exact', head: true })
        .in('inventoryID', 
          supabase
            .from('tbl_inventories')
            .select('inventoryID')
            .eq('userID', userID)
        );

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting user item count:', error);
      // Fallback: Count manually
      try {
        const inventories = await this.getUserInventories(userID);
        const inventoryIDs = inventories.map(inv => inv.inventoryID);
        
        if (inventoryIDs.length === 0) return 0;

        const items = await Promise.all(
          inventoryIDs.map(id => this.getInventoryItems(id))
        );
        
        return items.flat().length;
      } catch (fallbackError) {
        console.error('Fallback count also failed:', fallbackError);
        return 0;
      }
    }
  }

  /**
   * Get all inventories for a user
   * @param {number} userID - The user's ID
   * @returns {Promise<Array>} Array of inventory objects
   */
  async getUserInventories(userID) {
    try {
      const { data, error } = await supabase
        .from('tbl_inventories')
        .select('*')
        .eq('userID', userID)
        .order('createdAt', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching inventories:', error);
      throw error;
    }
  }

  /**
   * Create a new inventory/group
   * @param {Object} inventoryData - { userID, inventoryName, inventoryColor, inventoryTags, maxItems, imageUri }
   * @returns {Promise<Object>} Created inventory object
   */
  async createInventory(userID, inventoryData = {}) {
    try {
      // Check if user is verified
      const isVerified = await this.checkUserVerified(userID);
      if (!isVerified) {
        throw new Error('User must be verified via OTP to create inventories');
      }

      const {
        inventoryName = 'My Pantry',
        inventoryColor = '#8BC34A',
        inventoryTags = [],
        maxItems = 100,
        imageUri = null,
      } = inventoryData;

      // Upload group image if provided
      let imageURL = null;
      if (imageUri) {
        imageURL = await this.uploadGroupImage(imageUri, userID, inventoryName);
      }

      const { data, error } = await supabase
        .from('tbl_inventories')
        .insert([
          {
            userID,
            inventoryName,
            inventoryColor,
            inventoryTags,
            imageURL,
            isFull: false,
            itemCount: 0,
            maxItems,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating inventory:', error);
      throw error;
    }
  }

  /**
   * Update inventory metadata
   * @param {number} inventoryID - The inventory ID
   * @param {Object} updates - Fields to update (can include imageUri for new image)
   * @returns {Promise<Object>} Updated inventory object
   */
  async updateInventory(inventoryID, updates) {
    try {
      // Handle image update if new imageUri provided
      if (updates.imageUri && updates.userID) {
        // Get current inventory to check for old image
        const { data: currentInv } = await supabase
          .from('tbl_inventories')
          .select('imageURL, inventoryName')
          .eq('inventoryID', inventoryID)
          .single();

        // Delete old image if exists
        if (currentInv?.imageURL) {
          await this.deleteGroupImage(currentInv.imageURL);
        }

        // Upload new image
        const imageURL = await this.uploadGroupImage(
          updates.imageUri,
          updates.userID,
          updates.inventoryName || currentInv?.inventoryName || 'group'
        );

        // Replace imageUri with imageURL in updates
        delete updates.imageUri;
        delete updates.userID;
        updates.imageURL = imageURL;
      }

      const { data, error } = await supabase
        .from('tbl_inventories')
        .update({
          ...updates,
          updatedAt: new Date().toISOString(),
        })
        .eq('inventoryID', inventoryID)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating inventory:', error);
      throw error;
    }
  }

  /**
   * Delete an inventory and all its items
   * @param {number} inventoryID - The inventory ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteInventory(inventoryID) {
    try {
      // Get inventory to delete group image
      const { data: inventory } = await supabase
        .from('tbl_inventories')
        .select('imageURL')
        .eq('inventoryID', inventoryID)
        .single();

      // Delete group image if exists
      if (inventory?.imageURL) {
        await this.deleteGroupImage(inventory.imageURL);
      }

      // First delete all items in the inventory (will also delete item images)
      await this.deleteAllItemsInInventory(inventoryID);

      // Then delete the inventory itself
      const { error } = await supabase
        .from('tbl_inventories')
        .delete()
        .eq('inventoryID', inventoryID);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting inventory:', error);
      throw error;
    }
  }

  /**
   * Update inventory item count
   * @param {number} inventoryID - The inventory ID
   * @returns {Promise<Object>} Updated inventory
   */
  async updateInventoryItemCount(inventoryID) {
    try {
      // Get current item count
      const { count, error: countError } = await supabase
        .from('tbl_items')
        .select('*', { count: 'exact', head: true })
        .eq('inventoryID', inventoryID);

      if (countError) throw countError;

      // Get inventory to check maxItems
      const { data: inventory, error: invError } = await supabase
        .from('tbl_inventories')
        .select('maxItems')
        .eq('inventoryID', inventoryID)
        .single();

      if (invError) throw invError;

      // Update inventory
      const isFull = count >= inventory.maxItems;
      return await this.updateInventory(inventoryID, {
        itemCount: count,
        isFull,
      });
    } catch (error) {
      console.error('Error updating inventory item count:', error);
      throw error;
    }
  }

  // =====================================================
  // ITEM OPERATIONS
  // =====================================================

  /**
   * Get all items in an inventory
   * @param {number} inventoryID - The inventory ID
   * @returns {Promise<Array>} Array of item objects
   */
  async getInventoryItems(inventoryID) {
    try {
      const { data, error } = await supabase
        .from('tbl_items')
        .select('*')
        .eq('inventoryID', inventoryID)
        .order('itemAdded', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      throw error;
    }
  }

  /**
   * Get all items for a user (across all inventories)
   * @param {number} userID - The user's ID
   * @returns {Promise<Array>} Array of item objects with inventory info
   */
  async getUserItems(userID) {
    try {
      const { data, error } = await supabase
        .from('tbl_items')
        .select(`
          *,
          tbl_inventories!inner(userID)
        `)
        .eq('tbl_inventories.userID', userID)
        .order('itemAdded', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user items:', error);
      throw error;
    }
  }

  /**
   * Create a new item
   * @param {Object} itemData - Item data object
   * @returns {Promise<Object>} Created item object
   */
  async createItem(itemData) {
    try {
      const {
        inventoryID,
        itemName,
        quantity = 0,
        unit,
        itemCategory,
        itemDescription,
        itemExpiration,
        imageURL, // This can be local URI - will be uploaded
        userID, // Needed for image upload
      } = itemData;

      // Validate required fields
      if (!inventoryID || !itemName || !itemCategory) {
        throw new Error('Missing required fields: inventoryID, itemName, itemCategory');
      }

      // Check if user has reached 100-item limit
      if (userID) {
        // Get userID from inventory if not provided
        let userIDToCheck = userID;
        if (!userIDToCheck) {
          const { data: inventory } = await supabase
            .from('tbl_inventories')
            .select('userID')
            .eq('inventoryID', inventoryID)
            .single();
          userIDToCheck = inventory?.userID;
        }

        if (userIDToCheck) {
          const totalItems = await this.getUserTotalItemCount(userIDToCheck);
          if (totalItems >= 100) {
            throw new Error('You have reached the maximum limit of 100 items. Please delete some items before adding new ones.');
          }
        }
      }

      // Upload image to Supabase if provided
      let uploadedImageURL = null;
      if (imageURL && imageURL.startsWith('file://')) {
        console.log('🖼️ Uploading image to Supabase...');
        uploadedImageURL = await this.uploadItemImage(imageURL, userID, itemName);
      } else if (imageURL) {
        // Already a URL (editing existing item)
        uploadedImageURL = imageURL;
      }

      const { data, error } = await supabase
        .from('tbl_items')
        .insert([
          {
            inventoryID,
            itemName,
            quantity,
            unit,
            itemCategory,
            itemDescription,
            itemExpiration,
            imageURL: uploadedImageURL, // Use uploaded URL
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Update inventory item count
      await this.updateInventoryItemCount(inventoryID);

      return data;
    } catch (error) {
      console.error('Error creating item:', error);
      throw error;
    }
  }

  /**
   * Update an existing item
   * @param {number} itemID - The item ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated item object
   */
  async updateItem(itemID, updates) {
    try {
      const { imageURL, userID, itemName, ...otherUpdates } = updates;

      // Handle image upload if new local image provided
      let uploadedImageURL = imageURL;
      if (imageURL && imageURL.startsWith('file://')) {
        console.log('🖼️ Uploading new image to Supabase...');
        
        // Get old image URL to delete it
        const { data: oldItem } = await supabase
          .from('tbl_items')
          .select('imageURL')
          .eq('itemID', itemID)
          .single();

        // Upload new image
        uploadedImageURL = await this.uploadItemImage(imageURL, userID, itemName || 'item');

        // Delete old image if exists
        if (oldItem?.imageURL) {
          await this.deleteItemImage(oldItem.imageURL);
        }
      }

      const { data, error } = await supabase
        .from('tbl_items')
        .update({
          ...otherUpdates,
          ...(itemName && { itemName }),
          ...(uploadedImageURL && { imageURL: uploadedImageURL }),
          updatedAt: new Date().toISOString(),
        })
        .eq('itemID', itemID)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  }

  /**
   * Delete an item
   * @param {number} itemID - The item ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteItem(itemID) {
    try {
      // Get the item first to know which inventory to update and image to delete
      const { data: item, error: fetchError } = await supabase
        .from('tbl_items')
        .select('inventoryID, imageURL')
        .eq('itemID', itemID)
        .single();

      if (fetchError) throw fetchError;

      // Delete image from storage if exists
      if (item.imageURL) {
        await this.deleteItemImage(item.imageURL);
      }

      const { error } = await supabase
        .from('tbl_items')
        .delete()
        .eq('itemID', itemID);

      if (error) throw error;

      // Update inventory item count
      await this.updateInventoryItemCount(item.inventoryID);

      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  }

  /**
   * Delete all items in an inventory
   * @param {number} inventoryID - The inventory ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteAllItemsInInventory(inventoryID) {
    try {
      const { error } = await supabase
        .from('tbl_items')
        .delete()
        .eq('inventoryID', inventoryID);

      if (error) throw error;

      // Update inventory item count
      await this.updateInventoryItemCount(inventoryID);

      return true;
    } catch (error) {
      console.error('Error deleting all items in inventory:', error);
      throw error;
    }
  }

  /**
   * Search items by name or category
   * @param {number} userID - The user's ID
   * @param {string} query - Search query
   * @returns {Promise<Object>} Object with items array
   */
  async searchItems(userID, query) {
    try {
      const { data, error } = await supabase
        .from('tbl_items')
        .select(`
          *,
          tbl_inventories!inner(userID)
        `)
        .eq('tbl_inventories.userID', userID)
        .or(`itemName.ilike.%${query}%,itemCategory.ilike.%${query}%`)
        .order('itemAdded', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching items:', error);
      throw error;
    }
  }

  /**
   * Get items expiring soon (within specified days)
   * @param {number} userID - The user's ID
   * @param {number} days - Number of days to check (default: 7)
   * @returns {Promise<Array>} Array of expiring items
   */
  async getExpiringItems(userID, days = 7) {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const { data, error } = await supabase
        .from('tbl_items')
        .select(`
          *,
          tbl_inventories!inner(userID)
        `)
        .eq('tbl_inventories.userID', userID)
        .not('itemExpiration', 'is', null)
        .lte('itemExpiration', futureDate.toISOString().split('T')[0])
        .gte('itemExpiration', new Date().toISOString().split('T')[0])
        .order('itemExpiration', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching expiring items:', error);
      throw error;
    }
  }

  /**
   * Move item to different inventory
   * @param {number} itemID - The item ID
   * @param {number} newInventoryID - The target inventory ID
   * @returns {Promise<Object>} Updated item
   */
  async moveItemToInventory(itemID, newInventoryID) {
    try {
      // Get the item first to know the old inventory
      const { data: item, error: fetchError } = await supabase
        .from('tbl_items')
        .select('inventoryID')
        .eq('itemID', itemID)
        .single();

      if (fetchError) throw fetchError;

      const oldInventoryID = item.inventoryID;

      // Update the item
      const updatedItem = await this.updateItem(itemID, {
        inventoryID: newInventoryID,
      });

      // Update both inventories' item counts
      await this.updateInventoryItemCount(oldInventoryID);
      await this.updateInventoryItemCount(newInventoryID);

      return updatedItem;
    } catch (error) {
      console.error('Error moving item to inventory:', error);
      throw error;
    }
  }
}

export default new PantryService();
