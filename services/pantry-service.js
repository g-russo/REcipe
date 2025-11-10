import { supabase } from '../lib/supabase';
import ImageConverter from '../utils/image-converter';

/**
 * Pantry Service
 * Handles all pantry-related database operations for inventories and items
 * Includes image upload to Supabase Storage with WebP conversion
 */

class PantryService {
  // =====================================================
  // HELPER METHODS - USER ID CONVERSION
  // =====================================================

  /**
   * Get numeric userID from Supabase Auth UUID
   * Uses email lookup since tbl_users doesn't have an 'id' column
   */
  async getUserID(authUUID) {
    try {
      // Get current authenticated user's email
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user?.email) {
        console.error('❌ No authenticated user found');
        throw new Error('User not authenticated');
      }

      console.log('🔍 Looking up userID for email:', user.email);

      // Query tbl_users using email
      const { data, error } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', user.email)
        .single();

      if (error) {
        console.error('❌ Error fetching userID:', error);
        throw new Error('Failed to get user ID');
      }

      if (!data) {
        console.error('❌ No user found with email:', user.email);
        throw new Error('User not found in database');
      }

      console.log('✅ Found userID:', data.userID);
      return data.userID;
    } catch (error) {
      console.error('❌ Error in getUserID:', error);
      throw error;
    }
  }

  /**
   * Check if user is verified
   */
  async checkUserVerified(authUUID) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return false;

      const { data, error } = await supabase
        .from('tbl_users')
        .select('isVerified')
        .eq('userEmail', user.email)
        .single();

      if (error) {
        console.error('❌ Error checking verification:', error);
        return false;
      }

      console.log('✅ User verification status:', data?.isVerified);
      return data?.isVerified === true;
    } catch (error) {
      console.error('❌ Error checking user verification:', error);
      return false;
    }
  }

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

      // Step 3: Convert base64 to ArrayBuffer for React Native
      const base64Data = convertedImage.base64.replace(/^data:image\/\w+;base64,/, '');
      
      // For React Native, we need to upload the base64 directly or use fetch
      // Convert base64 to binary array
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Step 4: Upload to Supabase Storage using ArrayBuffer
      const { data, error } = await supabase.storage
        .from('pantry-images')
        .upload(filePath, byteArray.buffer, {
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

      // Step 3: Convert base64 to ArrayBuffer for React Native
      const base64Data = convertedImage.base64.replace(/^data:image\/\w+;base64,/, '');
      
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Step 4: Upload to Supabase Storage using ArrayBuffer
      const { data, error } = await supabase.storage
        .from('pantry-images')
        .upload(filePath, byteArray.buffer, {
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
      console.log('🔍 Checking verification for user:', userID);
      
      const { data, error } = await supabase
        .from('tbl_users')
        .select('"isVerified"')
        .eq('"userID"', userID)
        .single();

      if (error) {
        console.error('❌ Error checking verification:', error);
        throw error;
      }
      
      const isVerified = data?.isVerified || false;
      console.log('✅ User verification status:', isVerified);
      return isVerified;
    } catch (error) {
      console.error('❌ Error checking user verification:', error);
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
      console.log('🔢 Counting items for user:', userID);
      
      // Get all user's inventories first
      console.log('🔍 Fetching user inventories for count...');
      const { data: inventories, error: invError } = await supabase
        .from('tbl_inventories')
        .select('"inventoryID"')
        .eq('"userID"', userID);

      console.log('📊 Inventories query result:', { inventories, error: invError });

      if (invError) {
        console.error('❌ Error fetching inventories:', invError);
        throw invError;
      }
      
      if (!inventories || inventories.length === 0) {
        console.log('📦 No inventories found, count = 0');
        return 0;
      }

      const inventoryIDs = inventories.map(inv => inv.inventoryID);
      console.log('📦 Found inventories:', inventoryIDs);

      // Count items in these inventories
      console.log('🔢 Counting items in inventories:', inventoryIDs);
      const { count, error } = await supabase
        .from('tbl_items')
        .select('*', { count: 'exact', head: true })
        .in('"inventoryID"', inventoryIDs);

      console.log('📊 Item count query result:', { count, error });

      if (error) {
        console.error('❌ Error counting items:', error);
        throw error;
      }
      
      console.log('✅ Total item count:', count);
      return count || 0;
    } catch (error) {
      console.error('❌ Error getting user item count:', error);
      console.error('❌ Full error details:', JSON.stringify(error, null, 2));
      return 0;
    }
  }

  /**
   * Get all inventories for a user
   * @param {number} userID - The NUMERIC user ID (not Auth UUID)
   * @returns {Promise<Array>} Array of inventory objects
   */
  async getUserInventories(userID) {
    try {
      console.log('🔍 Fetching inventories for userID:', userID);
      console.log('🔍 User ID type:', typeof userID);
      
      // Validate that we received a number, not a UUID
      if (typeof userID !== 'number') {
        console.error('❌ getUserInventories expects numeric userID, got:', typeof userID);
        throw new Error('getUserInventories requires numeric userID. Use getUserID() to convert Auth UUID first.');
      }
      
      const { data, error } = await supabase
        .from('tbl_inventories')
        .select('*')
        .eq('userID', userID) // ✅ Use unquoted column name
        .order('createdAt', { ascending: false });

      if (error) {
        console.error('❌ Supabase error fetching inventories:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error details:', error.details);
        throw error;
      }
      
      console.log('✅ Inventories fetched:', data?.length || 0, 'records');
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching inventories:', error);
      throw error;
    }
  }

  /**
   * Create a new inventory/group
   * @param {number} userID - The NUMERIC user ID (not Auth UUID)
   * @param {Object} inventoryData - { inventoryColor, inventoryTags, maxItems, imageUri }
   * @returns {Promise<Object>} Created inventory object
   */
  async createInventory(userID, inventoryData = {}) {
    try {
      console.log('📦 Creating inventory for userID:', userID);
      
      // Validate numeric userID
      if (typeof userID !== 'number') {
        throw new Error('createInventory requires numeric userID. Use getUserID() to convert Auth UUID first.');
      }

      // Check if user is verified (but don't block)
      const isVerified = await this.checkUserVerified(userID);
      if (!isVerified) {
        console.warn('⚠️ User not verified, but allowing inventory creation');
      }

      const {
        inventoryColor = '#8BC34A',
        inventoryTags = { name: 'My Pantry' },
        maxItems = 100,
        imageUri = null,
      } = inventoryData;

      // Upload group image if provided
      let imageURL = null;
      if (imageUri) {
        imageURL = await this.uploadGroupImage(imageUri, userID, 'pantry');
      }

      const { data, error } = await supabase
        .from('tbl_inventories')
        .insert({
          userID: userID,
          inventoryColor: inventoryColor,
          inventoryTags: inventoryTags,
          imageURL: imageURL,
          isFull: false,
          itemCount: 0,
          maxItems: maxItems,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating inventory:', error);
        throw error;
      }

      console.log('✅ Inventory created:', data);
      return data;
    } catch (error) {
      console.error('❌ Error in createInventory:', error);
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
        .eq('"inventoryID"', inventoryID)
        .single();        // Delete old image if exists
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
        .eq('"inventoryID"', inventoryID)
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
        .eq('"inventoryID"', inventoryID)
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
        .eq('"inventoryID"', inventoryID);

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
        .eq('"inventoryID"', inventoryID);

      if (countError) throw countError;

      // Get inventory to check maxItems
      const { data: inventory, error: invError } = await supabase
        .from('tbl_inventories')
        .select('maxItems')
        .eq('"inventoryID"', inventoryID)
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
        .eq('"inventoryID"', inventoryID)
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
          tbl_inventories!inner("userID")
        `)
        .eq('tbl_inventories."userID"', userID)
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
        console.log('🔍 Checking 100-item limit for user:', userID);
        const totalItems = await this.getUserTotalItemCount(userID);
        console.log('✅ Current item count:', totalItems, '/ 100');
        if (totalItems >= 100) {
          throw new Error('You have reached the maximum limit of 100 items. Please delete some items before adding new ones.');
        }
      }

      console.log('📝 Preparing to insert item into database...');
      console.log('📝 Item data:', { inventoryID, itemName, quantity, unit, itemCategory });

      // Upload image to Supabase if provided
      let uploadedImageURL = null;
      if (imageURL && imageURL.startsWith('file://')) {
        console.log('🖼️ Uploading image to Supabase...');
        uploadedImageURL = await this.uploadItemImage(imageURL, userID, itemName);
      } else if (imageURL) {
        // Already a URL (editing existing item)
        uploadedImageURL = imageURL;
      }

      console.log('🚀 Executing INSERT query...');
      // Direct insert with properly quoted column names
      const { data, error } = await supabase
        .from('tbl_items')
        .insert({
          inventoryID: inventoryID,
          itemName: itemName,
          quantity: quantity,
          unit: unit,
          itemCategory: itemCategory,
          itemDescription: itemDescription,
          itemExpiration: itemExpiration,
          imageURL: uploadedImageURL,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Insert error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      console.log('✅ Item inserted successfully:', data);
      console.log('🔄 Updating inventory item count...');

      // Update inventory item count
      await this.updateInventoryItemCount(inventoryID);

      console.log('✅ Inventory count updated');
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
          .eq('"itemID"', itemID)
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
        .eq('"itemID"', itemID)
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
        .select('"inventoryID", imageURL')
        .eq('"itemID"', itemID)
        .single();

      if (fetchError) throw fetchError;

      // Delete image from storage if exists
      if (item.imageURL) {
        await this.deleteItemImage(item.imageURL);
      }

      const { error } = await supabase
        .from('tbl_items')
        .delete()
        .eq('"itemID"', itemID);

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
      const { data, error } = await supabase
        .from('tbl_items')
        .delete()
        .eq('"inventoryID"', inventoryID);

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
      const { data, error} = await supabase
        .from('tbl_items')
        .select(`
          *,
          tbl_inventories!inner("userID")
        `)
        .eq('tbl_inventories."userID"', userID)
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
          tbl_inventories!inner("userID")
        `)
        .eq('tbl_inventories."userID"', userID)
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
        .select('"inventoryID"')
        .eq('"itemID"', itemID)
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

  // =====================================================
  // GROUP OPERATIONS (NEW)
  // =====================================================

  /**
   * Get all groups for a user's inventory
   * @param {number} userID - User ID
   * @returns {Promise<Array>} Array of groups
   */
  async getUserGroups(userID) {
    try {
      console.log('📂 Getting groups for user:', userID);
      
      // First get user's inventory
      const { data: inventory, error: invError } = await supabase
        .from('tbl_inventories')
        .select('inventoryID')
        .eq('userID', userID)
        .single();

      if (invError) throw invError;
      if (!inventory) return [];

      // Get all groups for this inventory
      const { data, error } = await supabase
        .from('tbl_groups')
        .select('*')
        .eq('inventoryID', inventory.inventoryID)
        .order('createdAt', { ascending: true });

      if (error) throw error;
      console.log(`✅ Found ${data.length} groups`);
      return data || [];
    } catch (error) {
      console.error('Error getting user groups:', error);
      throw error;
    }
  }

  /**
   * Create a new group within user's inventory
   * @param {number} userID - User ID
   * @param {Object} groupData - { groupTitle, groupColor, groupImg (imageUri) }
   * @returns {Promise<Object>} Created group
   */
  async createGroup(userID, groupData = {}) {
    try {
      console.log('📂 Creating group for user:', userID);

      // Get user's inventory
      const { data: inventory, error: invError } = await supabase
        .from('tbl_inventories')
        .select('inventoryID')
        .eq('userID', userID)
        .single();

      if (invError) throw invError;
      if (!inventory) {
        throw new Error('User must have an inventory before creating groups');
      }

      const {
        groupTitle = 'New Group',
        groupColor = '#8BC34A',
        imageUri = null,
      } = groupData;

      // Upload group image if provided
      let groupImg = null;
      if (imageUri) {
        groupImg = await this.uploadGroupImage(imageUri, userID, groupTitle);
      }

      // Create group
      const { data, error } = await supabase
        .from('tbl_groups')
        .insert([
          {
            inventoryID: inventory.inventoryID,
            groupTitle: groupTitle,
            groupColor: groupColor,
            groupImg: groupImg,
            itemCount: 0,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Group created:', data);
      return data;
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  }

  /**
   * Update a group
   * @param {number} groupID - Group ID
   * @param {Object} updates - Fields to update (can include imageUri for new image)
   * @returns {Promise<Object>} Updated group
   */
  async updateGroup(groupID, updates) {
    try {
      console.log('📝 Updating group:', groupID);

      // Handle image update if new imageUri provided
      if (updates.imageUri && updates.userID) {
        // Get current group to check for old image
        const { data: currentGroup } = await supabase
          .from('tbl_groups')
          .select('groupImg, groupTitle')
          .eq('groupID', groupID)
          .single();

        // Delete old image if exists
        if (currentGroup?.groupImg) {
          await this.deleteGroupImage(currentGroup.groupImg);
        }

        // Upload new image
        const groupImg = await this.uploadGroupImage(
          updates.imageUri,
          updates.userID,
          updates.groupTitle || currentGroup?.groupTitle || 'group'
        );

        // Replace imageUri with groupImg in updates
        delete updates.imageUri;
        delete updates.userID;
        updates.groupImg = groupImg;
      }

      const { data, error } = await supabase
        .from('tbl_groups')
        .update({
          ...updates,
          updatedAt: new Date().toISOString(),
        })
        .eq('groupID', groupID)
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Group updated:', data);
      return data;
    } catch (error) {
      console.error('Error updating group:', error);
      throw error;
    }
  }

  /**
   * Delete a group and optionally its items
   * @param {number} groupID - Group ID
   * @param {boolean} deleteItems - Whether to delete items or move them to ungrouped
   * @returns {Promise<boolean>} Success status
   */
  async deleteGroup(groupID, deleteItems = false) {
    try {
      console.log('🗑️ Deleting group:', groupID);

      // Get group to delete image
      const { data: group } = await supabase
        .from('tbl_groups')
        .select('groupImg, inventoryID')
        .eq('groupID', groupID)
        .single();

      // Delete group image if exists
      if (group?.groupImg) {
        await this.deleteGroupImage(group.groupImg);
      }

      if (deleteItems) {
        // Get all items in this group
        const { data: groupItems } = await supabase
          .from('tbl_group_items')
          .select('itemID')
          .eq('groupID', groupID);

        // Delete all items in the group
        if (groupItems && groupItems.length > 0) {
          const itemIDs = groupItems.map(gi => gi.itemID);
          await supabase
            .from('tbl_items')
            .delete()
            .in('itemID', itemIDs);
        }
      }

      // Delete group-item associations
      await supabase
        .from('tbl_group_items')
        .delete()
        .eq('groupID', groupID);

      // Delete the group
      const { error } = await supabase
        .from('tbl_groups')
        .delete()
        .eq('groupID', groupID);

      if (error) throw error;
      console.log('✅ Group deleted');
      return true;
    } catch (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  }

  /**
   * Add item to a group
   * @param {number} itemID - Item ID
   * @param {number} groupID - Group ID
   * @returns {Promise<Object>} Group-item association
   */
  async addItemToGroup(itemID, groupID) {
    try {
      console.log(`🔗 Adding item ${itemID} to group ${groupID}`);

      // Check if already in this group
      const { data: existing } = await supabase
        .from('tbl_group_items')
        .select('*')
        .eq('itemID', itemID)
        .eq('groupID', groupID)
        .single();

      if (existing) {
        console.log('ℹ️ Item already in this group');
        throw new Error('Item is already in this group');
      }

      // Add to group
      const { data, error } = await supabase
        .from('tbl_group_items')
        .insert([{ itemID, groupID }])
        .select()
        .single();

      if (error) throw error;

      // Update group item count
      await this.updateGroupItemCount(groupID);

      console.log('✅ Item added to group');
      return data;
    } catch (error) {
      console.error('Error adding item to group:', error);
      throw error;
    }
  }

  /**
   * Remove item from a group
   * @param {number} itemID - Item ID
   * @param {number} groupID - Group ID
   * @returns {Promise<boolean>} Success status
   */
  async removeItemFromGroup(itemID, groupID) {
    try {
      console.log(`🔗 Removing item ${itemID} from group ${groupID}`);

      const { error } = await supabase
        .from('tbl_group_items')
        .delete()
        .eq('itemID', itemID)
        .eq('groupID', groupID);

      if (error) throw error;

      // Update group item count
      await this.updateGroupItemCount(groupID);

      console.log('✅ Item removed from group');
      return true;
    } catch (error) {
      console.error('Error removing item from group:', error);
      throw error;
    }
  }

  /**
   * Get items in a specific group
   * @param {number} groupID - Group ID
   * @returns {Promise<Array>} Array of items
   */
  async getGroupItems(groupID) {
    try {
      console.log('📦 Getting items for group:', groupID);

      const { data, error } = await supabase
        .from('tbl_group_items')
        .select(`
          groupItemID,
          itemID,
          addedAt,
          tbl_items (*)
        `)
        .eq('groupID', groupID);

      if (error) throw error;

      // Extract items from the join
      const items = data.map(gi => gi.tbl_items);
      console.log(`✅ Found ${items.length} items in group`);
      return items;
    } catch (error) {
      console.error('Error getting group items:', error);
      throw error;
    }
  }

  /**
   * Update group item count
   * @param {number} groupID - Group ID
   * @returns {Promise<void>}
   */
  async updateGroupItemCount(groupID) {
    try {
      // Count items in group
      const { count, error: countError } = await supabase
        .from('tbl_group_items')
        .select('*', { count: 'exact', head: true })
        .eq('groupID', groupID);

      if (countError) throw countError;

      // Update group
      const { error: updateError } = await supabase
        .from('tbl_groups')
        .update({ itemCount: count || 0 })
        .eq('groupID', groupID);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error updating group item count:', error);
    }
  }
}

export default new PantryService();
