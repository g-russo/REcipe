import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PantryAlert from './pantry-alert';

// Updated Regex (No numbers)
const ITEM_NAME_REGEX = /^[a-zA-Z\s'-]+$/;
const ITEM_NAME_MIN_LENGTH = 2;
const ITEM_NAME_MAX_LENGTH = 50;

/**
 * Item Form Modal Component
 * Reusable modal for adding/editing pantry items
 */
const ItemFormModal = ({
  visible,
  onClose,
  onSave,
  initialData = null,
  inventories = [],
}) => {
  const isEditMode = !!initialData && !!initialData.itemID;
  const isAIRecommendation = !!initialData?.isAI;
  const aiReasoning = initialData?.aiReasoning;

  const [reasoningModalVisible, setReasoningModalVisible] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    itemName: '',
    inventoryID: inventories[0]?.inventoryID || null,
    quantity: '',
    unit: '',
    itemCategory: '',
    itemDescription: '',
    itemExpiration: '',
    imageURL: null,
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [imagePickerVisible, setImagePickerVisible] = useState(false);
  const [validationAlert, setValidationAlert] = useState({ visible: false, message: '' });
  const [localDuplicateAlert, setLocalDuplicateAlert] = useState({
    visible: false,
    existingItem: null,
    incomingItem: null,
    mergeAvailable: false
  });

  // SPLIT & REFINED FOOD CATEGORIES (No '&' or '/')
  const foodCategories = [
    // Cooked/Prepared Food
    'Rice', 'Soup', 'Leftovers', 'Kakanin',
    // Raw Ingredients
    'Baking', 'Beverages', 'Canned', 'Jarred', 'Condiments', 'Sauces', 'Dairy', 'Eggs',
    'Fruits', 'Frozen', 'Grains', 'Pasta', 'Noodles', 'Meat', 'Poultry', 'Seafood',
    'Snacks', 'Spices', 'Herbs', 'Vegetables', 'Other'
  ];

  // --- 1. Master List of Units ---
  const allUnits = {
    // Cooked / Servings
    serving: ['servings', 'container', 'tupperware', 'pieces', 'slices', 'bowls', 'tray', 'pot'],
    // Weight (Solids)
    weight: ['kg', 'g', 'lb', 'oz', 'pack', 'box', 'bag'],
    // Volume (Liquids)
    volume: ['l', 'ml', 'cup', 'pint', 'quart', 'gallon', 'bottle', 'can'],
    // Kitchen / Small
    small: ['tbsp', 'tsp', 'jar', 'dash', 'pinch'],
    // Countable
    count: ['each', 'pieces', 'bunch', 'head', 'tray', 'dozen']
  };

  // --- 2. Helper to Get Allowed Units per Category ---
  const getAllowedUnits = (category) => {
    if (!category) return [...new Set(Object.values(allUnits).flat())]; // Return all if no category selected

    switch (category) {
      // Cooked Food
      case 'Rice':
      case 'Leftovers':
      case 'Kakanin':
        return [...new Set([...allUnits.serving, 'g', 'kg'])];

      // Liquidy Cooked Food
      case 'Soup':
        return [...new Set([...allUnits.serving, ...allUnits.volume])];

      // Liquids
      case 'Beverages':
      case 'Sauces':
      case 'Condiments':
      case 'Dairy':
        return [...new Set([...allUnits.volume, ...allUnits.small])];

      // Raw Meat / Seafood (Strictly Weight/Count)
      case 'Meat':
      case 'Poultry':
      case 'Seafood':
      case 'Frozen':
        return [...new Set([...allUnits.weight, 'pieces', 'each', 'tray'])];

      // Baking / Grains / Spices (Weight + Vol + Small)
      case 'Baking':
      case 'Grains':
      case 'Pasta':
      case 'Noodles':
      case 'Spices':
      case 'Herbs':
        return [...new Set([...allUnits.weight, ...allUnits.small, 'cup', 'jar', 'can'])];

      // Produce
      case 'Fruits':
      case 'Vegetables':
        return [...new Set([...allUnits.weight, ...allUnits.count, 'cup'])];

      // Eggs
      case 'Eggs':
        return ['each', 'dozen', 'tray', 'pieces'];

      // Canned Goods
      case 'Canned':
      case 'Jarred':
        return ['can', 'jar', 'bottle', ...allUnits.weight];

      default:
        return [...new Set(Object.values(allUnits).flat())];
    }
  };

  // Get filtered unit options based on selected category
  const unitOptions = getAllowedUnits(formData.itemCategory);

  const DRAFT_KEY = 'itemFormDraft';

  // Load draft when opening (create mode only)
  useEffect(() => {
    const loadDraftIfNeeded = async () => {
      if (visible && !initialData) {
        try {
          const draftString = await AsyncStorage.getItem(DRAFT_KEY);
          if (draftString) {
            const draft = JSON.parse(draftString);
            setFormData(prev => ({
              ...prev,
              ...draft,
              inventoryID: draft.inventoryID || inventories[0]?.inventoryID || null
            }));
          }
        } catch (e) {
          console.log('Draft load error', e);
        }
      }
    };
    loadDraftIfNeeded();
  }, [visible, initialData, inventories]);

  const saveDraft = async (data = formData) => {
    try {
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch (e) {
      console.log('Draft save error', e);
    }
  };

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_KEY);
    } catch (e) {
      console.log('Draft clear error', e);
    }
  };

  const sanitizeQuantityInput = (value) => {
    const stringValue = value?.toString() ?? '';
    const sanitized = stringValue.replace(/[^0-9.]/g, '');
    if (!sanitized) return '';
    const [whole, ...decimalParts] = sanitized.split('.');
    const decimal = decimalParts.join('');
    return decimal ? `${whole}.${decimal}` : whole;
  };

  const validateItemName = (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Item name is required';
    }
    if (trimmed.length < ITEM_NAME_MIN_LENGTH) {
      return `Item name must be at least ${ITEM_NAME_MIN_LENGTH} characters`;
    }
    if (trimmed.length > ITEM_NAME_MAX_LENGTH) {
      return `Item name must be ${ITEM_NAME_MAX_LENGTH} characters or fewer`;
    }
    if (!ITEM_NAME_REGEX.test(trimmed)) {
      return 'Only letters, numbers, spaces, hyphen, and apostrophe are allowed';
    }
    return '';
  };

  const validateQuantity = (value) => {
    if (value === null || value === undefined) {
      return 'Quantity is required';
    }
    const trimmed = sanitizeQuantityInput(value).trim();
    if (!trimmed) {
      return 'Quantity is required';
    }
    const numericValue = Number(trimmed);
    if (Number.isNaN(numericValue)) {
      return 'Quantity must be a number';
    }
    if (numericValue <= 0) {
      return 'Quantity must be greater than 0';
    }
    return '';
  };

  const validateCategory = (value) => (value ? '' : 'Category is required');
  const validateUnit = (value) => (value ? '' : 'Unit is required');
  const validateExpiration = (value) => (value ? '' : 'Expiration date is required');

  const fieldValidators = {
    itemName: validateItemName,
    itemCategory: validateCategory,
    quantity: validateQuantity,
    unit: validateUnit,
    itemExpiration: validateExpiration,
  };

  const setFieldError = (field, message) => {
    setFormErrors((prev) => {
      if (!message && !prev[field]) {
        return prev;
      }
      const next = { ...prev };
      if (message) {
        next[field] = message;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const validateForm = () => {
    const nextErrors = {};
    Object.entries(fieldValidators).forEach(([field, validator]) => {
      const error = validator(formData[field] ?? '');
      if (error) {
        nextErrors[field] = error;
      }
    });
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const updateField = (field, value) => {
    const next = { ...formData, [field]: value };

    // If category changed, validate that current unit is still allowed
    if (field === 'itemCategory') {
      const allowedUnits = getAllowedUnits(value);
      if (next.unit && !allowedUnits.includes(next.unit)) {
        // Clear unit if it's not allowed for the new category
        next.unit = '';
        setFieldError('unit', 'Unit cleared - select a valid unit for this category');
      }
    }

    setFormData(next);

    if (fieldValidators[field]) {
      setFieldError(field, fieldValidators[field](value));
    }

    saveDraft(next);
  };

  const handleQuantityChange = (text) => {
    const sanitized = sanitizeQuantityInput(text);
    updateField('quantity', sanitized);
  };

  // Get current date
  const getCurrentDate = () => {
    const today = new Date();
    return `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return '';
    if (typeof date === 'string') return date;
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  // Parse date string to Date object
  const parseDate = (dateString) => {
    if (!dateString) return new Date();
    if (dateString instanceof Date) return dateString;

    const parts = dateString.split('/');
    if (parts.length === 3) {
      return new Date(parts[2], parts[0] - 1, parts[1]);
    }
    return new Date(dateString);
  };

  // Handle date change
  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      updateField('itemExpiration', formatDate(selectedDate));
    }
  };

  // Pick image
  const pickImage = async (useCamera = false) => {
    try {
      let result;
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission needed', 'Camera permission is required');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission needed', 'Photo library permission is required');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        updateField('imageURL', result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Show image picker options
  const showImagePickerOptions = () => {
    setImagePickerVisible(true);
  };

  // Validate and save (preserve draft on invalid, clear on success)
  const handleSave = async () => {
    console.log('📋 Item Form - Validating and saving...', formData);
    const isValid = validateForm();
    if (!isValid) {
      console.log('❌ Validation failed: Missing required fields');
      await saveDraft();
      setValidationAlert({
        visible: true,
        message: 'Please complete all required fields. Item description is optional.'
      });
      return;
    }

    console.log('✅ Validation passed, calling onSave...');
    try {
      const saveResult = await onSave(formData);

      // Handle duplicate detection from parent
      if (saveResult?.status === 'duplicate-detected') {
        console.log('⚠️ Duplicate detected, showing local alert');
        setLocalDuplicateAlert({
          visible: true,
          existingItem: saveResult.existingItem,
          incomingItem: saveResult.incomingItem,
          mergeAvailable: saveResult.mergeAvailable
        });
        await saveDraft();
        return;
      }

      if (saveResult?.status === 'duplicate-cancelled') {
        console.log('ℹ️ Duplicate detected; keeping form open for user adjustments.');
        await saveDraft();
        return;
      }
      await clearDraft();
      // Reset after successful save
      setFormData({
        itemName: '',
        inventoryID: inventories[0]?.inventoryID || null,
        quantity: '',
        unit: '',
        itemCategory: '',
        itemDescription: '',
        itemExpiration: '',
        imageURL: null,
      });
      setFormErrors({});
      // Also ensure any pickers/modals are closed
      setCategoryModalVisible(false);
      setUnitModalVisible(false);
      setShowDatePicker(false);
      onClose();
    } catch (e) {
      // If save fails, keep draft
      await saveDraft();
      setValidationAlert({
        visible: true,
        message: e.message || 'Failed to save item. Please try again.'
      });
    }
  };

  // Close modal without clearing draft (used for system close)
  const handleClose = async () => {
    await saveDraft();
    onClose();
  };

  // NEW: Explicit cancel (user tapped Cancel) - clear form + draft
  const handleCancel = async () => {
    setFormData({
      itemName: '',
      inventoryID: inventories[0]?.inventoryID || null,
      quantity: '',
      unit: '',
      itemCategory: '',
      itemDescription: '',
      itemExpiration: '',
      imageURL: null,
    });
    setFormErrors({});
    await clearDraft();
    onClose();
  };

  // Update form data when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        itemName: initialData.itemName || '',
        inventoryID: initialData.inventoryID || inventories[0]?.inventoryID || null,
        quantity: initialData.quantity?.toString() || '',
        unit: initialData.unit || '',
        itemCategory: initialData.itemCategory || '',
        itemDescription: initialData.itemDescription || '',
        itemExpiration: initialData.itemExpiration || '',
        imageURL: initialData.imageURL || null,
      });
    } else {
      // Reset form when not editing
      setFormData({
        itemName: '',
        inventoryID: inventories[0]?.inventoryID || null,
        quantity: '',
        unit: '',
        itemCategory: '',
        itemDescription: '',
        itemExpiration: '',
        imageURL: null,
      });
    }
  }, [initialData, inventories]);

  return (
    <>
      <Modal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1 }}
            >
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditMode ? 'Edit Item' : 'Add New Item'}
                </Text>
                <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                  <Ionicons name="close" size={24} color="#555" />
                </TouchableOpacity>
              </View>

              {/* AI Recommendation Banner */}
              {isAIRecommendation && (
                <TouchableOpacity
                  onPress={() => aiReasoning && setReasoningModalVisible(true)}
                  activeOpacity={aiReasoning ? 0.7 : 1}
                  style={{
                    backgroundColor: '#E8F5E9',
                    padding: 16,
                    marginHorizontal: 24,
                    marginTop: 20,
                    marginBottom: 0,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#C8E6C9'
                  }}>
                  <MaterialCommunityIcons name="robot" size={24} color="#4CAF50" style={{ marginRight: 12 }} />
                  <Text style={{ color: '#2E7D32', fontSize: 14, flex: 1, lineHeight: 20 }}>
                    Details predicted by SousChef AI. Please verify and adjust if needed.
                    {aiReasoning && <Text style={{ fontWeight: '700' }}> (Tap for info)</Text>}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Reasoning Modal */}
              <Modal
                visible={reasoningModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setReasoningModalVisible(false)}
              >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                  <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                      <MaterialCommunityIcons name="brain" size={28} color="#81A969" style={{ marginRight: 12 }} />
                      <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A' }}>AI Prediction Logic</Text>
                    </View>
                    <Text style={{ fontSize: 16, color: '#444', lineHeight: 24 }}>{aiReasoning}</Text>
                    <TouchableOpacity
                      onPress={() => setReasoningModalVisible(false)}
                      style={{ marginTop: 24, backgroundColor: '#81A969', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
                    >
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalContentContainer}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalContent}>
                  {/* Image Upload */}
                  <TouchableOpacity
                    style={[styles.imageUploadArea, { height: Math.min(Math.max(SCREEN_HEIGHT * 0.25, 150), 250) }]}
                    onPress={showImagePickerOptions}
                  >
                    {formData.imageURL ? (
                      <Image
                        source={{ uri: formData.imageURL }}
                        style={styles.uploadedImage}
                      />
                    ) : (
                      <View style={styles.uploadPlaceholder}>
                        <Ionicons name="image-outline" size={40} color="#81A969" />
                        <Text style={styles.uploadText}>Add Photo</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Item Name */}
                  <TextInput
                    style={styles.input}
                    placeholder="Item Name *"
                    placeholderTextColor="#999"
                    value={formData.itemName}
                    maxLength={ITEM_NAME_MAX_LENGTH}
                    onChangeText={(text) => updateField('itemName', text)}
                  />
                  {!!formErrors.itemName && (
                    <Text style={styles.errorText}>{formErrors.itemName}</Text>
                  )}

                  {/* Category */}
                  <TouchableOpacity
                    style={styles.dropdownInput}
                    onPress={() => setCategoryModalVisible(true)}
                  >
                    <Text style={formData.itemCategory ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
                      {formData.itemCategory || 'Choose Category *'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#999" />
                  </TouchableOpacity>
                  {!!formErrors.itemCategory && (
                    <Text style={styles.errorText}>{formErrors.itemCategory}</Text>
                  )}

                  {/* Quantity and Unit Row */}
                  <View style={styles.formRow}>
                    <View style={styles.formColumn}>
                      <Text style={styles.columnLabel}>Quantity:</Text>
                      <TextInput
                        style={styles.smallInput}
                        placeholder="0"
                        placeholderTextColor="#999"
                        keyboardType="decimal-pad"
                        value={formData.quantity?.toString() ?? ''}
                        onChangeText={handleQuantityChange}
                      />
                      {!!formErrors.quantity && (
                        <Text style={styles.errorText}>{formErrors.quantity}</Text>
                      )}
                    </View>

                    <View style={styles.formColumn}>
                      <Text style={styles.columnLabel}>Unit:</Text>
                      <TouchableOpacity
                        style={styles.smallDropdown}
                        onPress={() => setUnitModalVisible(true)}
                      >
                        <Text style={formData.unit ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
                          {formData.unit || 'Select'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#999" />
                      </TouchableOpacity>
                      {!!formErrors.unit && (
                        <Text style={styles.errorText}>{formErrors.unit}</Text>
                      )}
                    </View>
                  </View>

                  {/* Date Section */}
                  <View style={styles.dateSection}>
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
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Text style={formData.itemExpiration ? styles.dateDisplayText : styles.dropdownPlaceholder}>
                          {formData.itemExpiration || 'Select Date'}
                        </Text>
                        <Ionicons name="calendar-outline" size={20} color="#999" />
                      </TouchableOpacity>
                    </View>
                    {!!formErrors.itemExpiration && (
                      <Text style={styles.errorText}>{formErrors.itemExpiration}</Text>
                    )}
                  </View>

                  {showDatePicker && (
                    <DateTimePicker
                      value={formData.itemExpiration ? parseDate(formData.itemExpiration) : new Date()}
                      mode="date"
                      display="default"
                      onChange={onDateChange}
                      minimumDate={new Date()}
                    />
                  )}

                  {/* Description */}
                  <Text style={styles.formLabel}>Item Description:</Text>
                  <TextInput
                    style={styles.textAreaInput}
                    placeholder="Describe this item (optional)"
                    placeholderTextColor="#999"
                    multiline={true}
                    numberOfLines={4}
                    value={formData.itemDescription}
                    onChangeText={(text) => updateField('itemDescription', text)}
                  />

                  {/* Action Buttons */}
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={handleSave}
                    >
                      <Text style={styles.saveButtonText}>
                        {isEditMode ? 'Update' : 'Save'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleCancel} // CHANGED (was handleClose)
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
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
            <ScrollView style={styles.categoryList}>
              {foodCategories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.categoryOption}
                  onPress={() => {
                    updateField('itemCategory', category);
                    setCategoryModalVisible(false);
                  }}
                >
                  <Text style={styles.categoryOptionText}>{category}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
            <ScrollView style={styles.categoryList}>
              {unitOptions.map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={styles.categoryOption}
                  onPress={() => {
                    updateField('unit', unit);
                    setUnitModalVisible(false);
                  }}
                >
                  <Text style={styles.categoryOptionText}>{unit}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Image Picker Alert */}
      <PantryAlert
        visible={imagePickerVisible}
        type="info"
        title="Add Photo"
        message="Choose how you'd like to add a photo to your item"
        onClose={() => setImagePickerVisible(false)}
        customIcon={
          <Ionicons name="camera-outline" size={64} color="#81A969" />
        }
      >
        <TouchableOpacity
          style={imagePickerStyles.optionButton}
          onPress={() => {
            setImagePickerVisible(false);
            pickImage(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="camera" size={24} color="#fff" />
          <Text style={imagePickerStyles.optionButtonText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={imagePickerStyles.optionButtonSecondary}
          onPress={() => {
            setImagePickerVisible(false);
            pickImage(false);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="images" size={24} color="#81A969" />
          <Text style={imagePickerStyles.optionButtonTextSecondary}>Choose from Library</Text>
        </TouchableOpacity>
      </PantryAlert>

      {/* Validation Error Alert */}
      <PantryAlert
        visible={validationAlert.visible}
        type="error"
        title="Missing Information"
        message={validationAlert.message}
        onClose={() => setValidationAlert({ visible: false, message: '' })}
      />

      {/* Local Duplicate Alert */}
      <PantryAlert
        visible={localDuplicateAlert.visible}
        type="info"
        title="Duplicate Item Detected"
        message={localDuplicateAlert.existingItem ?
          `"${localDuplicateAlert.existingItem.itemName}" already exists (${localDuplicateAlert.existingItem.quantity || 0} ${localDuplicateAlert.existingItem.unit || ''}).\n${localDuplicateAlert.mergeAvailable ? 'Merge quantities or add a separate entry?' : 'Units differ; merge unavailable. Add a separate entry?'}`
          : ''}
        onClose={() => {
          setLocalDuplicateAlert({
            visible: false,
            existingItem: null,
            incomingItem: null,
            mergeAvailable: false
          });
        }}
      >
        <View style={{ width: '100%', marginTop: 12, gap: 10 }}>
          {localDuplicateAlert.mergeAvailable && (
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
              onPress={async () => {
                // Call save with merge action
                const mergeData = {
                  ...formData,
                  forceSave: true,
                  duplicateAction: 'merge'
                };
                setLocalDuplicateAlert({ visible: false, existingItem: null, incomingItem: null, mergeAvailable: false });
                const result = await onSave(mergeData);
                if (result?.status !== 'duplicate-detected') {
                  await clearDraft();
                  setFormData({
                    itemName: '',
                    inventoryID: inventories[0]?.inventoryID || null,
                    quantity: '',
                    unit: '',
                    itemCategory: '',
                    itemDescription: '',
                    itemExpiration: '',
                    imageURL: null,
                  });
                  setFormErrors({});
                  onClose();
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>Merge Quantities</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={{
              backgroundColor: localDuplicateAlert.mergeAvailable ? '#fff' : '#81A969',
              borderWidth: localDuplicateAlert.mergeAvailable ? 2 : 0,
              borderColor: '#81A969',
              paddingVertical: 12,
              borderRadius: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2
            }}
            onPress={async () => {
              // Call save with add anyway action
              const addAnywayData = {
                ...formData,
                forceSave: true,
                duplicateAction: 'add-anyway'
              };
              setLocalDuplicateAlert({ visible: false, existingItem: null, incomingItem: null, mergeAvailable: false });
              const result = await onSave(addAnywayData);
              if (result?.status !== 'duplicate-detected') {
                await clearDraft();
                setFormData({
                  itemName: '',
                  inventoryID: inventories[0]?.inventoryID || null,
                  quantity: '',
                  unit: '',
                  itemCategory: '',
                  itemDescription: '',
                  itemExpiration: '',
                  imageURL: null,
                });
                setFormErrors({});
                onClose();
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={{
              color: localDuplicateAlert.mergeAvailable ? '#81A969' : '#fff',
              textAlign: 'center',
              fontWeight: '700',
              fontSize: 16
            }}>Add Anyway</Text>
          </TouchableOpacity>
        </View>
      </PantryAlert>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 50,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  modalScrollView: {
    flex: 1,
  },
  modalContentContainer: {
    paddingBottom: 40,
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  imageUploadArea: {
    width: '100%',
    backgroundColor: '#F0F7ED',
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    color: '#81A969',
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  dropdownInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  dropdownSelectedText: {
    fontSize: 16,
    color: '#333',
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 16,
  },
  formColumn: {
    flex: 1,
  },
  columnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginLeft: 4,
  },
  smallInput: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  smallDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateSection: {
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 120,
  },
  disabledInput: {
    backgroundColor: '#F5F5F5',
    borderColor: 'transparent',
  },
  dateDisplayText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  textAreaInput: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  buttonContainer: {
    marginTop: 8,
    flexDirection: 'column',
    gap: 16,
  },
  saveButton: {
    backgroundColor: '#81A969',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#81A969',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  categoryModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    maxHeight: '80%',
    paddingBottom: 30,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  categoryList: {
    paddingHorizontal: 24,
  },
  categoryOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  categoryOptionText: {
    fontSize: 17,
    color: '#333',
  },
  errorText: {
    color: '#FF5252',
    marginTop: -12,
    marginBottom: 16,
    fontSize: 13,
    marginLeft: 4,
  },
});

const imagePickerStyles = StyleSheet.create({
  optionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#81A969',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
    marginLeft: 12,
  },
  optionButtonSecondary: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#81A969',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionButtonTextSecondary: {
    color: '#81A969',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
    marginLeft: 12,
  },
});

export default ItemFormModal;
