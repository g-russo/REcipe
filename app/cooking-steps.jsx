import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Animated,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCustomAuth } from '../hooks/use-custom-auth';
import RecipeHistoryService from '../services/recipe-history-service';
import PantryService from '../services/pantry-service';
import SimpleSubstitutionService from '../services/simple-ingredient-substitution-service';
import IngredientUsageConfirmationModal from '../components/cooking/ingredient-usage-confirmation-modal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Convert quantity from one unit to another
 * @param {number} quantity - Quantity to convert
 * @param {string} fromUnit - Source unit
 * @param {string} toUnit - Target unit
 * @returns {number|null} Converted quantity or null if conversion not possible
 */
const convertUnit = (quantity, fromUnit, toUnit) => {
  if (!quantity || !fromUnit || !toUnit) return null;
  
  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();
  
  // If units are the same, no conversion needed
  if (from === to) return quantity;
  
  // Weight conversions
  const weightConversions = {
    // To grams
    'g': 1,
    'kg': 1000,
    'lb': 453.592,
    'lbs': 453.592,
    'oz': 28.3495,
    'ounce': 28.3495,
    'ounces': 28.3495,
    'pound': 453.592,
    'pounds': 453.592,
  };
  
  // Volume conversions
  const volumeConversions = {
    // To ml
    'ml': 1,
    'l': 1000,
    'liter': 1000,
    'liters': 1000,
    'cup': 236.588,
    'cups': 236.588,
    'tbsp': 14.7868,
    'tsp': 4.92892,
    'tablespoon': 14.7868,
    'tablespoons': 14.7868,
    'teaspoon': 4.92892,
    'teaspoons': 4.92892,
    'floz': 29.5735,
    'fl': 29.5735,
  };
  
  // Try weight conversion
  if (weightConversions[from] && weightConversions[to]) {
    const inGrams = quantity * weightConversions[from];
    return inGrams / weightConversions[to];
  }
  
  // Try volume conversion
  if (volumeConversions[from] && volumeConversions[to]) {
    const inMl = quantity * volumeConversions[from];
    return inMl / volumeConversions[to];
  }
  
  // Cannot convert (different measurement systems or unrecognized units)
  return null;
};

/**
 * Cooking Steps Screen
 * Displays step-by-step cooking instructions
 * Handles pantry subtraction and recipe history saving at the end
 */
