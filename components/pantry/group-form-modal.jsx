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
  });

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
    });
    onClose();
  };

  // Close modal and reset
  const handleClose = () => {
    setFormData({
      groupTitle: '',
      groupColor: '#8BC34A',
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
