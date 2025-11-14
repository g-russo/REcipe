import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useCustomAuth } from '../../hooks/use-custom-auth';
import AuthGuard from '../../components/auth-guard';
import PantryService from '../../services/pantry-service';
import ExpirationNotificationService from '../../services/expiration-notification-service';
import BackgroundNotificationRefresh from '../../services/background-notification-refresh';
import { useRouter } from 'expo-router';

// Components
import PantryHeader from '../../components/pantry/pantry-header';
import SelectionModeHeader from '../../components/pantry/selection-mode-header';
import InventoryGroupsSection from '../../components/pantry/inventory-groups-section';
import PantryItemsGrid from '../../components/pantry/pantry-items-grid';
import ItemFormModal from '../../components/pantry/item-form-modal';
import GroupFormModal from '../../components/pantry/group-form-modal';
import GroupItemsModal from '../../components/pantry/group-items-modal';
import SearchFilterModal from '../../components/pantry/search-filter-modal';
import ExpiringItemsBanner from '../../components/pantry/expiring-items-banner';

/**
 * Pantry Screen - Database Integrated
 * Manages user's pantry items and inventories with Supabase
 */
const Pantry = () => {
  const { user, customUserData } = useCustomAuth();
  const params = useLocalSearchParams();
  const scrollViewRef = useRef(null);
  const router = useRouter(); // NEW
  
  // State
  const [inventories, setInventories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [highlightedItemId, setHighlightedItemId] = useState(null);
  
  // Modal states
  const [itemFormVisible, setItemFormVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [groupFormVisible, setGroupFormVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupItemsModalVisible, setGroupItemsModalVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
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

  // Handle highlight parameter from notifications
  useEffect(() => {
    if (params?.highlightItemId && items.length > 0) {
      const itemId = parseInt(params.highlightItemId);
      console.log('🔍 Highlighting item from notification:', itemId);
      
      // Check if item exists
      const itemExists = items.find(item => item.itemID === itemId);
      if (itemExists) {
        setHighlightedItemId(itemId);
        
        // Clear highlight after 3 seconds
        setTimeout(() => {
          setHighlightedItemId(null);
        }, 3000);
      } else {
        console.warn('⚠️ Item not found:', itemId);
      }
    }
  }, [params?.highlightItemId, items]);

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
      // Only get expiring items for the banner display
      // Don't schedule notifications here - they're scheduled when items are created/updated
      const expiring = await ExpirationNotificationService.getExpiringItems(customUserData.userID, 3);
      // Add days until expiry to each item
      const itemsWithDays = expiring.map(item => ({
        ...item,
        daysUntilExpiry: ExpirationNotificationService.calculateDaysUntilExpiration(item.itemExpiration),
      }));
      setExpiringItems(itemsWithDays);
      
      console.log('📊 Found', itemsWithDays.length, 'expiring items');
    } catch (error) {
      console.error('Error getting expiring items:', error);
    }
  };

  // Load inventories and items
  const loadData = async () => {
    try {
      setLoading(true);
      console.log('📥 Loading pantry data for user:', customUserData.userID);
      
      const [inventoriesData, groupsData, itemsData] = await Promise.all([
        PantryService.getUserInventories(customUserData.userID),
        PantryService.getUserGroups(customUserData.userID),
        PantryService.getUserItems(customUserData.userID),
      ]);
      
      console.log('📦 Inventories loaded:', inventoriesData);
      console.log('📁 Groups loaded:', groupsData.length, 'groups');
      console.log('📝 Items loaded:', itemsData.length, 'items');
      
      setInventories(inventoriesData);
      setGroups(groupsData); // Groups now include groupCategory from database
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
        
        // Schedule notification if item has expiration date
        if (itemData.itemExpiration) {
          const daysUntilExpiry = ExpirationNotificationService.calculateDaysUntilExpiration(itemData.itemExpiration);
          if (daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 3) {
            await ExpirationNotificationService.scheduleExpirationNotification(
              { ...editingItem, ...itemData },
              daysUntilExpiry,
              customUserData.userID
            );
          }
        }
        
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
          userID: customUserData.userID,
        };
        
        console.log('📤 Sending item to database:', itemToCreate);
        
        const createdItem = await PantryService.createItem(itemToCreate);
        console.log('✅ Item created successfully:', createdItem);
        
        // Schedule notification if item has expiration date
        if (createdItem.itemExpiration) {
          const daysUntilExpiry = ExpirationNotificationService.calculateDaysUntilExpiration(createdItem.itemExpiration);
          if (daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 3) {
            console.log('📅 Scheduling notification for item expiring in', daysUntilExpiry, 'days');
            await ExpirationNotificationService.scheduleExpirationNotification(
              createdItem,
              daysUntilExpiry,
              customUserData.userID
            );
          }
        }
        
        // NEW: Check for matching category groups and prompt user
        await checkAndPromptForCategoryGroup(createdItem);
        
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

  // NEW: Check for groups with matching category and prompt user
  const checkAndPromptForCategoryGroup = async (item) => {
    if (!item.itemCategory) return;

    // Find groups with matching category
    const matchingGroups = groups.filter(
      group => group.groupCategory === item.itemCategory
    );

    if (matchingGroups.length === 0) return;

    // Create a promise to handle the alert
    return new Promise((resolve) => {
      if (matchingGroups.length === 1) {
        // Single matching group - show styled prompt
        const group = matchingGroups[0];
        Alert.alert(
          `📂 Add to ${group.groupTitle}?`,
          `This ${item.itemCategory} item matches your "${group.groupTitle}" group.\n\nWould you like to add it?`,
          [
            {
              text: 'No, thanks',
              style: 'cancel',
              onPress: () => resolve(),
            },
            {
              text: `Add to ${group.groupTitle}`,
              onPress: async () => {
                try {
                  await PantryService.addItemToGroup(item.itemID, group.groupID);
                  Alert.alert(
                    '✅ Added!',
                    `"${item.itemName}" has been added to "${group.groupTitle}"`
                  );
                  await loadData();
                } catch (error) {
                  if (error.message && error.message.includes('already in this group')) {
                    // Silently ignore if already in group
                  } else {
                    console.error('Error adding to group:', error);
                  }
                }
                resolve();
              },
            },
          ],
          {
            cancelable: true,
            onDismiss: () => resolve(),
          }
        );
      } else {
        // Multiple matching groups - let user choose
        const groupButtons = matchingGroups.map(group => ({
          text: `📂 ${group.groupTitle}`,
          onPress: async () => {
            try {
              await PantryService.addItemToGroup(item.itemID, group.groupID);
              Alert.alert(
                '✅ Added!',
                `"${item.itemName}" has been added to "${group.groupTitle}"`
              );
              await loadData();
            } catch (error) {
              if (error.message && error.message.includes('already in this group')) {
                // Silently ignore
              } else {
                console.error('Error adding to group:', error);
              }
            }
            resolve();
          },
        }));

        groupButtons.push({
          text: 'None',
          style: 'cancel',
          onPress: () => resolve(),
        });

        Alert.alert(
          `Add to a ${item.itemCategory} Group?`,
          `You have ${matchingGroups.length} groups for ${item.itemCategory} items.\n\nAdd "${item.itemName}" to one?`,
          groupButtons,
          {
            cancelable: true,
            onDismiss: () => resolve(),
          }
        );
      }
    });
  };

  // Check if item is expired
  const isItemExpired = (item) => {
    if (!item.itemExpiration) return false;
    const daysUntilExpiry = ExpirationNotificationService.calculateDaysUntilExpiration(item.itemExpiration);
    return daysUntilExpiry < 0;
  };

  // Handle delete item
  const handleDeleteItem = async (item) => {
    const expired = isItemExpired(item);
    const message = expired 
      ? `"${item.itemName}" has expired. Do you want to delete it?`
      : `Are you sure you want to delete "${item.itemName}"?`;
    
    Alert.alert(
      expired ? 'Delete Expired Item' : 'Delete Item',
      message,
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

  // Handle delete all expired items
  const handleDeleteAllExpired = async () => {
    const expiredItems = items.filter(item => isItemExpired(item));
    
    if (expiredItems.length === 0) {
      Alert.alert('No Expired Items', 'There are no expired items to delete.');
      return;
    }

    Alert.alert(
      'Delete All Expired Items',
      `Found ${expiredItems.length} expired item(s). Delete all of them?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${expiredItems.length} Item(s)`,
          style: 'destructive',
          onPress: async () => {
            try {
              console.log(`🗑️ Deleting ${expiredItems.length} expired items...`);
              
              // Delete all expired items
              await Promise.all(
                expiredItems.map(item => PantryService.deleteItem(item.itemID))
              );
              
              await loadData();
              Alert.alert(
                'Success', 
                `Deleted ${expiredItems.length} expired item(s) successfully`
              );
            } catch (error) {
              console.error('Error deleting expired items:', error);
              Alert.alert('Error', 'Failed to delete some expired items');
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
      const expired = isItemExpired(item);
      const daysUntilExpiry = item.itemExpiration 
        ? ExpirationNotificationService.calculateDaysUntilExpiration(item.itemExpiration)
        : null;
      
      let expiryText = 'No expiry';
      if (item.itemExpiration) {
        if (expired) {
          const daysExpired = Math.abs(daysUntilExpiry);
          expiryText = daysExpired === 0 
            ? '⚠️ EXPIRED TODAY' 
            : `⚠️ EXPIRED ${daysExpired} day(s) ago`;
        } else if (daysUntilExpiry === 0) {
          expiryText = '⚠️ Expires TODAY';
        } else if (daysUntilExpiry === 1) {
          expiryText = '⏰ Expires TOMORROW';
        } else if (daysUntilExpiry <= 3) {
          expiryText = `⏰ Expires in ${daysUntilExpiry} days`;
        } else {
          expiryText = item.itemExpiration;
        }
      }
      
      // Show item details or navigate to detail screen
      Alert.alert(
        item.itemName,
        `Category: ${item.itemCategory}\nQuantity: ${item.quantity} ${item.unit}\nExpires: ${expiryText}`,
        [
          {
            text: 'Edit',
            onPress: () => {
              setEditingItem(item);
              setItemFormVisible(true);
            },
          },
          {
            text: expired ? 'Delete Expired Item' : 'Delete',
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
          text: 'Add to Group',
          onPress: () => {
            setSelectedItems([item.itemID]);
            handleAddToGroup();
          },
        },
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

  // Handle add items to group
  const handleAddToGroup = () => {
    if (selectedItems.length === 0) {
      Alert.alert('No Items Selected', 'Please select items to add to a group');
      return;
    }

    if (groups.length === 0) {
      Alert.alert(
        'No Groups Available',
        'Please create a group first before adding items.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create Group', onPress: handleCreateGroup }
        ]
      );
      return;
    }

    // Show group selection dialog
    const groupButtons = groups.map(group => ({
      text: `${group.groupTitle} (${group.itemCount || 0} items)`,
      onPress: async () => {
        try {
          console.log(`📂 Adding ${selectedItems.length} items to group ${group.groupID}`);
          
          let addedCount = 0;
          let alreadyInGroupCount = 0;
          const alreadyInGroupItems = [];
          
          // Add each selected item to the group
          for (const itemID of selectedItems) {
            try {
              await PantryService.addItemToGroup(itemID, group.groupID);
              addedCount++;
            } catch (error) {
              // Check if error is because item already in group
              if (error.message && error.message.includes('already in this group')) {
                alreadyInGroupCount++;
                const item = items.find(i => i.itemID === itemID);
                if (item) alreadyInGroupItems.push(item.itemName);
              } else {
                throw error;
              }
            }
          }
          
          // Show appropriate message
          if (alreadyInGroupCount === selectedItems.length) {
            // All items already in group
            Alert.alert(
              'Already in Group',
              `${alreadyInGroupCount === 1 ? 'This item is' : 'All selected items are'} already in "${group.groupTitle}".\n\n${alreadyInGroupItems.join(', ')}`
            );
          } else if (alreadyInGroupCount > 0) {
            // Some items already in group
            Alert.alert(
              'Partially Added',
              `${addedCount} item(s) added to "${group.groupTitle}".\n\n${alreadyInGroupCount} item(s) were already in this group: ${alreadyInGroupItems.join(', ')}`
            );
          } else {
            // All items added successfully
            Alert.alert(
              'Success',
              `${addedCount} item(s) added to "${group.groupTitle}"`
            );
          }
          
          // Exit selection mode and reload data
          exitSelectionMode();
          await loadData();
        } catch (error) {
          console.error('Error adding items to group:', error);
          Alert.alert('Error', 'Failed to add items to group');
        }
      }
    }));

    // Add cancel button
    groupButtons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(
      'Select Group',
      `Add ${selectedItems.length} item(s) to which group?`,
      groupButtons
    );
  };

  // Handle group press
  const handleGroupPress = (group) => {
    setSelectedGroup(group);
    setGroupItemsModalVisible(true);
  };

  // Handle delete group
  const handleDeleteGroup = (group) => {
    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${group.groupTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Group Only',
          onPress: async () => {
            try {
              await PantryService.deleteGroup(group.groupID, false);
              await loadData();
              Alert.alert('Success', 'Group deleted (items kept)');
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert('Error', 'Failed to delete group');
            }
          },
        },
        {
          text: 'Delete Group & Items',
          style: 'destructive',
          onPress: async () => {
            try {
              await PantryService.deleteGroup(group.groupID, true);
              await loadData();
              Alert.alert('Success', 'Group and items deleted');
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert('Error', 'Failed to delete group');
            }
          },
        },
      ]
    );
  };

  // Handle save group - now saves groupCategory to database
  const handleSaveGroup = async (groupData) => {
    try {
      if (editingGroup) {
        // Update existing group (including groupCategory)
        await PantryService.updateGroup(editingGroup.groupID, groupData);
        Alert.alert('Success', 'Group updated successfully');
      } else {
        // Create new group (including groupCategory)
        await PantryService.createGroup(customUserData.userID, groupData);
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

  // NEW: Handle find recipe with selected items
  const handleFindRecipe = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('No Items Selected', 'Please select items to find recipes');
      return;
    }

    // Get the selected item names
    const selectedItemNames = items
      .filter(item => selectedItems.includes(item.itemID))
      .map(item => item.itemName);

    if (selectedItemNames.length === 0) {
      Alert.alert('Error', 'Could not find selected items');
      return;
    }

    // Create a search query from selected items
    const searchQuery = selectedItemNames.join(', ');

    // Exit selection mode first
    exitSelectionMode();
    
    // Navigate to recipe search tab and trigger search
    try {
      // Navigate to the recipe-search tab
      router.push('/(tabs)/recipe-search');
      
      // Wait a moment for the tab to load, then trigger the search
      setTimeout(() => {
        // The recipe-search screen will need to accept these params
        // You can use expo-router's useLocalSearchParams to receive them
        router.setParams({
          searchQuery: searchQuery,
          autoSearch: 'true'
        });
      }, 300);
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Could not navigate to recipe search');
    }
  };

  // NEW: Handle back button press to navigate to homepage
  const handleBackPress = () => {
    router.back();
  };

  return (
    <AuthGuard>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        {/* Header */}
        <PantryHeader 
          onSearchPress={() => setSearchModalVisible(true)}
          onBackPress={handleBackPress}
        />

        {/* Selection Mode Header */}
        {selectionMode && (
          <SelectionModeHeader
            selectedCount={selectedItems.length}
            onCancel={exitSelectionMode}
            onAddToGroup={handleAddToGroup}
            onFindRecipe={handleFindRecipe}
            isDisabled={selectedItems.length === 0}
          />
        )}

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Expiring Items Banner */}
          <ExpiringItemsBanner
            expiringItems={expiringItems}
            onItemPress={handleItemPress}
            onViewAll={handleViewAllExpiring}
            onDeleteAllExpired={handleDeleteAllExpired}
          />

          {/* Inventory Groups Section */}
          <InventoryGroupsSection
            groups={groups}
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
            highlightedItemId={highlightedItemId}
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

        {/* Group Items Modal */}
        <GroupItemsModal
          visible={groupItemsModalVisible}
          onClose={() => {
            setGroupItemsModalVisible(false);
            setSelectedGroup(null);
          }}
          group={selectedGroup}
          onItemPress={handleItemPress}
          onEditGroup={() => {
            setEditingGroup(selectedGroup);
            setGroupFormVisible(true);
          }}
          onDeleteGroup={() => handleDeleteGroup(selectedGroup)}
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
  scrollViewContent: {
    paddingBottom: 100, // Add space at bottom for navbar
  },
});

export default Pantry;