const CookingSteps = () => {
  const router = useRouter();
  const { recipeData, hasSubstitutions } = useLocalSearchParams();
  const { user, customUserData } = useCustomAuth();

  const [recipe, setRecipe] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completionMessage, setCompletionMessage] = useState('');
  const [isCompletingRecipe, setIsCompletingRecipe] = useState(false);
  const [hasSavedHistory, setHasSavedHistory] = useState(false);
  
  // New ingredient confirmation states
  const [showIngredientConfirmation, setShowIngredientConfirmation] = useState(false);
  const [substitutedIngredients, setSubstitutedIngredients] = useState([]);
  const [isDeletingIngredients, setIsDeletingIngredients] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (recipeData) {
      try {
        const parsedRecipe = JSON.parse(recipeData);
        setRecipe(parsedRecipe);
      } catch (error) {
        console.error('Error parsing recipe data:', error);
        Alert.alert('Error', 'Failed to load recipe');
        router.back();
      }
    }
  }, [recipeData]);

  const instructions = recipe?.instructions || [];
  const totalSteps = instructions.length;

  // Animate progress bar whenever current step changes
  useEffect(() => {
    const progress = ((currentStep + 1) / totalSteps) * 100;
    Animated.spring(progressAnim, {
      toValue: progress,
      useNativeDriver: false,
      tension: 65,
      friction: 8,
      velocity: 2,
    }).start();
  }, [currentStep, totalSteps]);

  // Animate step transitions with callback support
  const animateStepTransition = (direction = 'next', callback) => {
    // Quick fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      // Execute callback (step change) immediately
      if (callback) callback();
      
      // Quick fade back in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNextStep = () => {
    if (currentStep < totalSteps - 1) {
      // Mark step as completed and move to next step instantly
      setCompletedSteps([...completedSteps, currentStep]);
      setCurrentStep(currentStep + 1);
    } else {
      // Last step completed
      handleCookingComplete();
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      // Move to previous step instantly
      setCurrentStep(currentStep - 1);
      setCompletedSteps(completedSteps.filter(s => s !== currentStep - 1));
    }
  };

  const handleCookingComplete = async () => {
    if (isCompletingRecipe || hasSavedHistory) {
      return;
    }
    setIsCompletingRecipe(true);

    // Mark last step as completed
    setCompletedSteps([...completedSteps, currentStep]);

    try {
      // 1. Save recipe to history first
      if (customUserData?.userID) {
        console.log('📝 Saving recipe to history...');
        const ingredientsUsed = recipe.ingredients || recipe.ingredientLines || [];
        
        const result = await RecipeHistoryService.saveRecipeToHistory(
          customUserData.userID,
          recipe,
          ingredientsUsed,
          hasSubstitutions === 'true'
        );

        if (result.success) {
          setHasSavedHistory(true);
          console.log('✅ Recipe saved to history');
        } else {
          console.warn('⚠️ Failed to save recipe to history');
        }
      }

      // 2. Always check for ingredients used (substituted or not)
      const substitutions = await SimpleSubstitutionService.getSubstitutionSummary(
        recipe,
        customUserData?.userID
      );
      
      console.log(`🔍 Found ${substitutions.length} substituted ingredients`);
      
      if (customUserData?.userID) {
        // Always show confirmation modal for better pantry tracking
        setSubstitutedIngredients(substitutions);
        setShowIngredientConfirmation(true);
        setCompletionMessage('Recipe saved! Please confirm ingredient usage.');
      } else {
        // No user ID, just complete
        setCompletionMessage('Recipe saved to your cooking history!');
        showCompletionModal();
      }

    } catch (error) {
      console.error('❌ Error completing recipe:', error);
      Alert.alert('Error', 'Failed to complete recipe. Please try again.');
      setCompletionMessage('Recipe completed with errors.');
      showCompletionModal();
    } finally {
      setIsCompletingRecipe(false);
    }
  };

  // Handler for ingredient deletion confirmation
  const handleIngredientConfirmation = async (selectedIds) => {
    setIsDeletingIngredients(true);

    try {
      if (selectedIds.length > 0) {
        console.log(`🗑️ Deleting ${selectedIds.length} confirmed ingredients from pantry...`);
        
        // Build items array with both ID and name for flexible deletion
        const itemsToDelete = selectedIds.map(id => {
          // Handle both numeric IDs and string-based name keys
          if (typeof id === 'number') {
            const substitution = substitutedIngredients.find(s => s.pantryItemId === id);
            return {
              pantryItemId: id,
              ingredientName: substitution?.ingredientName || substitution?.pantryItem?.itemName
            };
          } else if (typeof id === 'string' && id.startsWith('name_')) {
            // Name-based key (fallback when no ID available)
            const ingredientName = id.replace(/^name_/, '').replace(/_\d+$/, '');
            return {
              pantryItemId: null,
              ingredientName: ingredientName
            };
          }
          return { pantryItemId: id, ingredientName: null };
        });
        
        const result = await SimpleSubstitutionService.deleteUsedIngredients(
          customUserData.userID,
          itemsToDelete
        );

        if (result.success) {
          const deletedCount = result.deleted.length;
          const failedCount = result.failed.length;
          
          if (failedCount > 0) {
            setCompletionMessage(
              `Recipe complete! ${deletedCount} ingredient(s) removed. ${failedCount} failed to delete.`
            );
          } else {
            setCompletionMessage(
              `Recipe complete! ${deletedCount} ingredient(s) removed from pantry.`
            );
          }
          console.log(`✅ Successfully deleted ${deletedCount} ingredients`);
        } else {
          setCompletionMessage('Recipe saved, but failed to update pantry.');
          console.error('❌ Failed to delete ingredients');
        }
      } else {
        setCompletionMessage('Recipe saved! No ingredients were removed.');
        console.log('ℹ️ User skipped ingredient deletion');
      }
    } catch (error) {
      console.error('❌ Error deleting ingredients:', error);
      setCompletionMessage('Recipe saved, but pantry update failed.');
    } finally {
      setIsDeletingIngredients(false);
      setShowIngredientConfirmation(false);
      showCompletionModal();
    }
  };

  const showCompletionModal = () => {
    setShowCompleteModal(true);
    modalScale.setValue(0);
    
    // Animate modal entrance with smoother spring
    Animated.spring(modalScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
      velocity: 1,
    }).start();
  };

  const handleCloseModal = () => {
    Animated.timing(modalScale, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setShowCompleteModal(false);
      router.back();
    });
  };

  const handleVisitSite = () => {
    const url = recipe?.url || recipe?.sourceUrl;
    if (url) {
      Linking.openURL(url).catch(err => {
        console.error('Failed to open URL:', err);
        Alert.alert('Error', 'Could not open recipe site.');
      });
    }
  };

  const currentInstruction = instructions[currentStep];
  const instructionText = typeof currentInstruction === 'string' 
    ? currentInstruction 
    : currentInstruction?.instruction || '';

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isFinalStep = totalSteps > 0 && currentStep === totalSteps - 1;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header with gradient effect */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={wp('6%')} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{recipe.label || recipe.recipeName}</Text>
          {hasSubstitutions === 'true' && (
            <View style={styles.substitutionBadge}>
              <Ionicons name="swap-horizontal" size={wp('3.5%')} color="#81A969" />
              <Text style={styles.substitutionBadgeText}>Substituted</Text>
            </View>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Animated Progress Bar */}
      <View style={styles.progressBarContainer}>
        <Animated.View 
          style={[
            styles.progressBarFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            }
          ]} 
        />
      </View>

      {/* Step Counter Circle */}
      <View style={styles.stepCounterContainer}>
        <View style={styles.stepCircle}>
          <Text style={styles.stepNumber}>{currentStep + 1}</Text>
          <Text style={styles.stepTotal}>of {totalSteps}</Text>
        </View>
        <View style={styles.stepInfo}>
          <Text style={styles.stepLabel}>Current Step</Text>
          <Text style={styles.stepsRemaining}>
            {totalSteps - currentStep - 1} {totalSteps - currentStep - 1 === 1 ? 'step' : 'steps'} remaining
          </Text>
        </View>
      </View>

      {/* Instruction Card with Animation */}
      <Animated.View 
        style={[
          styles.instructionCard,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        <View style={styles.instructionHeader}>
          <Ionicons name="restaurant" size={wp('6%')} color="#81A969" />
          <Text style={styles.instructionHeaderText}>Instructions</Text>
        </View>
        <ScrollView 
          style={styles.instructionScrollView}
          contentContainerStyle={styles.instructionContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.instructionText}>
            {instructionText}
          </Text>
        </ScrollView>
      </Animated.View>

      {/* Step Progress Bar */}
      <View style={styles.stepProgressContainer}>
        <View style={styles.stepProgressBarWrapper}>
          <View style={styles.stepProgressBarBackground}>
            <View 
              style={[
                styles.stepProgressBarFill,
                { width: `${((currentStep + 1) / totalSteps) * 100}%` }
              ]} 
            />
          </View>
        </View>
        <Text style={styles.stepProgressText}>
          Step {currentStep + 1} of {totalSteps}
        </Text>
      </View>

      {/* Navigation Buttons */}
      <View style={styles.navigationContainer}>
        <TouchableOpacity
          style={[
            styles.navButton, 
            styles.previousButton,
            currentStep === 0 && styles.navButtonDisabled
          ]}
          onPress={handlePreviousStep}
          disabled={currentStep === 0}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="chevron-back" 
            size={wp('6%')} 
            color={currentStep === 0 ? '#ccc' : '#81A969'} 
          />
          <Text style={[
            styles.navButtonText,
            styles.previousButtonText,
            currentStep === 0 && styles.navButtonTextDisabled
          ]}>
            Previous
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navButton, 
            styles.nextButton,
            isFinalStep && isCompletingRecipe && styles.navButtonDisabled
          ]}
          onPress={handleNextStep}
          activeOpacity={0.8}
          disabled={isFinalStep && isCompletingRecipe}
        >
          <Text style={[styles.navButtonText, styles.nextButtonText]}>
            {isFinalStep ? (isCompletingRecipe ? 'Saving…' : 'Complete Cooking') : 'Next Step'}
          </Text>
          <Ionicons 
            name={isFinalStep ? "checkmark-circle" : "chevron-forward"} 
            size={wp('6%')} 
            color="#fff" 
          />
        </TouchableOpacity>
      </View>

      {/* Completion Modal */}
      <Modal
        visible={showCompleteModal}
        transparent={true}
        animationType="none"
        onRequestClose={handleCloseModal}
      >
        <TouchableWithoutFeedback onPress={handleCloseModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.completeModalContent,
                  {
                    transform: [{ scale: modalScale }],
                  },
                ]}
              >
                {/* Success Icon */}
                <View style={styles.successIconContainer}>
                  <View style={styles.successIconCircle}>
                    <Ionicons name="trophy" size={wp('15%')} color="#81A969" />
                  </View>
                </View>

                {/* Title */}
                <Text style={styles.completeTitle}>Cooking Complete!</Text>

                {/* Message */}
                <Text style={styles.completeMessage}>{completionMessage}</Text>

                {/* Fun & Author Text */}
                <Text style={styles.funText}>Had fun cooking this recipe?</Text>
                {recipe?.source && (
                  <Text style={styles.authorText}>Recipe Made by: {recipe.source}</Text>
                )}

                {/* Recipe Name */}
                <View style={styles.recipeNameContainer}>
                  <Ionicons name="restaurant" size={wp('4.5%')} color="#81A969" />
                  <Text style={styles.recipeName} numberOfLines={2}>
                    {recipe?.label || recipe?.recipeName}
                  </Text>
                </View>

                {/* Stats */}
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{recipe?.totalTime || '30'}</Text>
                    <Text style={styles.statLabel}>Minutes</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{totalSteps}</Text>
                    <Text style={styles.statLabel}>Steps</Text>
                  </View>
                </View>

                {/* Visit Site Button */}
                {(recipe?.url || recipe?.sourceUrl) && (
                  <TouchableOpacity style={styles.visitSiteButton} onPress={handleVisitSite}>
                    <Text style={styles.visitSiteButtonText}>Visit Recipe Site</Text>
                    <Ionicons name="open-outline" size={wp('5%')} color="#81A969" />
                  </TouchableOpacity>
                )}

                {/* Done Button */}
                <TouchableOpacity style={styles.doneButton} onPress={handleCloseModal}>
                  <Text style={styles.doneButtonText}>Done</Text>
                  <Ionicons name="checkmark-circle" size={wp('5.5%')} color="#fff" />
                </TouchableOpacity>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Ingredient Usage Confirmation Modal */}
      <IngredientUsageConfirmationModal
        visible={showIngredientConfirmation}
        onClose={() => {
          setShowIngredientConfirmation(false);
          setShowCompleteModal(true);
        }}
        substitutedIngredients={substitutedIngredients}
        onConfirm={handleIngredientConfirmation}
        loading={isDeletingIngredients}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('5%'),
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: wp('3%'),
  },
  headerTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  substitutionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7ED',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('3%'),
    marginTop: hp('0.5%'),
    gap: wp('1%'),
  },
  substitutionBadgeText: {
    fontSize: wp('3%'),
    color: '#81A969',
    fontWeight: '600',
  },
  headerSpacer: {
    width: wp('10%'),
  },
  progressBarContainer: {
    height: Math.max(hp('0.8%'), 6),
    backgroundColor: '#E8F0E3',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#81A969',
    borderRadius: hp('0.4%'),
  },
  stepCounterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    backgroundColor: '#fff',
    marginTop: hp('1%'),
    gap: wp('4%'),
  },
  stepCircle: {
    width: wp('18%'),
    height: wp('18%'),
    borderRadius: wp('9%'),
    backgroundColor: '#81A969',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#81A969',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  stepNumber: {
    fontSize: wp('8%'),
    fontWeight: 'bold',
    color: '#fff',
  },
  stepTotal: {
    fontSize: wp('3%'),
    color: '#fff',
    opacity: 0.9,
    marginTop: hp('-0.5%'),
  },
  stepInfo: {
    flex: 1,
  },
  stepLabel: {
    fontSize: wp('3.5%'),
    color: '#999',
    fontWeight: '500',
    marginBottom: hp('0.3%'),
  },
  stepsRemaining: {
    fontSize: wp('4.2%'),
    color: '#333',
    fontWeight: '600',
  },
  instructionCard: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: wp('5%'),
    marginTop: hp('1.5%'),
    marginBottom: hp('1%'),
    borderRadius: wp('4%'),
    padding: wp('5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
    paddingBottom: hp('1.5%'),
    borderBottomWidth: 2,
    borderBottomColor: '#F0F7ED',
    gap: wp('2%'),
  },
  instructionHeaderText: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#333',
  },
  instructionScrollView: {
    flex: 1,
  },
  instructionContent: {
    paddingBottom: hp('2%'),
  },
  instructionText: {
    fontSize: Math.min(wp('4.2%'), 18),
    lineHeight: Math.min(wp('7%'), 28),
    color: '#444',
    letterSpacing: 0.2,
  },
  stepProgressContainer: {
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.5%'),
    backgroundColor: '#fff',
    gap: hp('1%'),
  },
  stepProgressBarWrapper: {
    width: '100%',
  },
  stepProgressBarBackground: {
    height: hp('1.2%'),
    backgroundColor: '#E8F0E3',
    borderRadius: hp('0.6%'),
    overflow: 'hidden',
  },
  stepProgressBarFill: {
    height: '100%',
    backgroundColor: '#81A969',
    borderRadius: hp('0.6%'),
  },
  stepProgressText: {
    fontSize: wp('3.5%'),
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
  },
  checkmarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1000,
  },
  checkmarkCircle: {
    shadowColor: '#81A969',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  navigationContainer: {
    flexDirection: 'row',
    paddingHorizontal: wp('5%'),
    paddingTop: hp('1.5%'),
    paddingBottom: hp('1.5%'),
    gap: wp('3%'),
    backgroundColor: '#fff',
  },
  navButton: {
    flexDirection: 'row',
    paddingVertical: Math.max(hp('1.8%'), 14),
    paddingHorizontal: wp('5%'),
    borderRadius: wp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 48,
  },
  previousButton: {
    flex: 0.8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#81A969',
  },
  nextButton: {
    flex: 1.2,
    backgroundColor: '#81A969',
  },
  navButtonDisabled: {
    borderColor: '#E0E0E0',
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: wp('4%'),
    fontWeight: '700',
  },
  previousButtonText: {
    color: '#81A969',
  },
  nextButtonText: {
    color: '#fff',
  },
  navButtonTextDisabled: {
    color: '#ccc',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  completeModalContent: {
    backgroundColor: '#fff',
    borderRadius: wp('6%'),
    padding: wp('8%'),
    width: '100%',
    maxWidth: wp('90%'),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: hp('60%'),
    zIndex: 1,
    pointerEvents: 'none',
  },
  confetti: {
    position: 'absolute',
    width: wp('3%'),
    height: wp('3%'),
    borderRadius: wp('1.5%'),
  },
  successIconContainer: {
    marginBottom: hp('2%'),
    zIndex: 2,
  },
  successIconCircle: {
    width: wp('28%'),
    height: wp('28%'),
    borderRadius: wp('14%'),
    backgroundColor: '#FFF9E6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  completeTitle: {
    fontSize: wp('7%'),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: hp('1.5%'),
    textAlign: 'center',
  },
  completeMessage: {
    fontSize: wp('4%'),
    color: '#666',
    textAlign: 'center',
    lineHeight: wp('6%'),
    marginBottom: hp('2.5%'),
    paddingHorizontal: wp('2%'),
  },
  recipeNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7ED',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    borderRadius: wp('3%'),
    marginBottom: hp('2.5%'),
    gap: wp('2%'),
    maxWidth: '100%',
  },
  recipeName: {
    fontSize: wp('4.2%'),
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: wp('6%'),
    marginBottom: hp('3%'),
  },
  statItem: {
    alignItems: 'center',
    gap: hp('0.5%'),
  },
  statNumber: {
    fontSize: wp('6%'),
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: wp('3.2%'),
    color: '#999',
    fontWeight: '500',
  },
  doneButton: {
    flexDirection: 'row',
    backgroundColor: '#81A969',
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('12%'),
    borderRadius: wp('4%'),
    alignItems: 'center',
    gap: wp('2%'),
    shadowColor: '#81A969',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  doneButtonText: {
    fontSize: wp('4.5%'),
    fontWeight: 'bold',
    color: '#fff',
  },
  funText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#333',
    marginBottom: hp('0.5%'),
    textAlign: 'center',
  },
  authorText: {
    fontSize: wp('4.5%'),
    color: '#2E7D32', // Darker green for better visibility
    marginBottom: hp('2%'),
    textAlign: 'center',
    fontWeight: 'bold',
    backgroundColor: '#F0F7ED',
    paddingVertical: hp('1%'),
    paddingHorizontal: wp('4%'),
    borderRadius: wp('2%'),
    overflow: 'hidden',
  },
  visitSiteButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('6%'),
    borderRadius: wp('4%'),
    alignItems: 'center',
    gap: wp('2%'),
    borderWidth: 1.5,
    borderColor: '#81A969',
    marginBottom: hp('1.5%'),
    width: '100%',
    justifyContent: 'center',
  },
  visitSiteButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#81A969',
  },
});

export default CookingSteps;
