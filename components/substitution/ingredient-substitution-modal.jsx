import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import IngredientSelector from './ingredient-selector';
import SubstituteSelector from './substitute-selector';
import ActionButtons from './action-buttons';
import NoSubstitutesModal from './no-substitutes-modal';
import SelectionRequiredModal from './selection-required-modal';
import ContinueSubstitutingModal from './continue-substituting-modal';
import ErrorModal from './error-modal';
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
  const [showNoSubstitutesModal, setShowNoSubstitutesModal] = useState(false);
  const [noSubstituteIngredientName, setNoSubstituteIngredientName] = useState('');
  
  // Custom modals state
  const [showSelectionRequiredModal, setShowSelectionRequiredModal] = useState(false);
  const [selectionRequiredType, setSelectionRequiredType] = useState('ingredient');
  const [showContinueSubstitutingModal, setShowContinueSubstitutingModal] = useState(false);
  const [continueSubstitutingData, setContinueSubstitutingData] = useState({});
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (visible) {
      // Reset state when modal opens
      setStep(1);
      setSelectedIngredient(null);
      setSelectedSubstitute(null);
      setSubstitutes([]);
      setSubstitutionMap({});
      setShowNoSubstitutesModal(false);
      setNoSubstituteIngredientName('');
      
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

  // Extract ingredient name for display
  const getIngredientName = (ingredient) => {
    return typeof ingredient === 'string' ? ingredient : (ingredient.text || ingredient);
  };

  // Handle "Continue" from ingredient selection
  const handleContinueFromStep1 = async () => {
    if (!selectedIngredient) {
      setSelectionRequiredType('ingredient');
      setShowSelectionRequiredModal(true);
      return;
    }

    setLoading(true);
    try {
      // Get SousChef AI-powered substitutions for the selected ingredient
      const ingredientName = IngredientSubstitutionService.normalizeIngredientName(selectedIngredient);
      const originalText = typeof selectedIngredient === 'string' ? selectedIngredient : (selectedIngredient.text || selectedIngredient);
      
      // Use SousChef AI (with automatic fallback to rule-based)
      console.log('🤖 Requesting SousChef AI substitutions...');
      const suggestions = await IngredientSubstitutionService.getAISubstitutions(
        ingredientName,
        pantryItems,
        '', // recipe name (optional, could pass from props if available)
        '', // cooking method (optional, could detect from recipe)
        originalText // pass original text for better unit detection
      );

      if (suggestions.length === 0) {
        // Show custom modal instead of Alert
        const ingredientDisplayName = IngredientSubstitutionService.normalizeIngredientName(selectedIngredient);
        setNoSubstituteIngredientName(ingredientDisplayName);
        setShowNoSubstitutesModal(true);
        setLoading(false);
        return;
      }

      setSubstitutes(suggestions);
      setStep(2);
    } catch (error) {
      console.error('Error fetching substitutes:', error);
      setErrorMessage('Failed to fetch substitutes. Please try again.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle "Confirm" from substitute selection
  const handleConfirmSubstitution = () => {
    if (!selectedSubstitute) {
      setSelectionRequiredType('substitute');
      setShowSelectionRequiredModal(true);
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
      setContinueSubstitutingData({
        newMap,
        remainingCount: remainingMissing.length,
      });
      setShowContinueSubstitutingModal(true);
    } else {
      // All missing ingredients have been handled
      onConfirm(newMap);
      onClose();
    }
  };

  // Handle "Done" from continue substituting modal
  const handleDoneSubstituting = () => {
    setShowContinueSubstitutingModal(false);
    onConfirm(continueSubstitutingData.newMap);
    onClose();
  };

  // Handle "Continue" from continue substituting modal
  const handleContinueSubstitutingAgain = () => {
    setShowContinueSubstitutingModal(false);
    setSubstitutionMap(continueSubstitutingData.newMap);
    setStep(1);
    setSelectedIngredient(null);
    setSelectedSubstitute(null);
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
                  originalIngredient={getIngredientName(selectedIngredient)}
                  originalQuantity={IngredientSubstitutionService.parseQuantityFromText(getIngredientName(selectedIngredient), pantryItems)?.value || 1}
                  originalUnit={IngredientSubstitutionService.parseQuantityFromText(getIngredientName(selectedIngredient), pantryItems)?.unit || ''}
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

      {/* No Substitutes Found Modal */}
      <NoSubstitutesModal
        visible={showNoSubstitutesModal}
        onClose={() => setShowNoSubstitutesModal(false)}
        ingredientName={noSubstituteIngredientName}
      />

      {/* Selection Required Modal */}
      <SelectionRequiredModal
        visible={showSelectionRequiredModal}
        onClose={() => setShowSelectionRequiredModal(false)}
        type={selectionRequiredType}
      />

      {/* Continue Substituting Modal */}
      <ContinueSubstitutingModal
        visible={showContinueSubstitutingModal}
        onDone={handleDoneSubstituting}
        onContinue={handleContinueSubstitutingAgain}
        remainingCount={continueSubstitutingData.remainingCount}
      />

      {/* Error Modal */}
      <ErrorModal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        message={errorMessage}
      />
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
