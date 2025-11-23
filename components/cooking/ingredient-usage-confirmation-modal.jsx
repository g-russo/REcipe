import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

/**
 * Post-Cooking Ingredient Confirmation Modal
 * 
 * Shows list of substituted ingredients after cooking
 * Asks user which ingredients were fully used
 * Deletes selected ingredients from pantry
 */
const IngredientUsageConfirmationModal = ({
  visible,
  onClose,
  substitutedIngredients = [],
  onConfirm,
  loading = false
}) => {
  const [selectedItems, setSelectedItems] = useState(new Set());

  const toggleSelection = (itemId) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleConfirm = () => {
    const selectedIds = Array.from(selectedItems);
    onConfirm(selectedIds);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === substitutedIngredients.length) {
      // Deselect all
      setSelectedItems(new Set());
    } else {
      // Select all - use pantryItemId or fallback to ingredient name as unique key
      const allIds = substitutedIngredients.map(sub => 
        sub.pantryItemId || `name_${sub.ingredientName || sub.pantryItem?.itemName}`
      );
      setSelectedItems(new Set(allIds));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="checkmark-circle" size={40} color="#81A969" />
            <Text style={styles.title}>Cooking Complete!</Text>
            <Text style={styles.subtitle}>
              Which ingredients were fully used?
            </Text>
          </View>

          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              Select the ingredients you completely used up during cooking. 
              They will be removed from your pantry.
            </Text>
          </View>

          {/* Ingredient List */}
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {substitutedIngredients.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="leaf-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No substituted ingredients</Text>
              </View>
            ) : (
              substitutedIngredients.map((sub, index) => {
                // Use pantryItemId or fallback to name-based key
                const itemKey = sub.pantryItemId || `name_${sub.ingredientName || sub.pantryItem?.itemName}_${index}`;
                const isSelected = selectedItems.has(itemKey);
                
                return (
                  <TouchableOpacity
                    key={itemKey}
                    style={[styles.ingredientItem, isSelected && styles.selectedItem]}
                    onPress={() => toggleSelection(itemKey)}
                    activeOpacity={0.7}
                  >
                    {/* Checkbox */}
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      )}
                    </View>

                    {/* Ingredient Info */}
                    <View style={styles.ingredientInfo}>
                      {sub.isFromPantry ? (
                        // Pantry item (not substituted, just used from pantry)
                        <View>
                          <Text style={styles.substitutedText}>{sub.substituted}</Text>
                          <Text style={styles.pantryItemLabel}>
                            From pantry: <Text style={styles.pantryItemName}>{sub.pantryItem?.itemName}</Text>
                          </Text>
                        </View>
                      ) : (
                        // Substituted ingredient
                        <View>
                          <View style={styles.substitutionRow}>
                            <Text style={styles.originalText}>{sub.original}</Text>
                            <Ionicons name="arrow-forward" size={16} color="#999" />
                            <Text style={styles.substitutedText}>{sub.substituted}</Text>
                          </View>
                          <Text style={styles.pantryItemLabel}>
                            From pantry: <Text style={styles.pantryItemName}>{sub.pantryItem?.itemName}</Text>
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Select All / Deselect All */}
          {substitutedIngredients.length > 0 && (
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={handleSelectAll}
            >
              <Ionicons
                name={selectedItems.size === substitutedIngredients.length ? "checkbox" : "square-outline"}
                size={20}
                color="#81A969"
              />
              <Text style={styles.selectAllText}>
                {selectedItems.size === substitutedIngredients.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.skipButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                selectedItems.size === 0 && styles.disabledButton
              ]}
              onPress={handleConfirm}
              disabled={selectedItems.size === 0 || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.confirmButtonText}>
                    Remove ({selectedItems.size})
                  </Text>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  instructions: {
    backgroundColor: '#F0F7ED',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    textAlign: 'center',
  },
  list: {
    maxHeight: 300,
    marginBottom: 15,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedItem: {
    backgroundColor: '#E8F5E1',
    borderColor: '#81A969',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxSelected: {
    backgroundColor: '#81A969',
    borderColor: '#81A969',
  },
  ingredientInfo: {
    flex: 1,
  },
  substitutionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    flexWrap: 'wrap',
  },
  originalText: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  substitutedText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginLeft: 8,
  },
  pantryItemLabel: {
    fontSize: 12,
    color: '#666',
  },
  pantryItemName: {
    fontWeight: '600',
    color: '#81A969',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F0F7ED',
    borderRadius: 10,
    marginBottom: 15,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#81A969',
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  skipButton: {
    backgroundColor: '#F5F5F5',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    backgroundColor: '#81A969',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
});

export default IngredientUsageConfirmationModal;
