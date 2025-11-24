import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Text,
  View,
  Platform,
  Animated,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCustomAuth } from '../../hooks/use-custom-auth';
import AuthGuard from '../../components/auth-guard';
import PantryService from '../../services/pantry-service';
import ExpirationNotificationService from '../../services/expiration-notification-service';
import BackgroundNotificationRefresh from '../../services/background-notification-refresh';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useTabContext } from '../../contexts/tab-context';

// Components
import PantryHeader from '../../components/pantry/pantry-header';
import SelectionModeHeader from '../../components/pantry/selection-mode-header';
import InventoryGroupsSection from '../../components/pantry/inventory-groups-section';
import PantryItemsGrid from '../../components/pantry/pantry-items-grid';
import ItemFormModal from '../../components/pantry/item-form-modal';
import GroupFormModal from '../../components/pantry/group-form-modal';
import GroupItemsModal from '../../components/pantry/group-items-modal';
import SearchFilterModal from '../../components/pantry/search-filter-modal-v2';
import ExpiringItemsBanner from '../../components/pantry/expiring-items-banner';
import AppAlert from '../../components/common/app-alert';
import PantryAlert, { AnimatedButton } from '../../components/pantry/pantry-alert';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SousChefAIService from '../../services/souschef-ai-service';

// Category icon mapping for consistent icon usage across alerts
const getCategoryIcon = (category, size = 64, color = '#81A969') => {
  const categoryIconMap = {
    // Cooked/Prepared Food
    'Rice': 'rice',
    'Soup': 'bowl-mix',
    'Leftovers': 'food-drumstick',
    'Kakanin': 'food',
    // Raw Ingredients
    'Baking': 'cake',
    'Beverages': 'coffee-outline',
    'Canned': 'canned-food',
    'Jarred': 'jar-outline',
    'Condiments': 'bottle-tonic',
    'Sauces': 'soy-sauce',
    'Dairy': 'cow',
    'Eggs': 'egg-outline',
    'Fruits': 'food-apple-outline',
    'Frozen': 'snowflake',
    'Grains': 'barley',
    'Pasta': 'pasta',
    'Noodles': 'noodles',
    'Meat': 'food-steak',
    'Poultry': 'food-drumstick-outline',
    'Seafood': 'fish',
    'Snacks': 'cookie-outline',
    'Spices': 'shaker-outline',
    'Herbs': 'leaf',
    'Vegetables': 'carrot',
    'Other': 'help-circle-outline',
  };
  const iconName = categoryIconMap[category] || 'help-circle-outline';
  return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
};

/**
 * Pantry Screen - Database Integrated
 * Manages user's pantry items and inventories with Supabase
 */
