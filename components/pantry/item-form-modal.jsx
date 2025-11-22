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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PantryAlert from './pantry-alert';

const ITEM_NAME_REGEX = /^[a-zA-Z0-9\s'-]+$/;
const ITEM_NAME_MIN_LENGTH = 2;
const ITEM_NAME_MAX_LENGTH = 60;

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
  const isEditMode = !!initialData;

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
    if (!category) return Object.values(allUnits).flat(); // Return all if no category selected

    switch (category) {
      // Cooked Food
      case 'Rice':
      case 'Leftovers':
      case 'Kakanin':
        return [...allUnits.serving, 'g', 'kg'];

      // Liquidy Cooked Food
      case 'Soup':
        return [...allUnits.serving, ...allUnits.volume];

      // Liquids
      case 'Beverages':
      case 'Sauces':
      case 'Condiments':
      case 'Dairy':
        return [...allUnits.volume, ...allUnits.small];

      // Raw Meat / Seafood (Strictly Weight/Count)
      case 'Meat':
      case 'Poultry':
      case 'Seafood':
      case 'Frozen':
        return [...allUnits.weight, 'pieces', 'each', 'tray'];

      // Baking / Grains / Spices (Weight + Vol + Small)
      case 'Baking':
      case 'Grains':
      case 'Pasta':
      case 'Noodles':
      case 'Spices':
      case 'Herbs':
        return [...allUnits.weight, ...allUnits.small, 'cup', 'jar', 'can'];

      // Produce
      case 'Fruits':
      case 'Vegetables':
        return [...allUnits.weight, ...allUnits.count, 'cup'];

      // Eggs
      case 'Eggs':
        return ['each', 'dozen', 'tray', 'pieces'];

      // Canned Goods
      case 'Canned':
      case 'Jarred':
        return ['can', 'jar', 'bottle', ...allUnits.weight];

      default:
        return Object.values(allUnits).flat();
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
      Alert.alert('Missing Information', 'Please complete all required fields. Item description is optional.');
      return;
    }

    console.log('✅ Validation passed, calling onSave...');
    try {
      const saveResult = await onSave(formData);
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
      Alert.alert('Error', e.message || 'Save failed');
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
        transparent={false}
        visible={visible}
        onRequestClose={handleClose}
      >
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

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalContentContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalContent}>
                {/* Image Upload */}
                <TouchableOpacity
                  style={styles.imageUploadArea}
                  onPress={showImagePickerOptions}
                >
                  {formData.imageURL ? (
                    <Image
                      source={{ uri: formData.imageURL }}
                      style={styles.uploadedImage}
                    />
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Ionicons name="image-outline" size={32} color="#fff" />
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
    </>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  modalScrollView: {
    flex: 1,
  },
  modalContentContainer: {
    paddingBottom: 30,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  imageUploadArea: {
    width: '100%',
    height: 180,
    backgroundColor: '#81A969',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  uploadPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
  },
  dropdownInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
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
    marginBottom: 10,
    gap: 10,
  },
  formColumn: {
    flex: 1,
    marginRight: 0,
  },
  columnLabel: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
  },
  smallInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: '#333',
  },
  smallDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateSection: {
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  formLabel: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
  },
  dateDisplayText: {
    fontSize: 16,
    color: '#333',
  },
  textAreaInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
    height: 90,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  buttonContainer: {
    marginTop: 8,
    flexDirection: 'column',
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#81A969',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 13,
    alignItems: 'center',
    width: '100%',
  },
  cancelButtonText: {
    color: '#888',
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '70%',
  },
  categoryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  categoryList: {
    paddingHorizontal: 20,
  },
  categoryOption: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#333',
  },
  errorText: {
    color: '#d9534f',
    marginTop: 4,
    marginBottom: 10,
    fontSize: 13,
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
