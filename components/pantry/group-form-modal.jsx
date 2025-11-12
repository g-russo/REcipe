import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Group Form Modal Component
 * Reusable modal for creating/editing inventory groups
 */
const GroupFormModal = ({
  visible,
  onClose,
  onSave,
  initialData = null,
}) => {
  const isEditMode = !!initialData;

  // Form state
  const [formData, setFormData] = useState({
    groupTitle: '',
    groupColor: '#8BC34A',
    groupCategory: '', // NEW: Optional category
  });
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  // Simplified food categories (matching item categories)
  const foodCategories = [
    'Fruits', 'Vegetables', 'Meat & Poultry', 'Seafood', 'Dairy & Eggs',
    'Grains & Pasta', 'Canned & Jarred', 'Condiments & Sauces', 
    'Spices & Herbs', 'Snacks', 'Beverages', 'Frozen', 'Baking', 'Other'
  ];

  // Available colors
  const colorOptions = [
    '#8BC34A', // Green
    '#FF5722', // Red
    '#2196F3', // Blue
    '#9C27B0', // Purple
    '#FF9800', // Orange
    '#4CAF50', // Light Green
    '#E91E63', // Pink
    '#00BCD4', // Cyan
    '#FFC107', // Amber
    '#795548', // Brown
  ];

  // Update form when initial data changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        groupTitle: initialData.groupTitle || '',
        groupColor: initialData.groupColor || '#8BC34A',
        groupCategory: initialData.groupCategory || '',
      });
    }
  }, [initialData]);

  // Update field
  const updateField = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  // Validate and save
  const handleSave = () => {
    if (!formData.groupTitle.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    onSave(formData);
    
    // Reset form
    setFormData({
      groupTitle: '',
      groupColor: '#8BC34A',
      groupCategory: '',
    });
    onClose();
  };

  // Close modal and reset
  const handleClose = () => {
    setFormData({
      groupTitle: '',
      groupColor: '#8BC34A',
      groupCategory: '',
    });
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isEditMode ? 'Edit Group' : 'Create New Group'}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {/* Group Name */}
            <Text style={styles.label}>Group Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Spices, Baking Supplies, Vegetables"
              placeholderTextColor="#999"
              value={formData.groupTitle}
              onChangeText={(text) => updateField('groupTitle', text)}
            />

            {/* Category (Optional) */}
            <View style={styles.categorySection}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Category</Text>
                <Text style={styles.optionalBadge}>(Optional)</Text>
              </View>
              <Text style={styles.helperText}>
                Items in this category will prompt to add to this group
              </Text>
              <TouchableOpacity
                style={styles.categorySelectInput}
                onPress={() => setCategoryModalVisible(true)}
              >
                <Text
                  style={
                    formData.groupCategory
                      ? styles.dropdownSelectedText
                      : styles.dropdownPlaceholder
                  }
                >
                  {formData.groupCategory || 'None - No auto-suggestions'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#999" />
              </TouchableOpacity>
            </View>

            {/* Color Picker */}
            <Text style={styles.label}>Group Color</Text>
            <View style={styles.colorPickerContainer}>
              {colorOptions.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    formData.groupColor === color && styles.selectedColorOption,
                  ]}
                  onPress={() => updateField('groupColor', color)}
                >
                  {formData.groupColor === color && (
                    <Ionicons name="checkmark" size={24} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Info Text */}
            <Text style={styles.infoText}>
              Groups help you organize your pantry items into categories like "Spices", "Baking", or "Vegetables".
            </Text>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>
                {isEditMode ? 'Update Group' : 'Create Group'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
              <TouchableOpacity
                style={styles.categoryOption}
                onPress={() => {
                  updateField('groupCategory', '');
                  setCategoryModalVisible(false);
                }}
              >
                <Text style={styles.categoryOptionText}>None - No auto-suggestions</Text>
              </TouchableOpacity>

              {foodCategories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.categoryOption}
                  onPress={() => {
                    updateField('groupCategory', category);
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
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  scrollView: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  colorPickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorOption: {
    borderColor: '#333',
    borderWidth: 3,
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  addTagButton: {
    padding: 5,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  tagText: {
    fontSize: 14,
    color: '#555',
  },
  infoText: {
    fontSize: 13,
    color: '#999',
    marginTop: 15,
    lineHeight: 18,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  saveButton: {
    backgroundColor: '#8BC34A',
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
  categorySection: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  optionalBadge: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
    lineHeight: 16,
  },
  categorySelectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dropdownSelectedText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: '#999',
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
    maxHeight: '70%',
    paddingBottom: 20,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#333',
  },
});

export default GroupFormModal;
