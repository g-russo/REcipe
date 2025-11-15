import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
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
  const [pantryItems, setPantryItems] = useState([]); // Store pantry items for parsing

  useEffect(() => {
    if (visible) {
      // Reset state when modal opens
      setStep(1);
      setSelectedIngredient(null);
      setSelectedSubstitute(null);
      setSubstitutes([]);
      setSubstitutionMap({});
      
      // Fetch pantry items early for better parsing
      const fetchPantry = async () => {
        try {
          const items = await IngredientSubstitutionService.getUserPantryItems(userID);
          setPantryItems(items);
        } catch (error) {
          console.error('Error fetching pantry items:', error);
        }
      };
      fetchPantry();
    }
  }, [visible, userID]);

  // Handle ingredient selection and fetch substitutes
  const handleSelectIngredient = async (ingredient) => {
    setSelectedIngredient(ingredient);
  };

  // Parse quantity and unit from ingredient string using the service
  const parseIngredientQuantity = (ingredient) => {
    const text = typeof ingredient === 'string' ? ingredient : (ingredient.text || ingredient);
    
    // Use the service's parseQuantityFromText which has priority-based measurement parsing
    // Pass pantryItems for better unit detection (prioritizes pantry's unit over pcs)
    const parsed = IngredientSubstitutionService.parseQuantityFromText(text, pantryItems);
    
    if (parsed) {
      return { 
        quantity: parsed.value, 
        unit: parsed.unit,
        isVague: parsed.isVague || false
      };
    }
    
    return { quantity: 1, unit: 'pcs', isVague: false };
  };

  // Handle "Continue" from ingredient selection
  const handleContinueFromStep1 = async () => {
    if (!selectedIngredient) {
      Alert.alert('No Selection', 'Please select an ingredient to replace');
      return;
    }

    setLoading(true);
    try {
      // Get AI-powered substitutions for the selected ingredient
      const ingredientName = IngredientSubstitutionService.normalizeIngredientName(selectedIngredient);
      const originalText = typeof selectedIngredient === 'string' ? selectedIngredient : (selectedIngredient.text || selectedIngredient);
      
      // Try AI substitution first
      console.log('🤖 Requesting AI substitutions...');
      const suggestions = await IngredientSubstitutionService.getAISubstitutions(
        ingredientName,
        pantryItems,
        '', // recipe name (optional, could pass from props if available)
        '' // cooking method (optional, could detect from recipe)
      );

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
                  isVagueUnit={parseIngredientQuantity(selectedIngredient).isVague}
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

      {/* AI Loading Overlay */}
      {loading && (
        <View style={styles.aiLoadingOverlay}>
          <View style={styles.aiLoadingCard}>
            <ActivityIndicator size="large" color="#8ac551" />
            <Text style={styles.aiLoadingTitle}>SousChef AI is Thinking...</Text>
            <Text style={styles.aiLoadingText}>Finding the best substitutes{' \n'}from your pantry</Text>
          </View>
        </View>
      )}
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
  aiLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  aiLoadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 280,
  },
  aiLoadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8ac551',
    marginTop: 16,
    textAlign: 'center',
  },
  aiLoadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default IngredientSubstitutionModal;
