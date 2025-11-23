import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { Ionicons } from '@expo/vector-icons';
import IngredientSubstitutionService from '../../services/ingredient-substitution-service';
import SimpleSubstitutionService from '../../services/simple-ingredient-substitution-service';

/**
 * Cooking Complete Modal
 * Appears after user finishes cooking to ask which ingredients were fully used
 * Automatically deducts fully used ingredients from pantry
 * 
 * This is a simpler alternative to IngredientUsageConfirmationModal that focuses
 * on detecting pantry items automatically rather than requiring pre-computed substitutions
 */
const CookingCompleteModal = ({ visible, onClose, recipe, userID, usedPantryItems = [] }) => {
  const [loading, setLoading] = useState(false);
  const [pantryIngredients, setPantryIngredients] = useState([]);
  const [fullyUsedItems, setFullyUsedItems] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && recipe && userID) {
      loadPantryIngredients();
    }
  }, [visible, recipe, userID]);

  /**
   * Load pantry items that match recipe ingredients
   */
  const loadPantryIngredients = async () => {
    setLoading(true);
    try {
      // Get user's pantry items
      const items = await IngredientSubstitutionService.getUserPantryItems(userID);
      
      // Get recipe ingredients
      const recipeIngredients = recipe.ingredientLines || recipe.ingredients || [];
      
      // Match recipe ingredients with pantry
      const result = IngredientSubstitutionService.checkIngredientAvailability(
        recipeIngredients,
        items
      );

      // Get full pantry item details for available ingredients
      const matchedPantryItems = [];
      result.available.forEach(ingredient => {
        const ingredientText = ingredient.text || ingredient;
        const ingredientName = IngredientSubstitutionService.normalizeIngredientName(ingredientText);
        
        const pantryItem = items.find(item => 
          IngredientSubstitutionService.fuzzyMatch(
            IngredientSubstitutionService.normalizeIngredientName(item.itemName), 
            ingredientName
          )
        );

        if (pantryItem) {
          matchedPantryItems.push({
            ...pantryItem,
            recipeIngredient: ingredientText,
            displayName: pantryItem.itemName,
            displayQuantity: `${pantryItem.quantity} ${pantryItem.unit || 'pcs'}`
          });
        }
      });

      setPantryIngredients(matchedPantryItems);
    } catch (error) {
      console.error('Error loading pantry ingredients:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Toggle ingredient as fully used
   */
  const toggleFullyUsed = (itemID) => {
    setFullyUsedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemID)) {
        newSet.delete(itemID);
      } else {
        newSet.add(itemID);
      }
      return newSet;
    });
  };

  /**
   * Save and deduct fully used ingredients from pantry
   */
  const handleConfirm = async () => {
    setSaving(true);
    try {
      const itemsToDeduct = pantryIngredients.filter(item => 
        fullyUsedItems.has(item.itemID)
      );

      console.log(`🍳 Deducting ${itemsToDeduct.length} fully used ingredients from pantry`);

      // Use SimpleSubstitutionService's deleteUsedIngredients method
      const result = await SimpleSubstitutionService.deleteUsedIngredients(
        userID,
        itemsToDeduct.map(item => ({
          pantryItemId: item.itemID,
          ingredientName: item.itemName
        }))
      );

      if (result.success) {
        const deletedCount = result.deleted.length;
        const failedCount = result.failed.length;
        
        console.log(`✅ Successfully deleted ${deletedCount} ingredients from pantry`);
        
        if (failedCount > 0) {
          console.warn(`⚠️ Failed to delete ${failedCount} ingredients`);
        }
        
        onClose(true); // Close with success flag
      } else {
        console.error('❌ Failed to delete ingredients from pantry');
        onClose(false);
      }
    } catch (error) {
      console.error('Error updating pantry:', error);
      onClose(false);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Skip without deducting anything
   */
  const handleSkip = () => {
    onClose(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="checkmark-circle" size={wp('8%')} color="#81A969" />
            <Text style={styles.title}>Cooking Complete! 🎉</Text>
            <Text style={styles.subtitle}>
              Which ingredients did you fully use up?
            </Text>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#81A969" />
              <Text style={styles.loadingText}>Loading your pantry...</Text>
            </View>
          ) : pantryIngredients.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={wp('15%')} color="#ccc" />
              <Text style={styles.emptyText}>
                No pantry ingredients were used in this recipe
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.ingredientsList}>
              <Text style={styles.instructionText}>
                Tap items that are now empty to remove them from your pantry:
              </Text>
              
              {pantryIngredients.map((item) => {
                const isFullyUsed = fullyUsedItems.has(item.itemID);
                
                return (
                  <TouchableOpacity
                    key={item.itemID}
                    style={[
                      styles.ingredientCard,
                      isFullyUsed && styles.ingredientCardSelected
                    ]}
                    onPress={() => toggleFullyUsed(item.itemID)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.ingredientInfo}>
                      <Text style={[
                        styles.ingredientName,
                        isFullyUsed && styles.ingredientNameSelected
                      ]}>
                        {item.displayName}
                      </Text>
                      <Text style={styles.ingredientQuantity}>
                        Had: {item.displayQuantity}
                      </Text>
                    </View>
                    
                    <View style={[
                      styles.checkbox,
                      isFullyUsed && styles.checkboxChecked
                    ]}>
                      {isFullyUsed && (
                        <Ionicons name="checkmark" size={wp('5%')} color="#fff" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Footer Buttons */}
          {!loading && pantryIngredients.length > 0 && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.button, styles.skipButton]}
                onPress={handleSkip}
                disabled={saving}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirm}
                disabled={saving || fullyUsedItems.size === 0}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={wp('5%')} color="#fff" />
                    <Text style={styles.confirmButtonText}>
                      Confirm ({fullyUsedItems.size})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {!loading && pantryIngredients.length === 0 && (
            <TouchableOpacity
              style={[styles.button, styles.confirmButton, { marginTop: hp('2%') }]}
              onPress={handleSkip}
            >
              <Text style={styles.confirmButtonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: wp('5%'),
    borderTopRightRadius: wp('5%'),
    maxHeight: hp('80%'),
    paddingBottom: hp('2%'),
  },
  header: {
    alignItems: 'center',
    padding: wp('5%'),
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: wp('5.5%'),
    fontWeight: 'bold',
    color: '#333',
    marginTop: hp('1%'),
  },
  subtitle: {
    fontSize: wp('3.8%'),
    color: '#666',
    marginTop: hp('0.5%'),
    textAlign: 'center',
  },
  loadingContainer: {
    padding: wp('10%'),
    alignItems: 'center',
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: wp('4%'),
    color: '#666',
  },
  emptyContainer: {
    padding: wp('10%'),
    alignItems: 'center',
  },
  emptyText: {
    marginTop: hp('2%'),
    fontSize: wp('4%'),
    color: '#666',
    textAlign: 'center',
  },
  ingredientsList: {
    maxHeight: hp('50%'),
    padding: wp('5%'),
  },
  instructionText: {
    fontSize: wp('3.5%'),
    color: '#666',
    marginBottom: hp('2%'),
    textAlign: 'center',
  },
  ingredientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: wp('4%'),
    backgroundColor: '#f9f9f9',
    borderRadius: wp('3%'),
    marginBottom: hp('1%'),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ingredientCardSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#81A969',
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#333',
  },
  ingredientNameSelected: {
    color: '#81A969',
  },
  ingredientQuantity: {
    fontSize: wp('3.2%'),
    color: '#999',
    marginTop: hp('0.3%'),
  },
  checkbox: {
    width: wp('7%'),
    height: wp('7%'),
    borderRadius: wp('1.5%'),
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#81A969',
    borderColor: '#81A969',
  },
  footer: {
    flexDirection: 'row',
    padding: wp('5%'),
    gap: wp('3%'),
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: hp('1.8%'),
    borderRadius: wp('3%'),
    gap: wp('2%'),
  },
  skipButton: {
    backgroundColor: '#f0f0f0',
  },
  skipButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    backgroundColor: '#81A969',
  },
  confirmButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#fff',
  },
});

export default CookingCompleteModal;
