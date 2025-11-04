import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import IngredientSelector from './ingredient-selector';
import SubstituteSelector from './substitute-selector';
import ActionButtons from './action-buttons';
import IngredientSubstitutionService from '../../services/ingredient-substitution-service';

/**
 * Ingredient Substitution Modal
 * Two-step process: Select ingredient to replace, then select substitute
 */
const IngredientSubstitutionModal = ({ 
  visible, 
  onClose, 
  onConfirm,
  missingIngredients,
  userID 
}) => {
  const [step, setStep] = useState(1); // 1 = select ingredient, 2 = select substitute
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [selectedSubstitute, setSelectedSubstitute] = useState(null);
  const [substitutes, setSubstitutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [substitutionMap, setSubstitutionMap] = useState({});

  useEffect(() => {
    if (visible) {
      // Reset state when modal opens
      setStep(1);
      setSelectedIngredient(null);
      setSelectedSubstitute(null);
      setSubstitutes([]);
      setSubstitutionMap({});
    }
  }, [visible]);

  // Handle ingredient selection and fetch substitutes
  const handleSelectIngredient = async (ingredient) => {
    setSelectedIngredient(ingredient);
  };

  // Parse quantity and unit from ingredient string using the service
  const parseIngredientQuantity = (ingredient) => {
    const text = typeof ingredient === 'string' ? ingredient : (ingredient.text || ingredient);
    
    // Use the service's parseQuantityFromText which has priority-based measurement parsing
    const parsed = IngredientSubstitutionService.parseQuantityFromText(text);
    
    if (parsed) {
      return { quantity: parsed.value, unit: parsed.unit };
    }
    
    return { quantity: 1, unit: 'pcs' };
  };

  // Handle "Continue" from ingredient selection
  const handleContinueFromStep1 = async () => {
    if (!selectedIngredient) {
      Alert.alert('No Selection', 'Please select an ingredient to replace');
      return;
    }

    setLoading(true);
    try {
      // Get user's pantry items
      const pantryItems = await IngredientSubstitutionService.getUserPantryItems(userID);
      
      // Get smart substitutions for the selected ingredient
      const ingredientName = IngredientSubstitutionService.normalizeIngredientName(selectedIngredient);
      const originalText = typeof selectedIngredient === 'string' ? selectedIngredient : (selectedIngredient.text || selectedIngredient);
      const suggestions = IngredientSubstitutionService.findSubstitutes(ingredientName, pantryItems, originalText);

      if (suggestions.length === 0) {
        Alert.alert(
          'No Substitutes Found',
          'No suitable substitutes found in your pantry. Would you like to proceed without this ingredient?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Proceed', 
              onPress: () => {
                // Mark as substituted with null (omit ingredient)
                const newMap = { ...substitutionMap };
                newMap[selectedIngredient] = { name: 'Omit', category: 'none' };
                onConfirm(newMap);
                onClose();
              }
            }
          ]
        );
        setLoading(false);
        return;
      }

      setSubstitutes(suggestions);
      setStep(2);
    } catch (error) {
      console.error('Error fetching substitutes:', error);
      Alert.alert('Error', 'Failed to fetch substitutes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle "Confirm" from substitute selection
  const handleConfirmSubstitution = () => {
    if (!selectedSubstitute) {
      Alert.alert('No Selection', 'Please select a substitute ingredient');
      return;
    }

    // Add to substitution map
    const newMap = { ...substitutionMap };
    newMap[selectedIngredient] = selectedSubstitute;

    // Check if there are more missing ingredients
    const remainingMissing = missingIngredients.filter(
      ing => !(ing.text || ing) in newMap
    );

    if (remainingMissing.length > 0) {
      Alert.alert(
        'Continue Substituting?',
        `You have ${remainingMissing.length} more missing ingredient(s). Would you like to substitute another?`,
        [
          {
            text: 'Done',
            onPress: () => {
              onConfirm(newMap);
              onClose();
            }
          },
          {
            text: 'Yes',
            onPress: () => {
              setSubstitutionMap(newMap);
              setStep(1);
              setSelectedIngredient(null);
              setSelectedSubstitute(null);
            }
          }
        ]
      );
    } else {
      // All missing ingredients have been handled
      onConfirm(newMap);
      onClose();
    }
  };

  // Handle "Go Back" from substitute selection
  const handleGoBack = () => {
    setStep(1);
    setSelectedSubstitute(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6B9B6E" />
          </View>
        ) : (
          <>
            {step === 1 ? (
              <>
                <IngredientSelector
                  ingredients={missingIngredients}
                  selectedIngredient={selectedIngredient}
                  onSelectIngredient={handleSelectIngredient}
                />
                <ActionButtons
                  primaryText="Continue"
                  secondaryText="Cancel"
                  onPressPrimary={handleContinueFromStep1}
                  onPressSecondary={onClose}
                  primaryDisabled={!selectedIngredient}
                />
              </>
            ) : (
              <>
                <SubstituteSelector
                  originalIngredient={selectedIngredient}
                  originalQuantity={parseIngredientQuantity(selectedIngredient).quantity}
                  originalUnit={parseIngredientQuantity(selectedIngredient).unit}
                  substitutes={substitutes}
                  selectedSubstitute={selectedSubstitute}
                  onSelectSubstitute={setSelectedSubstitute}
                  pantryScanned={true}
                />
                <ActionButtons
                  primaryText="Confirm"
                  secondaryText="Go Back"
                  onPressPrimary={handleConfirmSubstitution}
                  onPressSecondary={handleGoBack}
                  primaryDisabled={!selectedSubstitute}
                />
              </>
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default IngredientSubstitutionModal;
