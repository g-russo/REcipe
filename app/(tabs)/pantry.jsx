import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  Alert,
  StyleSheet,
} from 'react-native';
import { useCustomAuth } from '../../hooks/use-custom-auth';
import AuthGuard from '../../components/auth-guard';
import PantryService from '../../services/pantry-service';
import ExpirationNotificationService from '../../services/expiration-notification-service';
import BackgroundNotificationRefresh from '../../services/background-notification-refresh';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Components
import PantryHeader from '../../components/pantry/pantry-header';
import SelectionModeHeader from '../../components/pantry/selection-mode-header';
import InventoryGroupsSection from '../../components/pantry/inventory-groups-section';
import PantryItemsGrid from '../../components/pantry/pantry-items-grid';
import ItemFormModal from '../../components/pantry/item-form-modal';
import GroupFormModal from '../../components/pantry/group-form-modal';
import SearchFilterModal from '../../components/pantry/search-filter-modal';
import ExpiringItemsBanner from '../../components/pantry/expiring-items-banner';

/**
 * Pantry Screen - Database Integrated
 * Manages user's pantry items and inventories with Supabase
 */
const Pantry = () => {
  const { user, customUserData } = useCustomAuth();
  
  // State
  const [inventories, setInventories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [itemFormVisible, setItemFormVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [groupFormVisible, setGroupFormVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  
  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  // Expiring items
  const [expiringItems, setExpiringItems] = useState([]);
  const [notificationSummary, setNotificationSummary] = useState(null);

  // Initialize notifications on mount
  useEffect(() => {
    initializeNotifications();
  }, []);

  // Load data on mount
  useEffect(() => {
    if (customUserData?.userID) {
      console.log('✅ User ID available:', customUserData.userID);
      loadData();
    } else {
      console.log('⚠️ No user ID available yet');
    }
  }, [customUserData]);

  // Initialize notification service
  const initializeNotifications = async () => {
    try {
      await ExpirationNotificationService.requestPermissions();
      const listener = ExpirationNotificationService.setupNotificationListener((notification) => {
        // Handle notification tap - could navigate to specific item
        console.log('Notification tapped:', notification);
      });
      
      // Register background task for notification refresh
      await BackgroundNotificationRefresh.registerBackgroundNotificationRefresh();
      
      // Save user ID for background task
      if (customUserData?.userID) {
        await AsyncStorage.setItem('currentUserID', customUserData.userID.toString());
      }
      
      // Cleanup listener on unmount
      return () => {
        if (listener) {
          listener.remove();
        }
      };
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

  // Schedule notifications for expiring items
  const scheduleExpirationNotifications = async () => {
    if (!customUserData?.userID) return;
    
    try {
      const summary = await ExpirationNotificationService.checkAndScheduleExpirationNotifications(customUserData.userID);
      setNotificationSummary(summary);
      
      // Get items expiring within 3 days for banner
      const expiring = await ExpirationNotificationService.getExpiringItems(customUserData.userID, 3);
      // Add days until expiry to each item
      const itemsWithDays = expiring.map(item => ({
        ...item,
        daysUntilExpiry: ExpirationNotificationService.calculateDaysUntilExpiration(item.itemExpiration),
      }));
      setExpiringItems(itemsWithDays);
      
      console.log('Expiration notifications scheduled:', summary);
    } catch (error) {
      console.error('Error scheduling notifications:', error);
    }
  };

  // Load inventories and items
  const loadData = async () => {
    try {
      setLoading(true);
      console.log('📥 Loading pantry data for user:', customUserData.userID);
      
      const [inventoriesData, itemsData] = await Promise.all([
        PantryService.getUserInventories(customUserData.userID),
        PantryService.getUserItems(customUserData.userID),
      ]);
      
      console.log('📦 Inventories loaded:', inventoriesData);
      console.log('📝 Items loaded:', itemsData.length, 'items');
      
      setInventories(inventoriesData);
      setItems(itemsData);
      
      // If user has no inventory but is verified, create one automatically
      if (inventoriesData.length === 0) {
        console.log('📦 No inventory found, creating default...');
        try {
          const newInventory = await PantryService.createInventory(customUserData.userID, {
            inventoryColor: '#8BC34A',
            inventoryTags: [],
            maxItems: 100,
          });
          setInventories([newInventory]);
          console.log('✅ Auto-created inventory:', newInventory);
        } catch (inventoryError) {
          // Only log, don't show error - user might not be verified yet
          console.log('⚠️ Could not auto-create inventory:', inventoryError.message);
        }
      }
      
      // Schedule expiration notifications after loading items
      await scheduleExpirationNotifications();
    } catch (error) {
      console.error('❌ Error loading pantry data:', error);
      Alert.alert('Error', 'Failed to load pantry data');
    } finally {
      setLoading(false);
    }
  };

  // Create default inventory if none exists
  const ensureInventoryExists = async () => {
    if (inventories.length === 0) {
      try {
        console.log('📦 No inventory found, creating default inventory...');
        const newInventory = await PantryService.createInventory(customUserData.userID, {
          inventoryColor: '#8BC34A',
          inventoryTags: [],
          maxItems: 100,
        });
        setInventories([newInventory]);
        console.log('✅ Default inventory created:', newInventory.inventoryID);
        return newInventory.inventoryID;
      } catch (error) {
        console.error('Error creating inventory:', error);
        
        // Check if it's a verification error
        if (error.message && error.message.includes('verified')) {
          Alert.alert(
            'Account Not Verified',
            'Please verify your account via OTP to start using the pantry. Check your email for the verification code.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Error', 'Failed to create inventory. Please try again.');
        }
        return null;
      }
    }
    return inventories[0].inventoryID;
  };

  // Handle save item
  const handleSaveItem = async (itemData) => {
    try {
      console.log('💾 Saving item...', itemData);
      
      if (editingItem) {
        // Update existing item
        console.log('📝 Updating existing item:', editingItem.itemID);
        await PantryService.updateItem(editingItem.itemID, {
          ...itemData,
          userID: customUserData.userID, // For image upload
        });
        Alert.alert('Success', 'Item updated successfully');
      } else {
        // Create new item
        console.log('➕ Creating new item...');
        
        // Ensure we have an inventory
        const inventoryID = await ensureInventoryExists();
        console.log('📦 Inventory ID:', inventoryID);
        
        if (!inventoryID) {
          console.log('❌ No inventory ID available');
          return;
        }

        const itemToCreate = {
          ...itemData,
          inventoryID: itemData.inventoryID || inventoryID,
          userID: customUserData.userID, // For image upload
        };
        
        console.log('📤 Sending item to database:', itemToCreate);
        
        const createdItem = await PantryService.createItem(itemToCreate);
        console.log('✅ Item created successfully:', createdItem);
        
        Alert.alert('Success', 'Item added successfully');
      }
      
      // Reload data
      console.log('🔄 Reloading pantry data...');
      await loadData();
      setEditingItem(null);
      setItemFormVisible(false);
    } catch (error) {
      console.error('❌ Error saving item:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      Alert.alert('Error', error.message || 'Failed to save item');
    }
  };

  // Handle delete item
  const handleDeleteItem = async (item) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.itemName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await PantryService.deleteItem(item.itemID);
              await loadData();
              Alert.alert('Success', 'Item deleted successfully');
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  // Handle item press
  const handleItemPress = (item) => {
    if (selectionMode) {
      toggleItemSelection(item.itemID);
    } else {
      // Show item details or navigate to detail screen
      Alert.alert(
        item.itemName,
        `Category: ${item.itemCategory}\nQuantity: ${item.quantity} ${item.unit}\nExpires: ${item.itemExpiration || 'No expiry'}`,
        [
          {
            text: 'Edit',
            onPress: () => {
              setEditingItem(item);
              setItemFormVisible(true);
            },
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => handleDeleteItem(item),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  // Handle item long press
  const handleItemLongPress = (item) => {
    setSelectionMode(true);
    setSelectedItems([item.itemID]);
  };

  // Handle item menu press
  const handleItemMenuPress = (e, item) => {
    e.stopPropagation();
    Alert.alert(
      'Item Actions',
      `What would you like to do with "${item.itemName}"?`,
      [
        {
          text: 'Edit',
          onPress: () => {
            setEditingItem(item);
            setItemFormVisible(true);
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteItem(item),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Toggle item selection
  const toggleItemSelection = (itemID) => {
    setSelectedItems(prev => {
      if (prev.includes(itemID)) {
        return prev.filter(id => id !== itemID);
      }
      return [...prev, itemID];
    });
  };

  // Exit selection mode
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedItems([]);
  };

  // Handle group press
  const handleGroupPress = (inventory) => {
    Alert.alert(
      inventory.inventoryName || `Inventory #${inventory.inventoryID}`,
      `Items: ${inventory.itemCount} / ${inventory.maxItems}\nStatus: ${inventory.isFull ? 'Full' : 'Available'}`,
      [
        {
          text: 'Edit',
          onPress: () => {
            setEditingGroup(inventory);
            setGroupFormVisible(true);
          },
        },
        { text: 'OK' }
      ]
    );
  };

  // Handle save group
  const handleSaveGroup = async (groupData) => {
    try {
      if (editingGroup) {
        // Update existing group
        await PantryService.updateInventory(editingGroup.inventoryID, groupData);
        Alert.alert('Success', 'Group updated successfully');
      } else {
        // Create new group
        await PantryService.createInventory(user.userID, groupData);
        Alert.alert('Success', 'Group created successfully');
      }
      
      await loadData();
      setEditingGroup(null);
    } catch (error) {
      console.error('Error saving group:', error);
      Alert.alert('Error', 'Failed to save group');
    }
  };

  // Handle create group
  const handleCreateGroup = () => {
    setEditingGroup(null);
    setGroupFormVisible(true);
  };

  // Handle search result selection
  const handleSearchResultPress = (result) => {
    setSearchModalVisible(false);
    
    if (result.type === 'item') {
      // Show item details
      handleItemPress(result);
    } else if (result.type === 'inventory') {
      // Show inventory/group details
      handleGroupPress(result);
    }
  };

  // Handle view all expiring items
  const handleViewAllExpiring = () => {
    setSearchModalVisible(true);
    // The modal will open with "Expiring Soon" filter pre-applied
  };

  return (
    <AuthGuard>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        {/* Header */}
        <PantryHeader onSearchPress={() => setSearchModalVisible(true)} />

        {/* Selection Mode Header */}
        {selectionMode && (
          <SelectionModeHeader
            selectedCount={selectedItems.length}
            onCancel={exitSelectionMode}
            onAddToGroup={() => Alert.alert('Feature Coming', 'Add to group feature coming soon!')}
            isDisabled={selectedItems.length === 0}
          />
        )}

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Expiring Items Banner */}
          <ExpiringItemsBanner
            expiringItems={expiringItems}
            onItemPress={handleItemPress}
            onViewAll={handleViewAllExpiring}
          />

          {/* Inventory Groups Section */}
          <InventoryGroupsSection
            inventories={inventories}
            onGroupPress={handleGroupPress}
            onCreateGroup={handleCreateGroup}
            userName={customUserData?.userName || user?.user_metadata?.name || 'My'}
          />

          {/* Items Grid */}
          <PantryItemsGrid
            items={items}
            onAddItem={() => setItemFormVisible(true)}
            onItemPress={handleItemPress}
            onItemLongPress={handleItemLongPress}
            onItemMenuPress={handleItemMenuPress}
            selectionMode={selectionMode}
            selectedItems={selectedItems}
          />
        </ScrollView>

        {/* Search/Filter Modal */}
        <SearchFilterModal
          visible={searchModalVisible}
          onClose={() => setSearchModalVisible(false)}
          items={items}
          inventories={inventories}
          onResultPress={handleSearchResultPress}
        />

        {/* Item Form Modal */}
        <ItemFormModal
          visible={itemFormVisible}
          onClose={() => {
            setItemFormVisible(false);
            setEditingItem(null);
          }}
          onSave={handleSaveItem}
          initialData={editingItem}
          inventories={inventories}
        />

        {/* Group Form Modal */}
        <GroupFormModal
          visible={groupFormVisible}
          onClose={() => {
            setGroupFormVisible(false);
            setEditingGroup(null);
          }}
          onSave={handleSaveGroup}
          initialData={editingGroup}
        />
      </SafeAreaView>
    </AuthGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
});

export default Pantry;
