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
    inventoryName: '',
    inventoryColor: '#8BC34A',
    inventoryTags: [],
    maxItems: 100,
  });

  const [tagInput, setTagInput] = useState('');

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
        inventoryName: initialData.inventoryName || '',
        inventoryColor: initialData.inventoryColor || '#8BC34A',
        inventoryTags: initialData.inventoryTags || [],
        maxItems: initialData.maxItems || 100,
      });
    }
  }, [initialData]);

  // Update field
  const updateField = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  // Add tag
  const addTag = () => {
    if (!tagInput.trim()) return;
    
    if (formData.inventoryTags.length >= 5) {
      Alert.alert('Limit Reached', 'Maximum 5 tags allowed');
      return;
    }

    if (formData.inventoryTags.includes(tagInput.trim())) {
      Alert.alert('Duplicate', 'This tag already exists');
      return;
    }

    updateField('inventoryTags', [...formData.inventoryTags, tagInput.trim()]);
    setTagInput('');
  };

  // Remove tag
  const removeTag = (tagToRemove) => {
    updateField(
      'inventoryTags',
      formData.inventoryTags.filter(tag => tag !== tagToRemove)
    );
  };

  // Validate and save
  const handleSave = () => {
    if (!formData.inventoryName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    onSave(formData);
    handleClose();
  };

  // Close modal and reset
  const handleClose = () => {
    setFormData({
      inventoryName: '',
      inventoryColor: '#8BC34A',
      inventoryTags: [],
      maxItems: 100,
    });
    setTagInput('');
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
              value={formData.inventoryName}
              onChangeText={(text) => updateField('inventoryName', text)}
            />

            {/* Color Picker */}
            <Text style={styles.label}>Group Color</Text>
            <View style={styles.colorPickerContainer}>
              {colorOptions.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    formData.inventoryColor === color && styles.selectedColorOption,
                  ]}
                  onPress={() => updateField('inventoryColor', color)}
                >
                  {formData.inventoryColor === color && (
                    <Ionicons name="checkmark" size={24} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Tags */}
            <Text style={styles.label}>Tags (Optional)</Text>
            <View style={styles.tagInputContainer}>
              <TextInput
                style={styles.tagInput}
                placeholder="Add a tag..."
                placeholderTextColor="#999"
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
                returnKeyType="done"
              />
              <TouchableOpacity 
                style={styles.addTagButton}
                onPress={addTag}
              >
                <Ionicons name="add-circle" size={28} color="#8BC34A" />
              </TouchableOpacity>
            </View>

            {/* Display Tags */}
            {formData.inventoryTags.length > 0 && (
              <View style={styles.tagsContainer}>
                {formData.inventoryTags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                    <TouchableOpacity onPress={() => removeTag(tag)}>
                      <Ionicons name="close-circle" size={18} color="#666" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Max Items */}
            <Text style={styles.label}>Maximum Items</Text>
            <TextInput
              style={styles.input}
              placeholder="100"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={formData.maxItems.toString()}
              onChangeText={(text) => updateField('maxItems', parseInt(text) || 100)}
            />

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
});

export default GroupFormModal;
