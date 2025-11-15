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

  // Simplified food categories (matching group categories)
  const foodCategories = [
    'Fruits', 'Vegetables', 'Meat & Poultry', 'Seafood', 'Dairy & Eggs',
    'Grains & Pasta', 'Canned & Jarred', 'Condiments & Sauces', 
    'Spices & Herbs', 'Snacks', 'Beverages', 'Frozen', 'Baking', 'Other'
  ];

  // Units
  const unitOptions = [
    'oz', 'lb', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 
    'cup', 'pint', 'quart', 'gallon', 'each', 'bunch',
    'slice', 'package', 'can', 'bottle', 'box'
  ];

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

  // Update form field (persist draft)
  const updateField = (field, value) => {
    const next = { ...formData, [field]: value };
    setFormData(next);
    saveDraft(next);
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

  // Validate and save (preserve draft on invalid, clear on success)
  const handleSave = async () => {
    console.log('📋 Item Form - Validating and saving...', formData);
    if (!formData.itemName.trim()) {
      console.log('❌ Validation failed: Missing item name');
      await saveDraft();
      Alert.alert('Error', 'Please enter an item name');
      return;
    }
    if (!formData.itemCategory) {
      console.log('❌ Validation failed: Missing category');
      await saveDraft();
      Alert.alert('Error', 'Please select a category');
      return;
    }

    console.log('✅ Validation passed, calling onSave...');
    try {
      await onSave(formData);
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
            style={{flex: 1}}
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
                  onChangeText={(text) => updateField('itemName', text)}
                />
                
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
                
                {/* Quantity and Unit Row */}
                <View style={styles.formRow}>
                  <View style={styles.formColumn}>
                    <Text style={styles.columnLabel}>Quantity:</Text>
                    <TextInput 
                      style={styles.smallInput}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      value={formData.quantity.toString()}
                      onChangeText={(text) => updateField('quantity', text)}
                    />
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
                  </View>
                </View>
                
                {/* Date Section */}
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
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={formData.itemExpiration ? styles.dateDisplayText : styles.dropdownPlaceholder}>
                        {formData.itemExpiration || 'Select Date'}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#999" />
                    </TouchableOpacity>
                  </View>
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
                  placeholder="Type item description..."
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
    </>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
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
    paddingTop: 20,
  },
  imageUploadArea: {
    width: '100%',
    height: 200,
    backgroundColor: '#8ac551',
    borderRadius: 12,
    marginBottom: 20,
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
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
  },
  dropdownInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
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
    marginBottom: 15,
  },
  formColumn: {
    flex: 1,
    marginRight: 10,
  },
  columnLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  smallInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  smallDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  dateSection: {
    marginBottom: 15,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  formLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
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
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  buttonContainer: {
    marginTop: 10,
  },
  saveButton: {
    backgroundColor: '#8ac551',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#555',
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
});

export default ItemFormModal;
