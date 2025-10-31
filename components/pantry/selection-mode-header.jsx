import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Selection Mode Header Component
 * Shows when user is in selection mode for adding items to groups
 */
const SelectionModeHeader = ({ 
  selectedCount, 
  onCancel, 
  onAddToGroup,
  isDisabled 
}) => {
  return (
    <View style={styles.selectionModeHeader}>
      <TouchableOpacity 
        style={styles.selectionModeButton} 
        onPress={onCancel}
      >
        <Ionicons name="close-outline" size={24} color="#fff" />
        <Text style={styles.selectionModeButtonText}>Cancel</Text>
      </TouchableOpacity>
      
      <Text style={styles.selectionModeTitle}>
        {selectedCount} selected
      </Text>
      
      <TouchableOpacity 
        style={[
          styles.selectionModeButton, 
          isDisabled && styles.disabledButton
        ]} 
        onPress={onAddToGroup}
        disabled={isDisabled}
      >
        <Ionicons name="folder-outline" size={20} color="#fff" />
        <Text style={styles.selectionModeButtonText}>Add to Group</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  selectionModeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#8BC34A',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  selectionModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  selectionModeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  selectionModeTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default SelectionModeHeader;
