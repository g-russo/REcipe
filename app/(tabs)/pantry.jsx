import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import styles from '../../assets/css/pantryStyles';
import AuthGuard from '../../components/AuthGuard';

const Pantry = () => {
  // Regular modal state variables
  const [modalVisible, setModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [itemActionVisible, setItemActionVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  
  // COMPLETELY NEW - Separate edit modal and state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  
  // Add the missing state variable
  const [newGroupModalVisible, setNewGroupModalVisible] = useState(false);
  
  // Initialize with empty arrays
  const [pantryItems, setPantryItems] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Add form state
  const [newItem, setNewItem] = useState({
    name: '',
    category: '',
    quantity: '',
    unit: '',
    expDate: '',
    description: '',
    image: null
  });
  
  const [newGroup, setNewGroup] = useState({
    name: '',
    color: '#8BC34A',
    tags: [],
  });
  
  // Selection mode states
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [groupSelectionModalVisible, setGroupSelectionModalVisible] = useState(false);
  
  // Add new state variables for group management
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetailModalVisible, setGroupDetailModalVisible] = useState(false);
  
  // Add new state variables for group management
  const [groupActionModalVisible, setGroupActionModalVisible] = useState(false);
  const [editGroupModalVisible, setEditGroupModalVisible] = useState(false);
  const [removeItemsMode, setRemoveItemsMode] = useState(false);
  
  // Add search functionality
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({
    items: [],
    groups: []
  });
  
  // Add state for item detail overlay
  const [detailOverlayVisible, setDetailOverlayVisible] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  
  // Add these missing state variables for edit functionality
  const [isEditMode, setIsEditMode] = useState(false);
  const [editItemId, setEditItemId] = useState(null);
  
  // Add a flag to track which form is using the selection modals
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  // Load data from storage on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [savedItems, savedCategories] = await Promise.all([
          AsyncStorage.getItem('pantryItems'),
          AsyncStorage.getItem('pantryCategories')
        ]);
        
        if (savedItems) setPantryItems(JSON.parse(savedItems));
        if (savedCategories) setCategories(JSON.parse(savedCategories));
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // Request permissions when the component mounts
  useEffect(() => {
    (async () => {
      // Fixed permissions request for newer expo-image-picker
      if (Platform.OS !== 'web') {
        try {
          // In newer versions, permissions might be requested differently
          const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
          const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          
          if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
            Alert.alert('Permission Required', 'Camera and photo library permissions are needed to use this feature.');
          }
        } catch (error) {
          console.log('Error requesting permissions:', error);
        }
      }
    })();
  }, []);
  
  // Save items to AsyncStorage
  const savePantryItems = async (items) => {
    try {
      await AsyncStorage.setItem('pantryItems', JSON.stringify(items));
    } catch (error) {
      console.error('Error saving pantry items:', error);
    }
  };
  
  // Save categories to AsyncStorage
  const saveCategories = async (cats) => {
    try {
      await AsyncStorage.setItem('pantryCategories', JSON.stringify(cats));
    } catch (error) {
      console.error('Error saving categories:', error);
    }
  };
  
  // Comprehensive list of food categories
  const foodCategories = [
    'Vegetables', 'Fruits', 'Meat', 'Poultry', 'Seafood', 'Dairy',
    'Eggs', 'Deli', 'Bread & Bakery', 'Pasta & Rice', 'Canned Goods',
    'Soups & Broths', 'Condiments', 'Sauces', 'Oils & Vinegars',
    'Spices & Herbs', 'Snacks', 'Nuts & Seeds', 'Dried Fruits',
    'Beans & Legumes', 'Baking Supplies', 'Beverages', 'Coffee & Tea',
    'Frozen Foods', 'Desserts & Sweets', 'Alcohol', 'Baby Food',
    'Pet Food', 'Gluten-Free', 'Organic', 'Vegan', 'Vegetarian'
  ];
  
  // List of units for quantity
  const unitOptions = [
    'oz', 'lb', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 
    'cup', 'pint', 'quart', 'gallon', 'each', 'bunch',
    'slice', 'package', 'can', 'bottle', 'box'
  ];
  
  const getCurrentDate = () => {
    const today = new Date();
    return `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  };
  
  // Format date for display
  const formatDate = (date) => {
    if (!date) return '';
    if (typeof date === 'string') return date;
    
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  // Handle input changes
  const handleInputChange = (field, value) => {
    setNewItem({
      ...newItem,
      [field]: value
    });
  };
  
  // Handle image picking from camera or gallery - updated for newer API
  const pickImage = async (useCamera = false) => {
    try {
      let result;
      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      };
      
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
      
      // Handle result based on newer API structure
      if (!result.canceled) {
        if (result.assets && result.assets.length > 0) {
          handleInputChange('image', result.assets[0].uri);
        }
      }
    } catch (error) {
      console.log('Error picking an image:', error);
      Alert.alert('Error', 'There was a problem selecting the image. Please try again.');
    }
  };

  // Show image picker options - Updated for all platforms
  const showImagePickerOptions = () => {
    Alert.alert(
      'Select Image',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => pickImage(true) },
        { text: 'Choose from Library', onPress: () => pickImage(false) }
      ]
    );
  };

  // Save the new item - updated to handle image and fix edit mode
  const saveNewItem = () => {
    // Validate required fields
    if (!newItem.name.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }
    
    console.log('SAVING ITEM - Edit mode:', isEditMode ? 'EDIT' : 'ADD', 'Item ID:', editItemId);
    
    let updatedItems;
    
    if (isEditMode === true && editItemId !== null) {
      // EDIT MODE: Update existing item
      console.log('UPDATING existing item with ID:', editItemId);
      
      updatedItems = pantryItems.map(item => {
        if (item.id === editItemId) {
          console.log('Found item to update:', item.name, '→', newItem.name);
          return {
            ...item, // Keep original properties like id
            name: newItem.name,
            category: newItem.category || 'Uncategorized',
            quantity: newItem.quantity || '1',
            unit: newItem.unit || 'each',
            expDate: newItem.expDate || 'No expiration',
            description: newItem.description || '',
            image: newItem.image
          };
        }
        return item;
      });
    } else {
      // ADD MODE: Create new item
      console.log('CREATING new item');
      const itemToAdd = {
        id: Date.now(), // New unique ID
        name: newItem.name,
        category: newItem.category || 'Uncategorized',
        quantity: newItem.quantity || '1',
        unit: newItem.unit || 'each',
        expDate: newItem.expDate || 'No expiration',
        description: newItem.description || '',
        dateAdded: getCurrentDate(),
        image: newItem.image
      };
      
      updatedItems = [...pantryItems, itemToAdd];
    }
    
    // Update state with new items
    setPantryItems(updatedItems);
    
    // Persist to storage
    savePantryItems(updatedItems);
    
    // Close modal first (this will reset the form)
    closeModal();
  };
  
  // Fix item action handling - add debug logging
  const handleItemAction = (action, item) => {
    if (action === 'edit') {
      // Set the item to edit and open edit modal
      setItemToEdit({...item}); // Make a copy
      setEditModalVisible(true);
      setItemActionVisible(false);
    } else if (action === 'delete') {
      // Delete functionality remains the same
      Alert.alert(
        "Delete Item",
        `Are you sure you want to delete "${item.name}"?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Delete", 
            onPress: () => {
              const updatedItems = pantryItems.filter(i => i.id !== item.id);
              setPantryItems(updatedItems);
              savePantryItems(updatedItems);
              setItemActionVisible(false);
            },
            style: "destructive"
          }
        ]
      );
    }
  };

  // Make sure closeModal is properly defined
  const closeModal = () => {
    console.log('Closing modal and resetting form');
    setModalVisible(false);
    resetForm(); // Make sure this happens
  };

  // Ensure resetForm is properly implemented
  const resetForm = () => {
    console.log('Resetting form - editMode was:', isEditMode);
    setNewItem({
      name: '',
      category: '',
      quantity: '',
      unit: '',
      expDate: '',
      description: '',
      image: null
    });
    setIsEditMode(false);
    setEditItemId(null);
    setShowDatePicker(false); // Reset date picker state
  };
  
  // NEW FUNCTION - separate update function for editing items
  const updateExistingItem = () => {
    if (!itemToEdit || !itemToEdit.id) {
      Alert.alert('Error', 'No item to update');
      return;
    }

    // Make sure we have a name
    if (!itemToEdit.name.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    // Create updated items array with the edited item
    const updatedItems = pantryItems.map(item => {
      if (item.id === itemToEdit.id) {
        // Return the updated item
        return {
          ...itemToEdit,
          // Make sure we maintain the original id and dateAdded
          id: item.id,
          dateAdded: item.dateAdded
        };
      }
      // Return unchanged items
      return item;
    });

    // Update state and storage
    setPantryItems(updatedItems);
    savePantryItems(updatedItems);
    
    // Close the edit modal
    setEditModalVisible(false);
    setItemToEdit(null);
  };

  // NEW - Handle edit form input changes (separate from add form)
  const handleEditInputChange = (field, value) => {
    setItemToEdit({
      ...itemToEdit,
      [field]: value
    });
  };

  // NEW - Edit image picker function
  const pickEditImage = async (useCamera = false) => {
    try {
      let result;
      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      };
      
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
      
      if (!result.canceled) {
        if (result.assets && result.assets.length > 0) {
          handleEditInputChange('image', result.assets[0].uri);
        }
      }
    } catch (error) {
      console.log('Error picking an image:', error);
      Alert.alert('Error', 'Problem selecting image. Please try again.');
    }
  };

  // NEW - Show image picker options for edit form
  const showEditImagePickerOptions = () => {
    Alert.alert(
      'Select Image',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => pickEditImage(true) },
        { text: 'Choose from Library', onPress: () => pickEditImage(false) }
      ]
    );
  };

  // Add the missing modal control functions
  const openCategoryModalForNew = () => {
    setIsEditingExisting(false);
    setCategoryModalVisible(true);
  };

  const openUnitModalForNew = () => {
    setIsEditingExisting(false);
    setUnitModalVisible(true);
  };

  const openCategoryModalForEdit = () => {
    setIsEditingExisting(true);
    setCategoryModalVisible(true);
  };

  const openUnitModalForEdit = () => {
    setIsEditingExisting(true);
    setUnitModalVisible(true);
  };

  // Add the missing handleAddGroup function
  const handleAddGroup = () => {
    // Validate required fields
    if (!newGroup.name.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    
    // Create new group object
    const groupToAdd = {
      id: Date.now(), // Unique ID
      name: newGroup.name,
      color: newGroup.color,
      tags: newGroup.tags || [],
      letter: newGroup.name.charAt(0).toUpperCase(), // First letter for display
      itemCount: 0, // Start with no items
    };
    
    // Add to categories array
    const updatedCategories = [...categories, groupToAdd];
    setCategories(updatedCategories);
    
    // Save to storage
    saveCategories(updatedCategories);
    
    // Close modal and reset form
    setNewGroupModalVisible(false);
    setNewGroup({
      name: '',
      color: '#8BC34A',
      tags: [],
    });
  };

  // Add the missing handleDeleteGroup function
  const handleDeleteGroup = () => {
    if (!selectedGroup) return;
    
    Alert.alert(
      "Delete Group",
      `Are you sure you want to delete "${selectedGroup.name}"? All items will also be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          onPress: () => {
            // Remove the group from categories
            const updatedCategories = categories.filter(group => group.id !== selectedGroup.id);
            setCategories(updatedCategories);
            saveCategories(updatedCategories);
            
            // Close modals
            setGroupActionModalVisible(false);
            setGroupDetailModalVisible(false);
          },
          style: "destructive"
        }
      ]
    );
  };
  
  // Add the missing toggleRemoveItemsMode function
  const toggleRemoveItemsMode = () => {
    // Toggle the removeItemsMode state variable
    setRemoveItemsMode(!removeItemsMode);
    // Close the action modal when toggling the mode
    setGroupActionModalVisible(false);
  };

  // Add the missing handleEditGroup function
  const handleEditGroup = () => {
    // Validate required fields
    if (!selectedGroup?.name.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    
    // Update the group in the categories array
    const updatedCategories = categories.map(category => {
      if (category.id === selectedGroup.id) {
        return {
          ...selectedGroup,
          // Make sure we preserve properties that might not be in the form
          id: category.id,
          itemCount: category.itemCount || 0,
        };
      }
      return category;
    });
    
    // Update state and storage
    setCategories(updatedCategories);
    saveCategories(updatedCategories);
    
    // Close modal
    setEditGroupModalVisible(false);
    setGroupActionModalVisible(false);
  };

  // Add other missing functions referenced in the component
  
  // Function to exit selection mode
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedItems([]);
  };
  
  // Function to open group details
  const openGroupDetails = (group) => {
    setSelectedGroup(group);
    setGroupDetailModalVisible(true);
  };
  
  // Function to toggle item selection
  const toggleItemSelection = (itemId) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };
  
  // Function to show item details
  const showItemDetails = (item) => {
    setDetailItem(item);
    setDetailOverlayVisible(true);
  };
  
  // Function to add items to a group
  const addItemsToGroup = (groupId) => {
    // Find the group to update
    const groupToUpdate = categories.find(c => c.id === groupId);
    if (!groupToUpdate) return;
    
    // Filter out items that are already in the group
    const existingItems = groupToUpdate.items || [];
    const newItemsToAdd = selectedItems.filter(id => !existingItems.includes(id));
    
    // If all items are already in the group, show message and return
    if (newItemsToAdd.length === 0) {
      Alert.alert('Note', 'All selected items are already in this group.');
      setGroupSelectionModalVisible(false);
      exitSelectionMode();
      return;
    }
    
    // Update the group with only new items
    const updatedCategories = categories.map(category => {
      if (category.id === groupId) {
        return {
          ...category,
          // Add only the count of new items
          itemCount: (category.itemCount || 0) + newItemsToAdd.length,
          // Combine existing items with new unique items
          items: [...existingItems, ...newItemsToAdd]
        };
      }
      return category;
    });
    
    // Update state and storage
    setCategories(updatedCategories);
    saveCategories(updatedCategories);
    
    // Exit selection mode and close modal
    setGroupSelectionModalVisible(false);
    exitSelectionMode();
    
    // Show confirmation with accurate count of new items added
    const duplicateCount = selectedItems.length - newItemsToAdd.length;
    let message = `Added ${newItemsToAdd.length} items to ${groupToUpdate.name}`;
    if (duplicateCount > 0) {
      message += ` (${duplicateCount} ${duplicateCount === 1 ? 'item was' : 'items were'} already in the group)`;
    }
    
    Alert.alert('Success', message);
  };
  
  // Function to get items in a group
  const getGroupItems = (groupId) => {
    const group = categories.find(c => c.id === groupId);
    if (!group || !group.items || group.items.length === 0) return [];
    
    // Return items that belong to this group
    return pantryItems.filter(item => group.items.includes(item.id));
  };
  
  // Function to remove an item from a group
  const removeItemFromGroup = (groupId, itemId) => {
    // Find the group to update
    const groupToUpdate = categories.find(c => c.id === groupId);
    if (!groupToUpdate || !groupToUpdate.items) return;
    
    // Update the group by removing the item
    const updatedCategories = categories.map(category => {
      if (category.id === groupId) {
        const updatedItems = (category.items || []).filter(id => id !== itemId);
        return {
          ...category,
          itemCount: updatedItems.length,
          items: updatedItems
        };
      }
      return category;
    });
    
    // Update state and storage
    setCategories(updatedCategories);
    saveCategories(updatedCategories);
  };
  
  // Function to handle search
  const handleSearch = (query) => {
    if (!query.trim()) {
      setSearchResults({ items: [], groups: [] });
      return;
    }
    
    // Search for items and groups that match the query
    const lowerQuery = query.toLowerCase();
    
    const filteredItems = pantryItems.filter(item => 
      item.name.toLowerCase().includes(lowerQuery) ||
      item.category.toLowerCase().includes(lowerQuery)
    );
    
    const filteredGroups = categories.filter(group =>
      group.name.toLowerCase().includes(lowerQuery)
    );
    
    setSearchResults({
      items: filteredItems,
      groups: filteredGroups
    });
  };
  
  // Function to clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults({ items: [], groups: [] });
  };

  // Loading state to fix missing isLoading reference
  const [isLoading, setIsLoading] = useState(true);

  // Add new state for date picker visibility
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  // Add date picker handlers for new item
  const onDateChange = (event, selectedDate) => {
    // Hide the picker on Android after selection
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (selectedDate) {
      const formattedDate = formatDate(selectedDate);
      
      // Validate that expiration date is after date added
      if (isValidExpDate(formattedDate, getCurrentDate())) {
        handleInputChange('expDate', formattedDate);
      } else {
        Alert.alert(
          'Invalid Date',
          'Expiration date must be after the date added.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  // Add date picker handlers for edit item
  const onEditDateChange = (event, selectedDate) => {
    // Hide the picker on Android after selection
    if (Platform.OS === 'android') {
      setShowEditDatePicker(false);
    }
    
    if (selectedDate) {
      const formattedDate = formatDate(selectedDate);
      
      // Validate that expiration date is after date added
      if (isValidExpDate(formattedDate, itemToEdit?.dateAdded)) {
        handleEditInputChange('expDate', formattedDate);
      } else {
        Alert.alert(
          'Invalid Date',
          'Expiration date must be after the date added.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  // Replace both date picker functions with these simplified versions that use the native date picker
  const showDatePickerForNew = () => {
    if (Platform.OS === 'android') {
      // For Android, show the native date picker directly
      setShowDatePicker(true);
    } else {
      // For iOS, we'll also just set state and show the picker in JSX
      setShowDatePicker(true);
    }
  };

  // Replace the showDatePickerForEdit function
  const showDatePickerForEdit = () => {
    if (Platform.OS === 'android') {
      // For Android, show the native date picker directly
      setShowEditDatePicker(true);
    } else {
      // For iOS, we'll also just set state
      setShowEditDatePicker(true);
    }
  };

  // Add these helper functions at the appropriate place in your component code
const parseDate = (dateString) => {
  if (!dateString) return null;
  // If it's already a Date object, return it
  if (dateString instanceof Date) return dateString;
  
  // Try to parse the date string
  try {
    // Handle different date formats
    if (dateString.includes('/')) {
      // Format: MM/DD/YYYY
      const [month, day, year] = dateString.split('/').map(Number);
      return new Date(year, month - 1, day); // Month is 0-indexed in JS Date
    } else if (dateString.includes('-')) {
      // Format: YYYY-MM-DD (ISO format)
      return new Date(dateString);
    }
    return new Date(dateString);
  } catch (error) {
    console.log('Error parsing date:', error);
    return null;
  }
};

// Check if expiration date is valid (greater than date added)
const isValidExpDate = (expDate, dateAdded) => {
  const expDateTime = parseDate(expDate)?.getTime();
  const addedDateTime = parseDate(dateAdded)?.getTime();
  
  // Allow null expiration date (no expiration)
  if (!expDateTime) return true;
  
  // If we have both dates, compare them
  if (expDateTime && addedDateTime) {
    return expDateTime > addedDateTime;
  }
  
  return true;
};

  return (
    <AuthGuard>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header - Remove add button, keep only search */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.profileIconContainer}>
            <Ionicons name="person-outline" size={18} color="#777" />
          </View>
          <Text style={styles.headerTitle}>Your Pantry</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setSearchModalVisible(true)}
          >
            <Ionicons name="search-outline" size={22} color="#555" />
          </TouchableOpacity>
          {/* Removed add button from here */}
        </View>
      </View>

      {/* Selection Mode Header - shown when selection mode is active */}
      {selectionMode && (
        <View style={styles.selectionModeHeader}>
          <TouchableOpacity 
            style={styles.selectionModeButton} 
            onPress={exitSelectionMode}
          >
            <Ionicons name="close-outline" size={24} color="#fff" />
            <Text style={styles.selectionModeButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.selectionModeTitle}>
            {selectedItems.length} selected
          </Text>
          
          <TouchableOpacity 
            style={[
              styles.selectionModeButton, 
              selectedItems.length === 0 && styles.disabledButton
            ]} 
            onPress={() => selectedItems.length > 0 && setGroupSelectionModalVisible(true)}
            disabled={selectedItems.length === 0}
          >
            <Ionicons name="folder-outline" size={20} color="#fff" />
            <Text style={styles.selectionModeButtonText}>Add to Group</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Groups Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Groups</Text>
          
          {categories.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="folder-outline" size={70} color="#ccc" />
              </View>
              <Text style={styles.emptyTitle}>No groups created yet</Text>
              <Text style={styles.emptySubtitle}>Create groups to organize your pantry items</Text>
              <TouchableOpacity 
                style={styles.addItemButton}
                onPress={() => setNewGroupModalVisible(true)}
              >
                <Text style={styles.addItemButtonText}>Create Group</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView 
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesScrollView}
            >
              {categories.map((category) => (
                <TouchableOpacity 
                  key={category.id} 
                  style={[styles.categoryCard, { backgroundColor: category.color || '#8BC34A' }]}
                  onPress={() => openGroupDetails(category)}
                >
                  <View style={styles.categoryLetterContainer}>
                    <Text style={styles.categoryLetter}>{category.letter}</Text>
                  </View>
                  <View style={styles.categoryDetails}>
                    <View style={styles.categoryHeaderRow}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                      <View style={styles.arrowContainer}>
                        <Ionicons name="chevron-forward" size={18} color="#fff" />
                      </View>
                    </View>
                    <Text style={styles.itemCount}>{category.itemCount || 0} items</Text>
                    
                    <View style={styles.tagsContainer}>
                      {category.tags && category.tags.map((tag, index) => (
                        <View key={index} style={styles.tagPill}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              
              {/* Add New Group card */}
              <TouchableOpacity 
                style={[styles.categoryCard, styles.emptyCard, styles.addNewCard]} 
                onPress={() => setNewGroupModalVisible(true)}
              >
                <View style={styles.addNewContent}>
                  <View style={styles.addIconContainer}>
                    <Ionicons name="add-circle-outline" size={40} color="#777" />
                  </View>
                  <Text style={styles.addNewText}>Add New Group</Text>
                  <Text style={styles.addNewSubtext}>Organize your ingredients</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        {/* My Items Section - Added section header with add button */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>My Items</Text>
            <TouchableOpacity 
              style={styles.sectionAddButton}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="add-circle" size={28} color="#8BC34A" />
            </TouchableOpacity>
          </View>
          
          {pantryItems.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="cube-outline" size={80} color="#ccc" />
              </View>
              <Text style={styles.emptyTitle}>Your pantry is empty</Text>
              <Text style={styles.emptySubtitle}>Add items to keep track of your ingredients</Text>
              <TouchableOpacity 
                style={styles.addItemButton}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.addItemButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.itemsGrid}>
              {pantryItems.map((item) => (
                <TouchableOpacity
                  key={item.id} 
                  style={styles.itemCard}
                  onPress={() => selectionMode ? toggleItemSelection(item.id) : showItemDetails(item)}
                  onLongPress={() => {
                    if (!selectionMode) {
                      setSelectionMode(true);
                      setSelectedItems([item.id]);
                    }
                  }}
                  delayLongPress={300}
                >
                  {/* Selection checkbox */}
                  {selectionMode && (
                    <View style={styles.checkboxContainer}>
                      <View style={[
                        styles.checkbox,
                        selectedItems.includes(item.id) && styles.checkboxSelected
                      ]}>
                        {selectedItems.includes(item.id) && (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                      </View>
                    </View>
                  )}
                  
                  {/* Item content */}
                  {item.image ? (
                    <Image 
                      source={{ uri: item.image }} 
                      style={styles.itemImagePlaceholder}
                    />
                  ) : (
                    <View style={styles.itemImagePlaceholder} />
                  )}
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <View style={styles.itemFooter}>
                      <Text style={styles.expDate}>{item.expDate}</Text>
                      {!selectionMode && (
                        <TouchableOpacity onPress={(e) => {
                          e.stopPropagation(); // Prevent triggering the parent's onPress
                          setSelectedItemId(item.id);
                          setItemActionVisible(true);
                        }}>
                          <Ionicons name="ellipsis-vertical" size={16} color="#aaa" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add New Item Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{flex: 1}}
          >
            {/* Modal Header - Updated title based on mode */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditMode ? 'Edit Item' : 'Add New Item'}
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={closeModal}
              >
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalContentContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalContent}>
                {/* Image Upload Area - Updated to show selected image or placeholder */}
                <TouchableOpacity 
                  style={styles.imageUploadArea}
                  onPress={showImagePickerOptions}
                >
                  {newItem.image ? (
                    <Image 
                      source={{ uri: newItem.image }} 
                      style={styles.uploadedImage} 
                    />
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Ionicons name="image-outline" size={32} color="#fff" />
                      <Text style={styles.uploadText}>Add Photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
                
                {/* Form Fields */}
                <TextInput 
                  style={styles.input}
                  placeholder="Item Name"
                  placeholderTextColor="#999"
                  value={newItem.name}
                  onChangeText={(text) => handleInputChange('name', text)}
                />
                
                <TouchableOpacity 
                  style={styles.dropdownInput}
                  onPress={openCategoryModalForNew}
                >
                  <Text style={newItem.category ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
                    {newItem.category || 'Choose Category'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#999" />
                </TouchableOpacity>
                
                <View style={styles.formRow}>
                  <View style={styles.formColumn}>
                    <Text style={styles.columnLabel}>Quantity:</Text>
                    <TextInput 
                      style={styles.smallInput}
                      placeholder="1-99"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      value={newItem.quantity}
                      onChangeText={(text) => handleInputChange('quantity', text)}
                    />
                  </View>
                  
                  <View style={styles.formColumn}>
                    <Text style={styles.columnLabel}>Unit:</Text>
                    <TouchableOpacity 
                      style={styles.smallDropdown}
                      onPress={openUnitModalForNew}  // Add this handler
                    >
                      <Text style={newItem.unit ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
                        {newItem.unit || 'Select'}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#999" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.dateSection}>
                  <Text style={styles.sectionLabel}>Dates</Text>
                  
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Date Added:</Text>
                    <View style={[styles.dateInput, styles.disabledInput]}>
                      <Text style={styles.dateDisplayText}>{getCurrentDate()}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Expiration Date:</Text>
                    <TouchableOpacity 
                      style={styles.dateInput}
                      onPress={showDatePickerForNew}
                    >
                      <Text style={newItem.expDate ? styles.dateDisplayText : styles.dropdownPlaceholder}>
                        {newItem.expDate || 'Select Date'}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#999" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {showDatePicker && (
                  <DateTimePicker
                    value={newItem.expDate ? parseDate(newItem.expDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                    minimumDate={parseDate(getCurrentDate())} // Set minimum date to today
                  />
                )}
                
                <Text style={styles.formLabel}>Item Description:</Text>
                <TextInput
                  style={styles.textAreaInput}
                  placeholder="Type item description..."
                  placeholderTextColor="#999"
                  multiline={true}
                  numberOfLines={4}
                  value={newItem.description}
                  onChangeText={(text) => handleInputChange('description', text)}
                />
                
                <View style={styles.buttonContainer}>
                  <TouchableOpacity 
                    style={styles.saveButton}
                    onPress={saveNewItem}
                  >
                    <Text style={styles.saveButtonText}>
                      {isEditMode ? 'Update' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={closeModal}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Category Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={categoryModalVisible}
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.categoryModalOverlay}>
          <View style={styles.categoryModalContent}>
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={foodCategories}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryOption}
                  onPress={() => {
                    if (isEditingExisting) {
                      handleEditInputChange('category', item);
                    } else {
                      handleInputChange('category', item);
                    }
                    setCategoryModalVisible(false);
                  }}
                >
                  <Text style={styles.categoryOptionText}>{item}</Text>
                </TouchableOpacity>
              )}
              style={styles.categoryList}
            />
          </View>
        </View>
      </Modal>

      {/* Unit Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={unitModalVisible}
        onRequestClose={() => setUnitModalVisible(false)}
      >
        <View style={styles.categoryModalOverlay}>
          <View style={styles.categoryModalContent}>
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>Select Unit</Text>
              <TouchableOpacity onPress={() => setUnitModalVisible(false)}>
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={unitOptions}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryOption}
                  onPress={() => {
                    if (isEditingExisting) {
                      handleEditInputChange('unit', item);
                    } else {
                      handleInputChange('unit', item);
                    }
                    setUnitModalVisible(false);
                  }}
                >
                  <Text style={styles.categoryOptionText}>{item}</Text>
                </TouchableOpacity>
              )}
              style={styles.categoryList}
            />
          </View>
        </View>
      </Modal>

      {/* Item Actions Modal - MODIFIED to use cleaner approach */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={itemActionVisible}
        onRequestClose={() => setItemActionVisible(false)}
      >
        <TouchableOpacity 
          style={styles.actionModalOverlay}
          onPress={() => setItemActionVisible(false)}
          activeOpacity={1}
        >
          <View style={styles.actionModalContent}>
            {selectedItemId && (
              <>
                <TouchableOpacity 
                  style={styles.actionOption}
                  onPress={() => {
                    // Find the item once and pass it directly
                    const selectedItem = pantryItems.find(i => i.id === selectedItemId);
                    if (selectedItem) {
                      handleItemAction('edit', selectedItem);
                    }
                  }}
                >
                  <Ionicons name="create-outline" size={22} color="#555" />
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
                
                <View style={styles.actionDivider} />
                
                <TouchableOpacity 
                  style={styles.actionOption}
                  onPress={() => {
                    const selectedItem = pantryItems.find(i => i.id === selectedItemId);
                    if (selectedItem) {
                      handleItemAction('delete', selectedItem);
                    }
                  }}
                >
                  <Ionicons name="trash-outline" size={22} color="#ff4d4d" />
                  <Text style={[styles.actionText, { color: '#ff4d4d' }]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add New Group Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={newGroupModalVisible}
        onRequestClose={() => setNewGroupModalVisible(false)}
      >
        <View style={styles.categoryModalOverlay}>
          <View style={styles.categoryModalContent}>
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>Create New Group</Text>
              <TouchableOpacity onPress={() => setNewGroupModalVisible(false)}>
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <TextInput
                style={styles.input}
                placeholder="Group Name (e.g., Spices, Baking)"
                placeholderTextColor="#999"
                value={newGroup.name}
                onChangeText={(text) => setNewGroup({...newGroup, name: text})}
              />
              
              <View style={styles.colorPickerContainer}>
                <Text style={styles.formLabel}>Group Color:</Text>
                <View style={styles.colorOptions}>
                  {['#8BC34A', '#FF5722', '#2196F3', '#9C27B0', '#FF9800'].map(color => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        newGroup.color === color && styles.selectedColorOption
                      ]}
                      onPress={() => setNewGroup({...newGroup, color: color})}
                    />
                  ))}
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleAddGroup}
              >
                <Text style={styles.saveButtonText}>Create Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Group Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={groupSelectionModalVisible}
        onRequestClose={() => setGroupSelectionModalVisible(false)}
      >
        <View style={styles.categoryModalOverlay}>
          <View style={styles.categoryModalContent}>
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>Add to Group</Text>
              <TouchableOpacity onPress={() => setGroupSelectionModalVisible(false)}>
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>
            
            {categories.length === 0 ? (
              <View style={styles.emptyModalContent}>
                <Text style={styles.emptyModalText}>No groups available</Text>
                <TouchableOpacity 
                  style={styles.createGroupButton}
                  onPress={() => {
                    setGroupSelectionModalVisible(false);
                    setNewGroupModalVisible(true);
                  }}
                >
                  <Text style={styles.createGroupButtonText}>Create New Group</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={categories}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.groupSelectionOption}
                    onPress={() => addItemsToGroup(item.id)}
                  >
                    <View style={[styles.groupColorIndicator, { backgroundColor: item.color }]} />
                    <Text style={styles.groupSelectionText}>{item.name}</Text>
                    <Text style={styles.groupSelectionCount}>
                      {item.itemCount || 0} items
                    </Text>
                  </TouchableOpacity>
                )}
                style={styles.categoryList}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Group Detail Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={groupDetailModalVisible}
        onRequestClose={() => {
          setGroupDetailModalVisible(false);
          setRemoveItemsMode(false);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={[
            styles.groupDetailHeader, 
            { backgroundColor: selectedGroup?.color || '#8BC34A' }
          ]}>
            <View style={styles.groupDetailHeaderContent}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => {
                  setGroupDetailModalVisible(false);
                  setRemoveItemsMode(false);
                }}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              
              <Text style={styles.groupDetailTitle}>{selectedGroup?.name}</Text>
              
              <TouchableOpacity 
                style={styles.groupDetailOptionButton}
                onPress={() => setGroupActionModalVisible(true)}
              >
                <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.groupDetailItemCount}>
              {selectedGroup?.itemCount || 0} items
            </Text>
            
            {removeItemsMode && (
              <Text style={styles.removeItemsText}>
                Tap items to remove from group
              </Text>
            )}
          </View>
          
          <View style={styles.groupDetailContent}>
            {selectedGroup && getGroupItems(selectedGroup.id).length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="cube-outline" size={70} color="#ccc" />
                </View>
                <Text style={styles.emptyTitle}>No items in this group</Text>
                <Text style={styles.emptySubtitle}>
                  Add items from your pantry to this group
                </Text>
                <TouchableOpacity 
                  style={styles.addItemButton}
                  onPress={() => {
                    setGroupDetailModalVisible(false);
                    setSelectionMode(true); // Enter selection mode to add items
                  }}
                >
                  <Text style={styles.addItemButtonText}>Add Items</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.groupItemsContainer}>
                <View style={styles.itemsGrid}>
                  {selectedGroup && getGroupItems(selectedGroup.id).map((item) => (
                    <TouchableOpacity 
                      key={item.id} 
                      style={[
                        styles.itemCard,
                        removeItemsMode && styles.itemCardRemoveMode
                      ]}
                      onPress={() => {
                        if (removeItemsMode) {
                          removeItemFromGroup(selectedGroup.id, item.id);
                        }
                      }}
                    >
                      <View style={styles.itemImagePlaceholder} />
                      <View style={styles.itemDetails}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <View style={styles.itemFooter}>
                          <Text style={styles.expDate}>{item.expDate}</Text>
                          {removeItemsMode && (
                            <Ionicons 
                              name="remove-circle" 
                              size={18} 
                              color="#ff4d4d" 
                            />
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
      
      {/* Group Action Modal - Modified to add delete group option */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={groupActionModalVisible}
        onRequestClose={() => setGroupActionModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.actionModalOverlay}
          onPress={() => setGroupActionModalVisible(false)}
          activeOpacity={1}
        >
          <View style={[styles.actionModalContent, { top: 120, right: 20, position: 'absolute' }]}>
            <TouchableOpacity 
              style={styles.actionOption}
              onPress={() => {
                setGroupActionModalVisible(false);
                setEditGroupModalVisible(true);
              }}
            >
              <Ionicons name="create-outline" size={22} color="#555" />
              <Text style={styles.actionText}>Edit Group</Text>
            </TouchableOpacity>
            
            <View style={styles.actionDivider} />
            
            <TouchableOpacity 
              style={styles.actionOption}
              onPress={toggleRemoveItemsMode}
            >
              <Ionicons name="trash-outline" size={22} color="#555" />
              <Text style={styles.actionText}>
                {removeItemsMode ? 'Cancel Removing' : 'Remove Items'}
              </Text>
            </TouchableOpacity>
            
            <View style={styles.actionDivider} />
            
            <TouchableOpacity 
              style={styles.actionOption}
              onPress={handleDeleteGroup}
            >
              <Ionicons name="trash-bin-outline" size={22} color="#ff4d4d" />
              <Text style={[styles.actionText, { color: '#ff4d4d' }]}>Delete Group</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Group Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editGroupModalVisible}
        onRequestClose={() => setEditGroupModalVisible(false)}
      >
        <View style={styles.categoryModalOverlay}>
          <View style={styles.categoryModalContent}>
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>Edit Group</Text>
              <TouchableOpacity onPress={() => setEditGroupModalVisible(false)}>
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <TextInput
                style={styles.input}
                placeholder="Group Name"
                placeholderTextColor="#999"
                value={selectedGroup?.name || ''}
                onChangeText={(text) => setSelectedGroup({
                  ...selectedGroup, 
                  name: text,
                  letter: text.charAt(0).toUpperCase()
                })}
              />
              
              <View style={styles.colorPickerContainer}>
                <Text style={styles.formLabel}>Group Color:</Text>
                <View style={styles.colorOptions}>
                  {['#8BC34A', '#FF5722', '#2196F3', '#9C27B0', '#FF9800'].map(color => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        selectedGroup?.color === color && styles.selectedColorOption
                      ]}
                      onPress={() => setSelectedGroup({...selectedGroup, color: color})}
                    />
                  ))}
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleEditGroup}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Search Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={searchModalVisible}
        onRequestClose={() => {
          setSearchModalVisible(false);
          clearSearch();
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.searchHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                setSearchModalVisible(false);
                clearSearch();
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#555" />
            </TouchableOpacity>
            
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search your pantry..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  handleSearch(text);
                }}
                autoFocus={true}
                returnKeyType="search"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={clearSearch}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          
          {/* Search Results */}
          {searchQuery.trim() === '' ? (
            <View style={styles.emptySearchContainer}>
              <Ionicons name="search" size={60} color="#ddd" />
              <Text style={styles.emptySearchText}>Search for items and groups</Text>
            </View>
          ) : (
            <ScrollView style={styles.searchResultsContainer}>
              {/* Groups Results */}
              {searchResults.groups.length > 0 && (
                <View style={styles.searchSection}>
                  <Text style={styles.searchSectionTitle}>Groups</Text>
                  {searchResults.groups.map(group => (
                    <TouchableOpacity 
                      key={group.id} 
                      style={styles.searchResultItem}
                      onPress={() => {
                        openGroupDetails(group);
                        setSearchModalVisible(false);
                        clearSearch();
                      }}
                    >
                      <View style={[styles.searchResultColorDot, { backgroundColor: group.color }]} />
                      <View style={styles.searchResultTextContainer}>
                        <Text style={styles.searchResultTitle}>{group.name}</Text>
                        <Text style={styles.searchResultSubtitle}>
                          {group.itemCount || 0} items
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {/* Items Results */}
              {searchResults.items.length > 0 && (
                <View style={styles.searchSection}>
                  <Text style={styles.searchSectionTitle}>Items</Text>
                  {searchResults.items.map(item => (
                    <TouchableOpacity 
                      key={item.id} 
                      style={styles.searchResultItem}
                      onPress={() => {
                        setSelectedItemId(item.id);
                        setSearchModalVisible(false);
                        clearSearch();
                        setItemActionVisible(true);
                      }}
                    >
                      <View style={styles.searchResultIcon}>
                        <Ionicons name="cube-outline" size={22} color="#8BC34A" />
                      </View>
                      <View style={styles.searchResultTextContainer}>
                        <Text style={styles.searchResultTitle}>{item.name}</Text>
                        <Text style={styles.searchResultSubtitle}>
                          {item.quantity} {item.unit} • {item.category}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {/* No Results */}
              {searchResults.groups.length === 0 && searchResults.items.length === 0 && (
                <View style={styles.emptySearchContainer}>
                  <Ionicons name="search-outline" size={60} color="#ddd" />
                  <Text style={styles.emptySearchText}>No results found</Text>
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
      
      {/* Item Detail Overlay */}
      {detailOverlayVisible && detailItem && (
        <TouchableOpacity 
          style={styles.detailOverlay}
          activeOpacity={1}
          onPress={() => setDetailOverlayVisible(false)}
        >
          <View 
            style={styles.detailCard}
            onStartShouldSetResponder={() => true} // Prevent touch events from propagating
          >
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{detailItem.name}</Text>
              <TouchableOpacity onPress={() => setDetailOverlayVisible(false)}>
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>

            {detailItem.image ? (
              <Image 
                source={{ uri: detailItem.image }} 
                style={styles.detailImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.detailImagePlaceholder}>
                <Ionicons name="image-outline" size={60} color="#ccc" />
              </View>
            )}

            <View style={styles.detailContent}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Category:</Text>
                <Text style={styles.detailValue}>{detailItem.category}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Quantity:</Text>
                <Text style={styles.detailValue}>{detailItem.quantity} {detailItem.unit}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Expiry:</Text>
                <Text style={styles.detailValue}>{detailItem.expDate}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Added:</Text>
                <Text style={styles.detailValue}>{detailItem.dateAdded}</Text>
              </View>
              
              {detailItem.description ? (
                <View style={styles.detailDescription}>
                  <Text style={styles.detailDescriptionLabel}>Description:</Text>
                  <Text style={styles.detailDescriptionText}>{detailItem.description}</Text>
                </View>
              ) : null}
              
              <View style={styles.detailActions}>
                <TouchableOpacity 
                  style={styles.detailActionButton}
                  onPress={() => {
                    setDetailOverlayVisible(false);
                    handleItemAction('edit', detailItem);
                  }}
                >
                  <Ionicons name="create-outline" size={20} color="#8BC34A" />
                  <Text style={styles.detailActionText}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.detailActionButton, styles.deleteButton]}
                  onPress={() => {
                    setDetailOverlayVisible(false);
                    handleItemAction('delete', detailItem);
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#ff4d4d" />
                  <Text style={[styles.detailActionText, {color: "#ff4d4d"}]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}
      
      {/* NEW - Edit Item Modal - Completely separate */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{flex: 1}}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Item</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalContentContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalContent}>
                {/* Image Upload Area */}
                <TouchableOpacity 
                  style={styles.imageUploadArea}
                  onPress={showEditImagePickerOptions}
                >
                  {itemToEdit?.image ? (
                    <Image 
                      source={{ uri: itemToEdit.image }} 
                      style={styles.uploadedImage} 
                    />
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Ionicons name="image-outline" size={32} color="#fff" />
                      <Text style={styles.uploadText}>Add Photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
                
                {/* Form Fields */}
                <TextInput 
                  style={styles.input}
                  placeholder="Item Name"
                  placeholderTextColor="#999"
                  value={itemToEdit?.name || ''}
                  onChangeText={(text) => handleEditInputChange('name', text)}
                />
                
                <TouchableOpacity 
                  style={styles.dropdownInput}
                  onPress={openCategoryModalForEdit}
                >
                  <Text style={itemToEdit?.category ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
                    {itemToEdit?.category || 'Choose Category'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#999" />
                </TouchableOpacity>
                
                <View style={styles.formRow}>
                  <View style={styles.formColumn}>
                    <Text style={styles.columnLabel}>Quantity:</Text>
                    <TextInput 
                      style={styles.smallInput}
                      placeholder="1-99"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      value={itemToEdit?.quantity || ''}
                      onChangeText={(text) => handleEditInputChange('quantity', text)}
                    />
                  </View>
                  
                  <View style={styles.formColumn}>
                    <Text style={styles.columnLabel}>Unit:</Text>
                    <TouchableOpacity 
                      style={styles.smallDropdown}
                      onPress={openUnitModalForEdit}
                    >
                      <Text style={itemToEdit?.unit ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
                        {itemToEdit?.unit || 'Select'}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#999" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.dateSection}>
                  <Text style={styles.sectionLabel}>Dates</Text>
                  
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Date Added:</Text>
                    <View style={[styles.dateInput, styles.disabledInput]}>
                      <Text style={styles.dateDisplayText}>{itemToEdit?.dateAdded || getCurrentDate()}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Expiration Date:</Text>
                    <TouchableOpacity 
                      style={styles.dateInput}
                      onPress={showDatePickerForEdit}
                    >
                      <Text style={itemToEdit?.expDate ? styles.dateDisplayText : styles.dropdownPlaceholder}>
                        {itemToEdit?.expDate || 'Select Date'}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#999" />
                    </TouchableOpacity>
                  </View>
                </View>

                {showEditDatePicker && (
                  <DateTimePicker
                    value={itemToEdit?.expDate ? parseDate(itemToEdit.expDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={onEditDateChange}
                    minimumDate={parseDate(itemToEdit?.dateAdded || getCurrentDate())} // Set minimum date to date added
                  />
                )}
                
                <Text style={styles.formLabel}>Item Description:</Text>
                <TextInput
                  style={styles.textAreaInput}
                  placeholder="Type item description..."
                  placeholderTextColor="#999"
                  multiline={true}
                  numberOfLines={4}
                  value={itemToEdit?.description || ''}
                  onChangeText={(text) => handleEditInputChange('description', text)}
                />
                
                <View style={styles.buttonContainer}>
                  <TouchableOpacity 
                    style={[styles.saveButton, {backgroundColor: '#FF9800'}]} // Different color for edit button
                    onPress={updateExistingItem}
                  >
                    <Text style={styles.saveButtonText}>Update Item</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={() => setEditModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ...existing modals... */}
    </SafeAreaView>
    </AuthGuard>
  );
};

export default Pantry;