const Pantry = () => {
  const { user, customUserData } = useCustomAuth();
  const params = useLocalSearchParams();
  const scrollViewRef = useRef(null);
  const inventoryGroupsRef = useRef(null);
  const router = useRouter();
  const { subscribe } = useTabContext();

  // State
  const [inventories, setInventories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const [showSelectionHeader, setShowSelectionHeader] = useState(false);
  const [isExitingSelection, setIsExitingSelection] = useState(false);
  const [showFAB, setShowFAB] = useState(false);

  // Expiring items
  const [expiringItems, setExpiringItems] = useState([]);
  const [notificationSummary, setNotificationSummary] = useState(null);

  // Alert state
  const [alert, setAlert] = useState({ visible: false, type: 'info', message: '', title: null, onAction: null, actionLabel: 'OK' });
  const [duplicateAlert, setDuplicateAlert] = useState({ visible: false, existingItem: null, incomingItem: null, mergeAvailable: false, resolve: null });
  const [deleteAlert, setDeleteAlert] = useState({ visible: false, item: null, expired: false });
  const [deleteExpiredAlert, setDeleteExpiredAlert] = useState({ visible: false, count: 0, items: [] });
  const [itemMenuAlert, setItemMenuAlert] = useState({ visible: false, item: null });
  const [groupSelectionAlert, setGroupSelectionAlert] = useState({ visible: false, message: '', groups: [], onSelectGroup: null });
  const [deleteGroupAlert, setDeleteGroupAlert] = useState({ visible: false, group: null });
  // Recipe Confirmation Alert
  const [recipeConfirmationAlert, setRecipeConfirmationAlert] = useState({
    visible: false,
    type: '', // 'find' or 'generate'
    items: [],
  });
  // Expired Selection Alert
  const [expiredSelectionAlert, setExpiredSelectionAlert] = useState({ visible: false, items: [] });
  // Discard Reminder Alert
  const [discardReminderAlert, setDiscardReminderAlert] = useState({ visible: false, count: 0 });

  // FAB Animation
  const fabScale = useRef(new Animated.Value(0)).current;
  const fabTranslateY = useRef(new Animated.Value(0)).current;
  const fabOpacity = useRef(new Animated.Value(0)).current;
  const floatingAnimation = useRef(null);
  // FAB Switch Animation (0 = Main Button, 1 = Options)
  const fabSwitchAnim = useRef(new Animated.Value(0)).current;
  const [fabOptionsVisible, setFabOptionsVisible] = useState(false);

  // Header Animation
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const headerTranslateY = useRef(new Animated.Value(0)).current;

  // Initialize notifications on mount
  useEffect(() => {
    initializeNotifications();
  }, []);

  // Handle tab press events (scroll to top and cleanup)
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type === 'tabPress' && event.isAlreadyActive && event.route.includes('pantry')) {
        // Scroll to top immediately
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: true });
        }

        // Reset horizontal groups scroll
        if (inventoryGroupsRef.current) {
          inventoryGroupsRef.current.scrollToStart();
        }

        // Cleanup selection mode and modals with a tiny delay to allow scroll to start
        // This ensures the "reset" animation happens while scrolling
        setTimeout(() => {
          setSelectionMode(false);
          setSelectedItems([]);
          setSearchModalVisible(false);
          setItemFormVisible(false);
          setGroupFormVisible(false);
          setGroupItemsModalVisible(false);
          setHighlightedItemId(null);
        }, 50);
      }
    });
    return unsubscribe;
  }, [subscribe]);

  // Load data on mount
  useEffect(() => {
    if (customUserData?.userID) {
      console.log('✅ User ID available:', customUserData.userID);
      loadData();
    } else {
      console.log('⚠️ No user ID available yet');
    }
  }, [customUserData]);

  // Refresh data when screen comes into focus (e.g., after cooking)
  useFocusEffect(
    React.useCallback(() => {
      if (customUserData?.userID) {
        console.log('🔄 Pantry screen focused - refreshing data...');
        loadData();
      }
    }, [customUserData?.userID])
  );

  // Header entrance/exit animation based on selection mode
  useEffect(() => {
    if (selectionMode) {
      // Entering selection mode
      setIsExitingSelection(false);
      setShowSelectionHeader(true);

      // Hide main header - only fade, no translate
      Animated.timing(headerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      // Exiting selection mode
      if (showSelectionHeader) {
        setIsExitingSelection(true);

        // Wait for exit animation to complete before hiding
        setTimeout(() => {
          setShowSelectionHeader(false);
          setIsExitingSelection(false);
        }, 280);
      }

      // Show main header - only fade, no translate
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [selectionMode]);

  // FAB entrance/exit animation with continuous floating
  useEffect(() => {
    const shouldShow = selectionMode && selectedItems.length > 0;

    if (shouldShow) {
      // Show FAB and start entrance animation
      setShowFAB(true);

      // Entrance animation - fast and smooth with opacity
      Animated.parallel([
        Animated.spring(fabScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 7,
          delay: 200,
        }),
        Animated.timing(fabOpacity, {
          toValue: 1,
          duration: 300,
          delay: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Start continuous floating animation after entrance
        floatingAnimation.current = Animated.loop(
          Animated.sequence([
            Animated.timing(fabTranslateY, {
              toValue: -12,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(fabTranslateY, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            }),
          ])
        );
        floatingAnimation.current.start();
      });
    } else if (showFAB) {
      // Stop floating animation immediately
      if (floatingAnimation.current) {
        floatingAnimation.current.stop();
      }

      // Exit animation - scale down, slide down, and fade out
      Animated.parallel([
        Animated.spring(fabScale, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(fabTranslateY, {
          toValue: 50,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fabOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Reset values and hide after exit
        fabScale.setValue(0);
        fabTranslateY.setValue(0);
        fabOpacity.setValue(0);
        setShowFAB(false);
        // Reset switch state
        if (fabOptionsVisible) {
          fabSwitchAnim.setValue(0);
          setFabOptionsVisible(false);
        }
      });
    }

    return () => {
      if (floatingAnimation.current) {
        floatingAnimation.current.stop();
      }
    };
  }, [selectionMode, selectedItems.length]);

  // When selection items count changes, close options automatically if no items
  useEffect(() => {
    if (!selectionMode || selectedItems.length === 0) {
      if (fabOptionsVisible) {
        setFabOptionsVisible(false);
        fabSwitchAnim.setValue(0);
      }
    }
  }, [selectionMode, selectedItems.length, fabOptionsVisible]);

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

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Load inventories and items
  const loadData = async () => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
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
            inventoryColor: '#81A969',
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
      showAlert('error', 'Failed to load pantry data', 'Error');
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
          inventoryColor: '#81A969',
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
          showAlert(
            'error',
            'Please verify your account via OTP to start using the pantry. Check your email for the verification code.',
            'Account Not Verified',
            true
          );
        } else {
          showAlert('error', 'Failed to create inventory. Please try again.', 'Error', true);
        }
        return null;
      }
    }
    return inventories[0].inventoryID;
  };

  const showAlert = (type, message, title = null, actionable = false, actionLabel = 'OK', onAction = null) => {
    setAlert({ visible: true, type, message, title, actionable, actionLabel, onAction });
  };

  const hideAlert = () => {
    setAlert({ visible: false, type: 'info', message: '', title: null, onAction: null, actionLabel: 'OK' });
  };

  const normalizeItemName = (name = '') => name.trim().toLowerCase();

  const findDuplicateItem = (candidateName, candidateInventoryID) => {
    if (!candidateName || !candidateInventoryID) return null;
    const targetInventoryId = String(candidateInventoryID);
    const normalizedName = normalizeItemName(candidateName);
    return items.find((item) =>
      String(item.inventoryID) === targetInventoryId &&
      normalizeItemName(item.itemName || '') === normalizedName
    );
  };

  const canMergeDuplicateItems = (existingItem, incomingItem) => {
    const existingUnit = (existingItem.unit || '').trim().toLowerCase();
    const incomingUnit = (incomingItem.unit || '').trim().toLowerCase();
    const existingQty = Number(existingItem.quantity);
    const incomingQty = Number(incomingItem.quantity);
    const quantitiesValid = !Number.isNaN(existingQty) && !Number.isNaN(incomingQty);
    return quantitiesValid && existingQty >= 0 && incomingQty >= 0 && existingUnit === incomingUnit;
  };

  const promptDuplicateResolution = (existingItem, incomingItem, mergeAvailable) =>
    new Promise((resolve) => {
      setDuplicateAlert({ visible: true, existingItem, incomingItem, mergeAvailable, resolve });
    });

  const mergeDuplicateItem = async (existingItem, incomingItem) => {
    const existingQty = Number(existingItem.quantity) || 0;
    const incomingQty = Number(incomingItem.quantity) || 0;
    const mergedQty = existingQty + incomingQty;
    const updates = {
      quantity: mergedQty,
      userID: customUserData.userID,
    };

    if (incomingItem.itemDescription && incomingItem.itemDescription !== existingItem.itemDescription) {
      updates.itemDescription = incomingItem.itemDescription;
    }

    if (incomingItem.itemExpiration) {
      const existingDate = existingItem.itemExpiration ? new Date(existingItem.itemExpiration) : null;
      const incomingDate = new Date(incomingItem.itemExpiration);
      if (!existingDate || (incomingDate instanceof Date && !Number.isNaN(incomingDate.getTime()) && incomingDate < existingDate)) {
        updates.itemExpiration = incomingItem.itemExpiration;
      }
    }

    await PantryService.updateItem(existingItem.itemID, updates);
    showAlert(
      'success',
      `Updated "${existingItem.itemName}" to ${mergedQty} ${existingItem.unit || ''}`.trim(),
      'Duplicate Merged',
      true
    );
  };

  // Handle save item
  const handleSaveItem = async (itemData) => {
    try {
      console.log('💾 Saving item...', itemData);
      const wasEditing = !!editingItem;
      const editingItemSnapshot = editingItem;
      let newlyCreatedItem = null;

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

        showAlert('success', 'Item updated successfully', 'Success', true);
      } else {
        // Create new item
        console.log('➕ Creating new item...');

        // Ensure we have an inventory
        const ensuredInventoryID = await ensureInventoryExists();
        console.log('📦 Inventory ID:', ensuredInventoryID);

        if (!ensuredInventoryID) {
          console.log('❌ No inventory ID available');
          return;
        }

        const resolvedInventoryID = itemData.inventoryID || ensuredInventoryID;
        const potentialDuplicate = findDuplicateItem(itemData.itemName, resolvedInventoryID);
        
        // Check for duplicate without forceSave flag
        if (potentialDuplicate && !itemData.forceSave) {
          console.log('⚠️ Duplicate found:', potentialDuplicate);
          const mergeAvailable = canMergeDuplicateItems(potentialDuplicate, itemData);
          // Return duplicate status to modal instead of showing alert here
          return {
            status: 'duplicate-detected',
            existingItem: potentialDuplicate,
            incomingItem: itemData,
            mergeAvailable: mergeAvailable
          };
        }

        // Handle forced save after duplicate resolution
        if (potentialDuplicate && itemData.forceSave) {
          console.log('⚠️ Duplicate found but forceSave is true');
          const mergeAvailable = canMergeDuplicateItems(potentialDuplicate, itemData);
          const duplicateAction = itemData.duplicateAction || 'cancel';
          
          if (duplicateAction === 'merge' && mergeAvailable) {
            await mergeDuplicateItem(potentialDuplicate, itemData);
            await loadData();
            setItemFormVisible(false);
            return { status: 'duplicate-merged', item: potentialDuplicate };
          }
          // Otherwise user chose to create anyway
          console.log('⚠️ Duplicate detected - user opted to create another entry');
        }

        const itemToCreate = {
          ...itemData,
          inventoryID: resolvedInventoryID,
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

        showAlert('success', 'Item added successfully', 'Success', true);
        newlyCreatedItem = createdItem;
      }

      // Reload data
      console.log('🔄 Reloading pantry data...');
      await loadData();
      setEditingItem(null);
      setItemFormVisible(false);
      return {
        status: wasEditing ? 'updated' : 'created',
        item: wasEditing ? editingItemSnapshot : newlyCreatedItem,
      };
    } catch (error) {
      console.error('❌ Error saving item:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      showAlert('error', error.message || 'Failed to save item', 'Error', true);
      return { status: 'error', error };
    }
  };

  // NEW: Check for groups with matching category and prompt user
  const checkAndPromptForCategoryGroup = async (item, context = 'default') => {
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
        setGroupSelectionAlert({
          visible: true,
          message: `This ${item.itemCategory} item matches your "${group.groupTitle}" group.\n\nWould you like to add it?`,
          groups: [group],
          singleGroupMode: true,
          onSelectGroup: async (selectedGroup) => {
            try {
              await PantryService.addItemToGroup(item.itemID, selectedGroup.groupID);
              showAlert(
                'success',
                `"${item.itemName}" has been added to "${selectedGroup.groupTitle}"`,
                'Added',
                true
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
          onCancel: () => resolve(),
        });
      } else {
        // Multiple matching groups - let user choose
        const message = context === 'after-duplicate-merge'
          ? `Merged with existing item. Add to a ${item.itemCategory} group?`
          : `You have ${matchingGroups.length} groups for ${item.itemCategory} items.\n\nAdd "${item.itemName}" to one?`;

        setGroupSelectionAlert({
          visible: true,
          message,
          groups: matchingGroups,
          onSelectGroup: async (group) => {
            try {
              await PantryService.addItemToGroup(item.itemID, group.groupID);
              showAlert(
                'success',
                `"${item.itemName}" has been added to "${group.groupTitle}"`,
                'Added',
                true
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
          onCancel: () => resolve(),
        });
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
    setDeleteAlert({ visible: true, item, expired });
  };

  // Handle delete all expired items
  const handleDeleteAllExpired = async () => {
    const expiredItems = items.filter(item => isItemExpired(item));

    if (expiredItems.length === 0) {
      showAlert('info', 'There are no expired items to delete.', 'No Expired Items', true);
      return;
    }

    setDeleteExpiredAlert({ visible: true, count: expiredItems.length, items: expiredItems });
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

      // Show item details with custom category icon
      setItemMenuAlert({ visible: true, item });
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
    setItemMenuAlert({ visible: true, item });
  };

  // Toggle item selection
  const toggleItemSelection = (itemID) => {
    setSelectedItems(prev => {
      const newSelectedItems = prev.includes(itemID)
        ? prev.filter(id => id !== itemID)
        : [...prev, itemID];

      // 💡 If no items are selected, exit selection mode
      if (newSelectedItems.length === 0) {
        setSelectionMode(false);
      }

      return newSelectedItems;
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
      showAlert('info', 'Please select items to add to a group', 'No Items Selected', true);
      return;
    }

    if (groups.length === 0) {
      setGroupSelectionAlert({
        visible: true,
        message: 'Please create a group first before adding items.',
        groups: [],
        onSelectGroup: handleCreateGroup,
      });
      return;
    }

    // Show group selection dialog
    setGroupSelectionAlert({
      visible: true,
      message: `Select a group to add ${selectedItems.length} item(s)`,
      groups: groups,
      onSelectGroup: async (group) => {
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
            showAlert(
              'info',
              `${alreadyInGroupCount === 1 ? 'This item is' : 'All selected items are'} already in "${group.groupTitle}".\n\n${alreadyInGroupItems.join(', ')}`,
              'Already in Group',
              true
            );
          } else if (alreadyInGroupCount > 0) {
            // Some items already in group
            showAlert(
              'info',
              `${addedCount} item(s) added to "${group.groupTitle}".\n\n${alreadyInGroupCount} item(s) were already in this group: ${alreadyInGroupItems.join(', ')}`,
              'Partially Added',
              true
            );
          } else {
            // All items added successfully
            showAlert(
              'success',
              `${addedCount} item(s) added to "${group.groupTitle}"`,
              'Success',
              true
            );
          }

          // Exit selection mode and reload data
          exitSelectionMode();
          await loadData();
        } catch (error) {
          console.error('Error adding items to group:', error);
          showAlert('error', 'Failed to add items to group', 'Error', true);
        }
      },
    });
  };

  // 💡 NEW: Handle deleting multiple selected items
  const handleDeleteSelectedItems = () => {
    if (selectedItems.length === 0) {
      showAlert('info', 'Please select items to delete', 'No Items Selected', true);
      return;
    }

    setDeleteAlert({ visible: true, item: { itemName: `${selectedItems.length} selected item(s)`, bulk: true }, expired: false });
  };

  // Handle group press
  const handleGroupPress = (group) => {
    setSelectedGroup(group);
    setGroupItemsModalVisible(true);
  };

  // Handle delete group
  const handleDeleteGroup = (group) => {
    setDeleteGroupAlert({ visible: true, group });
  };

  // Handle save group - now saves groupCategory to database
  const handleSaveGroup = async (groupData) => {
    try {
      if (editingGroup) {
        // Update existing group (including groupCategory)
        await PantryService.updateGroup(editingGroup.groupID, groupData);
        showAlert('success', 'Group updated successfully', 'Success', true);
      } else {
        // Create new group (including groupCategory)
        await PantryService.createGroup(customUserData.userID, groupData);
        showAlert('success', 'Group created successfully', 'Success', true);
      }

      await loadData();
      setEditingGroup(null);
    } catch (error) {
      console.error('Error saving group:', error);
      showAlert('error', 'Failed to save group', 'Error', true);
    }
  };

  // Handle create group
  const handleCreateGroup = () => {
    setEditingGroup(null);
    setGroupFormVisible(true);
  };

  // Handle search result selection
  // Handle view all expiring items
  const handleViewAllExpiring = () => {
    setSearchModalVisible(true);
    // The modal will open with "Expiring Soon" filter pre-applied
  };

  // Handle find recipe with selected items
  const handleFindRecipe = () => {
    if (selectedItems.length === 0) {
      showAlert('info', 'Please select items to find recipes', 'No Items Selected', true);
      return;
    }

    // Check for expired items
    if (checkForExpiredSelection()) return;

    // Get the selected item names
    const selectedItemNames = items
      .filter(item => selectedItems.includes(item.itemID))
      .map(item => item.itemName);

    if (selectedItemNames.length === 0) {
      showAlert('error', 'Could not find selected items', 'Error', true);
      return;
    }

    setRecipeConfirmationAlert({
      visible: true,
      type: 'find',
      items: selectedItemNames,
    });
  };

  // Generate a recipe using ONLY selected items as main ingredients (no pantry augmentation)
  const handleGenerateRecipeFromSelection = () => {
    if (selectedItems.length === 0) {
      showAlert('info', 'Select items first to generate a recipe', 'No Items Selected', true);
      return;
    }

    // Check for expired items
    if (checkForExpiredSelection()) return;

    const selectedItemNames = items
      .filter(item => selectedItems.includes(item.itemID))
      .map(item => item.itemName);
    if (selectedItemNames.length === 0) {
      showAlert('error', 'Could not find selected items', 'Error', true);
      return;
    }
    
    setRecipeConfirmationAlert({
      visible: true,
      type: 'generate',
      items: selectedItemNames,
    });
  };

  // Check if any selected items are expired
  const checkForExpiredSelection = () => {
    const selectedItemObjects = items.filter(item => selectedItems.includes(item.itemID));
    const expired = selectedItemObjects.filter(item => isItemExpired(item));
    
    if (expired.length > 0) {
      setExpiredSelectionAlert({ visible: true, items: expired });
      return true;
    }
    return false;
  };

  // Handle deleting expired items from selection
  const handleDeleteExpiredSelection = async () => {
    const itemsToDelete = expiredSelectionAlert.items;
    try {
      console.log(`Deleting ${itemsToDelete.length} expired items from selection...`);
      await Promise.all(itemsToDelete.map(item => PantryService.deleteItem(item.itemID)));
      
      // Remove from selected items
      const deletedIds = itemsToDelete.map(i => i.itemID);
      setSelectedItems(prev => prev.filter(id => !deletedIds.includes(id)));
      
      await loadData();
      
      setExpiredSelectionAlert({ visible: false, items: [] });
      // Show discard reminder
      setTimeout(() => {
        setDiscardReminderAlert({ visible: true, count: itemsToDelete.length });
      }, 300);
      
    } catch (error) {
      console.error("Failed to delete expired items", error);
      showAlert('error', 'Failed to delete items', 'Error', true);
    }
  };

  const executeRecipeAction = async () => {
    const { type, items: selectedItemNames } = recipeConfirmationAlert;
    const searchQuery = selectedItemNames.join(', ');
    
    // Close alert and exit selection mode
    setRecipeConfirmationAlert({ visible: false, type: '', items: [] });
    exitSelectionMode();

    try {
      router.push('/(tabs)/recipe-search');
      
      setTimeout(() => {
        if (type === 'find') {
          router.setParams({
            searchQuery: searchQuery,
            autoSearch: 'true',
            isDeconstructed: 'true',
            includePantry: 'true'
          });
        } else {
          router.setParams({
            searchQuery,
            autoGenerate: 'true',
            generationMode: 'selected-only'
          });
        }
      }, 300);
    } catch (error) {
      console.error('Navigation error:', error);
      showAlert('error', 'Could not navigate to recipe search', 'Error', true);
    }
  };

  // Handle back button press to navigate to homepage
  const handleBackPress = () => {
    router.back();
  };

  return (
    <AuthGuard>
      {/* 💡 WRAP in a standard View. This is now the positioning parent for the FAB. */}
      <View style={styles.container}>
        {/* 💡 Apply a new style to SafeAreaView */}
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />

          {/* CONDITIONAL HEADER */}
          {showSelectionHeader && (
            <SelectionModeHeader
              selectedCount={selectedItems.length}
              onCancel={exitSelectionMode}
              onAddToGroup={handleAddToGroup}
              onDeleteSelected={handleDeleteSelectedItems}
              isDisabled={selectedItems.length === 0}
              isExiting={isExitingSelection}
            />
          )}

          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#81A969']}
                tintColor="#81A969"
                title="Pull to refresh"
                titleColor="#999"
              />
            }
          >
            <Animated.View
              style={{
                opacity: headerOpacity,
              }}
              pointerEvents={selectionMode ? 'none' : 'auto'}
            >
              <PantryHeader onSearchPress={() => setSearchModalVisible(true)} />
            </Animated.View>

            <ExpiringItemsBanner
              expiringItems={expiringItems}
              onItemPress={handleItemPress}
              onViewAll={handleViewAllExpiring}
              onDeleteAllExpired={handleDeleteAllExpired}
            />

            <View style={styles.groupsSectionSpacer}>
              <InventoryGroupsSection
                ref={inventoryGroupsRef}
                groups={groups}
                onGroupPress={handleGroupPress}
                onCreateGroup={handleCreateGroup}
                userName={customUserData?.userName || user?.user_metadata?.name || 'My'}
              />
            </View>

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

          <SearchFilterModal
            visible={searchModalVisible}
            onClose={() => setSearchModalVisible(false)}
            items={items}
            groups={groups}
            inventories={inventories}
            onItemPress={handleItemPress}
            onGroupPress={handleGroupPress}
            userName={customUserData?.firstName || 'My'}
          />

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

          <GroupFormModal
            visible={groupFormVisible}
            onClose={() => {
              setGroupFormVisible(false);
              setEditingGroup(null);
            }}
            onSave={handleSaveGroup}
            initialData={editingGroup}
          />

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

        {/* 💡 FAB (FIXED) - Sibling to SafeAreaView, positioned by container */}
        {showFAB && (
          <View style={styles.fabContainer}>
            <Animated.View
              style={{
                transform: [
                  { scale: fabScale },
                  { translateY: fabTranslateY }
                ],
                opacity: fabOpacity,
                alignItems: 'flex-end', // Align children to right
              }}
            >
              {/* Primary FAB - Fades out when options open */}
              <Animated.View
                style={{
                  opacity: fabSwitchAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0]
                  }),
                  transform: [
                    { scale: fabSwitchAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0.8]
                      }) 
                    }
                  ],
                  position: fabOptionsVisible ? 'absolute' : 'relative', // Take out of flow when hidden
                  zIndex: fabOptionsVisible ? 0 : 2,
                  pointerEvents: fabOptionsVisible ? 'none' : 'auto',
                }}
              >
                <TouchableOpacity
                  style={styles.fab}
                  onPress={() => {
                    setFabOptionsVisible(true);
                    Animated.spring(fabSwitchAnim, {
                      toValue: 1,
                      useNativeDriver: true,
                      tension: 60,
                      friction: 8
                    }).start();
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="sparkles-outline" size={24} color="#fff" />
                  <Text style={styles.fabText}>Prepare a Recipe?</Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Expanded Options - Fade in when main button clicked */}
              <Animated.View
                style={{
                  opacity: fabSwitchAnim,
                  transform: [
                    { translateY: fabSwitchAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0]
                      }) 
                    },
                    { scale: fabSwitchAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1]
                      })
                    }
                  ],
                  position: fabOptionsVisible ? 'relative' : 'absolute',
                  zIndex: fabOptionsVisible ? 2 : 0,
                  pointerEvents: fabOptionsVisible ? 'auto' : 'none',
                }}
              >
                <View style={styles.fabOptionsWrapper}>
                  <TouchableOpacity
                    style={[styles.fab, styles.fabOption]}
                    onPress={handleFindRecipe}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="restaurant-outline" size={22} color="#fff" />
                    <Text style={styles.fabText}>Find a Recipe</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.fab, styles.fabOption]}
                    onPress={handleGenerateRecipeFromSelection}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="flame-outline" size={22} color="#fff" />
                    <Text style={styles.fabText}>Generate a Recipe</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </Animated.View>
          </View>
        )}
      </View>

      <PantryAlert
        visible={alert.visible}
        type={alert.type}
        message={alert.message}
        title={alert.title}
        actionable={alert.actionable}
        actionLabel={alert.actionLabel}
        onAction={alert.onAction}
        onClose={() => setTimeout(hideAlert, 1)}
      />

      {/* Duplicate Alert */}
      <PantryAlert
        visible={duplicateAlert.visible}
        type="info"
        title="Duplicate Item Detected"
        message={duplicateAlert.existingItem ? `"${duplicateAlert.existingItem.itemName}" already exists (${duplicateAlert.existingItem.quantity || 0} ${duplicateAlert.existingItem.unit || ''}).\n${duplicateAlert.mergeAvailable ? 'Merge quantities or add a separate entry?' : 'Units differ; merge unavailable. Add a separate entry?'} ` : ''}
        customIcon={duplicateAlert.existingItem ? getCategoryIcon(duplicateAlert.existingItem.itemCategory) : null}
        onClose={() => {
          if (duplicateAlert.resolve) duplicateAlert.resolve('cancel');
          setTimeout(() => setDuplicateAlert({ visible: false, existingItem: null, incomingItem: null, mergeAvailable: false, resolve: null }), 50);
        }}
        hideCloseButton={true}
      >
        <View style={{ width: '100%', marginTop: 12, gap: 10 }}>
          {duplicateAlert.mergeAvailable && (
            <AnimatedButton
              style={{
                backgroundColor: '#81A969',
                paddingVertical: 12,
                borderRadius: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3
              }}
              onPress={() => {
                if (duplicateAlert.resolve) duplicateAlert.resolve('merge');
                setDuplicateAlert({ visible: false, existingItem: null, incomingItem: null, mergeAvailable: false, resolve: null });
              }}
            >
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>Merge Quantities</Text>
            </AnimatedButton>
          )}
          <AnimatedButton
            style={{
              backgroundColor: duplicateAlert.mergeAvailable ? '#fff' : '#81A969',
              borderWidth: duplicateAlert.mergeAvailable ? 2 : 0,
              borderColor: '#81A969',
              paddingVertical: 12,
              borderRadius: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2
            }}
            onPress={() => {
              if (duplicateAlert.resolve) duplicateAlert.resolve('create');
              setDuplicateAlert({ visible: false, existingItem: null, incomingItem: null, mergeAvailable: false, resolve: null });
            }}
          >
            <Text style={{
              color: duplicateAlert.mergeAvailable ? '#81A969' : '#fff',
              textAlign: 'center',
              fontWeight: '700',
              fontSize: 16
            }}>Add Anyway</Text>
          </AnimatedButton>
          <TouchableOpacity
            style={{
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#ccc',
              backgroundColor: '#fff',
            }}
            onPress={() => {
              if (duplicateAlert.resolve) duplicateAlert.resolve('cancel');
              setDuplicateAlert({ visible: false, existingItem: null, incomingItem: null, mergeAvailable: false, resolve: null });
            }}
          >
            <Text style={{ color: '#666', textAlign: 'center', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </PantryAlert>

      {/* Delete Item Alert */}
      <PantryAlert
        visible={deleteAlert.visible}
        type="error"
        title={deleteAlert.expired ? 'Delete Expired Item' : 'Delete Item'}
        message={deleteAlert.item ? (deleteAlert.item.bulk ? `Are you sure you want to delete ${deleteAlert.item.itemName}?` : `${deleteAlert.expired ? `"${deleteAlert.item.itemName}" has expired. Do you want to delete it?` : `Are you sure you want to delete "${deleteAlert.item.itemName}"?`}`) : ''}
        customIcon={deleteAlert.item && !deleteAlert.item.bulk ? getCategoryIcon(deleteAlert.item.itemCategory) : null}
        onClose={() => setTimeout(() => setDeleteAlert({ visible: false, item: null, expired: false }), 50)}
        hideCloseButton={true}
      >
        <View style={{ width: '100%', marginTop: 20, gap: 12 }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#dc3545',
              paddingVertical: 16,
              borderRadius: 12,
              shadowColor: '#dc3545',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 4
            }}
            onPress={async () => {
              try {
                if (deleteAlert.item?.bulk) {
                  console.log(`Deleting ${selectedItems.length} items...`);
                  await Promise.all(selectedItems.map(itemID => PantryService.deleteItem(itemID)));
                  showAlert('success', `Deleted ${selectedItems.length} item(s)`, 'Success', true);
                  exitSelectionMode();
                } else {
                  await PantryService.deleteItem(deleteAlert.item?.itemID);
                  showAlert('success', 'Item deleted successfully', 'Success', true);
                }
                await loadData();
              } catch (error) {
                console.error('Error deleting item:', error);
                showAlert('error', 'Failed to delete item', 'Error', true);
              }
              setDeleteAlert({ visible: false, item: null, expired: false });
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              paddingVertical: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#ccc',
              backgroundColor: '#fff',
            }}
            onPress={() => setDeleteAlert({ visible: false, item: null, expired: false })}
          >
            <Text style={{ color: '#666', textAlign: 'center', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </PantryAlert>

      {/* Delete Expired Items Alert */}
      <PantryAlert
        visible={deleteExpiredAlert.visible}
        type="error"
        title="Delete All Expired Items"
        message={`Found ${deleteExpiredAlert.count} expired item(s). Delete all of them?`}
        onClose={() => setTimeout(() => setDeleteExpiredAlert({ visible: false, count: 0, items: [] }), 50)}
        hideCloseButton={true}
      >
        <View style={{ width: '100%', marginTop: 20, gap: 12 }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#dc3545',
              paddingVertical: 16,
              borderRadius: 12,
              shadowColor: '#dc3545',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 4
            }}
            onPress={async () => {
              try {
                console.log(`Deleting ${deleteExpiredAlert.items.length} expired items...`);
                await Promise.all(deleteExpiredAlert.items.map(item => PantryService.deleteItem(item.itemID)));
                await loadData();
                showAlert('success', `Deleted ${deleteExpiredAlert.items.length} expired item(s) successfully`, 'Success', true);
              } catch (error) {
                console.error('Error deleting expired items:', error);
                showAlert('error', 'Failed to delete some expired items', 'Error', true);
              }
              setDeleteExpiredAlert({ visible: false, count: 0, items: [] });
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>Delete {deleteExpiredAlert.count} Item(s)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              paddingVertical: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#ccc',
              backgroundColor: '#fff',
            }}
            onPress={() => setDeleteExpiredAlert({ visible: false, count: 0, items: [] })}
          >
            <Text style={{ color: '#666', textAlign: 'center', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </PantryAlert>

      {/* Item Menu Alert */}
      <PantryAlert
        visible={itemMenuAlert.visible}
        type="info"
        title="Item Actions"
        message={itemMenuAlert.item ? `What would you like to do with \"${itemMenuAlert.item.itemName}\"?` : 'What would you like to do?'}
        customIcon={itemMenuAlert.item ? getCategoryIcon(itemMenuAlert.item.itemCategory) : null}
        onClose={() => setItemMenuAlert(prev => ({ ...prev, visible: false }))}
        hideCloseButton={true}
      >
        <View style={{ width: '100%', marginTop: 12, gap: 10 }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#81A969',
              paddingVertical: 12,
              borderRadius: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3
            }}
            onPress={() => {
              setItemMenuAlert({ visible: false, item: null });
              setSelectedItems([itemMenuAlert.item.itemID]);
              // Use setTimeout to ensure state update completes before calling handleAddToGroup
              setTimeout(() => {
                handleAddToGroup();
              }, 0);
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>Add to Group</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: '#fff',
              borderWidth: 2,
              borderColor: '#81A969',
              paddingVertical: 12,
              borderRadius: 12
            }}
            onPress={() => {
              setEditingItem(itemMenuAlert.item);
              setItemFormVisible(true);
              setItemMenuAlert({ visible: false, item: null });
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#81A969', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: '#fff',
              borderWidth: 2,
              borderColor: '#dc3545',
              paddingVertical: 12,
              borderRadius: 12
            }}
            onPress={() => {
              handleDeleteItem(itemMenuAlert.item);
              setItemMenuAlert({ visible: false, item: null });
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#dc3545', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#ccc',
              backgroundColor: '#fff',
            }}
            onPress={() => setItemMenuAlert(prev => ({ ...prev, visible: false }))}
          >
            <Text style={{ color: '#666', textAlign: 'center', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </PantryAlert>

      {/* Group Selection Alert */}
      <PantryAlert
        visible={groupSelectionAlert.visible}
        type="info"
        title={groupSelectionAlert.groups?.length === 0 ? 'No Groups Available' : 'Select Group'}
        message={groupSelectionAlert.message || ''}
        onClose={() => setTimeout(() => setGroupSelectionAlert({ visible: false, message: '', groups: [], onSelectGroup: null }), 50)}
        hideCloseButton={true}
      >
        <View style={{ width: '100%', marginTop: 20 }}>
          {groupSelectionAlert.groups?.length === 0 ? (
            <View style={{ gap: 12 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#81A969',
                  paddingVertical: 16,
                  borderRadius: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3
                }}
                onPress={() => {
                  if (groupSelectionAlert.onSelectGroup) groupSelectionAlert.onSelectGroup();
                  setGroupSelectionAlert({ visible: false, message: '', groups: [], onSelectGroup: null });
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>Create Group</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingVertical: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#ccc',
                  backgroundColor: '#fff',
                }}
                onPress={() => setGroupSelectionAlert({ visible: false, message: '', groups: [], onSelectGroup: null })}
              >
                <Text style={{ color: '#666', textAlign: 'center', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {groupSelectionAlert.groups?.map((group, index) => (
                <TouchableOpacity
                  key={group.groupID}
                  style={{
                    backgroundColor: '#81A969',
                    paddingVertical: 16,
                    borderRadius: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3
                  }}
                  onPress={() => {
                    if (groupSelectionAlert.onSelectGroup) groupSelectionAlert.onSelectGroup(group);
                    setGroupSelectionAlert({ visible: false, message: '', groups: [], onSelectGroup: null });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>
                    {groupSelectionAlert.singleGroupMode ? `Add to ${group.groupTitle}` : `${group.groupTitle} (${group.itemCount || 0} ${(group.itemCount || 0) === 1 ? 'item' : 'items'})`}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={{
                  paddingVertical: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#ccc',
                  backgroundColor: '#fff',
                }}
                onPress={() => setGroupSelectionAlert({ visible: false, message: '', groups: [], onSelectGroup: null })}
              >
                <Text style={{ color: '#666', textAlign: 'center', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </PantryAlert>

      {/* Delete Group Alert */}
      <PantryAlert
        visible={deleteGroupAlert.visible}
        type="error"
        title="Delete Group"
        message={deleteGroupAlert.group ? `Delete "${deleteGroupAlert.group.groupTitle}"? Choose whether to keep or delete the items in this group.` : ''}
        onClose={() => setTimeout(() => setDeleteGroupAlert({ visible: false, group: null }), 50)}
        hideCloseButton={true}
      >
        <View style={{ width: '100%', marginTop: 20, gap: 12 }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#81A969',
              paddingVertical: 16,
              borderRadius: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3
            }}
            onPress={async () => {
              try {
                await PantryService.deleteGroup(deleteGroupAlert.group.groupID, false);
                await loadData();
                showAlert('success', 'Group deleted (items kept)', 'Success', true);
              } catch (error) {
                console.error('Error deleting group:', error);
                showAlert('error', 'Failed to delete group', 'Error', true);
              }
              setDeleteGroupAlert({ visible: false, group: null });
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>Delete Group Only (Keep Items)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: '#dc3545',
              paddingVertical: 16,
              borderRadius: 12,
              shadowColor: '#dc3545',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 4
            }}
            onPress={async () => {
              try {
                await PantryService.deleteGroup(deleteGroupAlert.group.groupID, true);
                await loadData();
                showAlert('success', 'Group and items deleted', 'Success', true);
              } catch (error) {
                console.error('Error deleting group:', error);
                showAlert('error', 'Failed to delete group', 'Error', true);
              }
              setDeleteGroupAlert({ visible: false, group: null });
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>Delete Group & All Items</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              paddingVertical: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#ccc',
              backgroundColor: '#fff',
            }}
            onPress={() => setDeleteGroupAlert({ visible: false, group: null })}
          >
            <Text style={{ color: '#666', textAlign: 'center', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </PantryAlert>
      {/* Recipe Confirmation Alert */}
      <PantryAlert
        visible={recipeConfirmationAlert.visible}
        type="info"
        title={recipeConfirmationAlert.type === 'find' ? 'Find Recipes?' : 'Generate Recipe?'}
        message={`Are you sure you want to ${recipeConfirmationAlert.type === 'find' ? 'find recipes' : 'generate a recipe'} with these items?`}
        onClose={() => setRecipeConfirmationAlert({ visible: false, type: '', items: [] })}
        hideCloseButton={true}
      >
        <View style={{ width: '100%', marginTop: 10, maxHeight: 200 }}>
          <Text style={{ fontWeight: '600', marginBottom: 8, color: '#555' }}>Selected Ingredients:</Text>
          <ScrollView style={{ maxHeight: 150, backgroundColor: '#f9f9f9', borderRadius: 8, padding: 10 }}>
            {recipeConfirmationAlert.items.map((item, index) => (
              <Text key={index} style={{ fontSize: 15, color: '#333', marginBottom: 4 }}>• {item}</Text>
            ))}
          </ScrollView>
          
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
             <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#ccc',
                paddingVertical: 12,
                borderRadius: 12,
              }}
              onPress={() => setRecipeConfirmationAlert({ visible: false, type: '', items: [] })}
            >
              <Text style={{ color: '#666', textAlign: 'center', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: '#81A969',
                paddingVertical: 12,
                borderRadius: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3
              }}
              onPress={executeRecipeAction}
            >
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>
                {recipeConfirmationAlert.type === 'find' ? 'Find' : 'Generate'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </PantryAlert>

      {/* Expired Selection Alert */}
      <PantryAlert
        visible={expiredSelectionAlert.visible}
        type="error"
        title="Expired Items Detected"
        message={`You have selected ${expiredSelectionAlert.items.length} expired item(s). These cannot be used for recipes.`}
        hideCloseButton={true}
        onClose={() => {}} // Prevent closing by tapping outside
      >
         <View style={{ width: '100%', marginTop: 12, gap: 10 }}>
            <ScrollView style={{ maxHeight: 100, marginBottom: 10 }}>
                {expiredSelectionAlert.items.map(item => (
                    <Text key={item.itemID} style={{color: '#dc3545', fontWeight: '600', marginBottom: 4}}>• {item.itemName}</Text>
                ))}
            </ScrollView>
            <TouchableOpacity
                style={{
                  backgroundColor: '#dc3545',
                  paddingVertical: 16,
                  borderRadius: 12,
                  shadowColor: '#dc3545',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 4
                }}
                onPress={handleDeleteExpiredSelection}
                activeOpacity={0.8}
            >
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>
                    Delete {expiredSelectionAlert.items.length > 1 ? 'All ' : ''}Expired Item{expiredSelectionAlert.items.length > 1 ? 's' : ''}
                </Text>
            </TouchableOpacity>
         </View>
      </PantryAlert>

      {/* Discard Reminder Alert */}
      <PantryAlert
        visible={discardReminderAlert.visible}
        type="warning"
        title="Safety Reminder"
        message="Please remember to discard these items from your physical pantry/fridge to avoid accidental consumption."
        hideCloseButton={true}
        onClose={() => setDiscardReminderAlert({ visible: false, count: 0 })}
      >
        <View style={{ width: '100%', marginTop: 20 }}>
            <TouchableOpacity
                style={{
                  backgroundColor: '#81A969',
                  paddingVertical: 16,
                  borderRadius: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3
                }}
                onPress={() => setDiscardReminderAlert({ visible: false, count: 0 })}
                activeOpacity={0.8}
            >
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>
                    I've Discarded Them
                </Text>
            </TouchableOpacity>
        </View>
      </PantryAlert>
    </AuthGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: hp('15%'), // Increased responsive padding to match favorites-tab safe area
  },
  headerSpacer: {
    height: hp('11%'), // Match PantryHeader height (7% + 2% + ~2% for title)
  },
  groupsSectionSpacer: {
    paddingTop: 12, // adds space below the banner
  },

  // 💡 FAB STYLES (FIXED)
  fabContainer: {
    position: 'absolute',
    bottom: 130, // Moved higher
    right: 20,
    pointerEvents: 'box-none',
    zIndex: 1000,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#81A969',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    minWidth: 200,
  },
  fabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  fabOptionsWrapper: {
    alignItems: 'flex-end',
    gap: 12,
  },
  fabOption: {
    backgroundColor: '#81A969', // Ensure same color
    minWidth: 220, // Slightly wider for options
  },
});

export default Pantry;