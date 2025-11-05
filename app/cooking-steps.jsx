import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCustomAuth } from '../hooks/use-custom-auth';
import RecipeHistoryService from '../services/recipe-history-service';
import PantryService from '../services/pantry-service';

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

  const handleNextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCompletedSteps([...completedSteps, currentStep]);
      setCurrentStep(currentStep + 1);
    } else {
      // Last step completed
      handleCookingComplete();
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setCompletedSteps(completedSteps.filter(s => s !== currentStep - 1));
    }
  };

  const handleCookingComplete = async () => {
    // Mark last step as completed
    setCompletedSteps([...completedSteps, currentStep]);

    // Subtract ingredients from pantry AFTER cooking completion
    if (customUserData?.userID) {
      try {
        console.log('🛒 Subtracting used ingredients from pantry...');
        let subtractedCount = 0;
        
        // Get all ingredients (including substituted ones)
        const ingredientKey = recipe.ingredientLines ? 'ingredientLines' : 'ingredients';
        const allIngredients = recipe[ingredientKey] || [];
        
        // Only subtract ingredients that are substituted (came from pantry)
        const ingredientsToSubtract = allIngredients.filter(ing => 
          ing.isSubstituted === true && ing.quantity && ing.unit
        );
        
        if (ingredientsToSubtract.length > 0) {
          console.log(`  Found ${ingredientsToSubtract.length} substituted ingredients to subtract`);
          
          // Get all pantry items once
          const allPantryItems = await PantryService.getUserItems(customUserData.userID);
          
          // Subtract each ingredient
          for (const ingredient of ingredientsToSubtract) {
            console.log(`  ➖ Subtracting ${ingredient.quantity} ${ingredient.unit} ${ingredient.text}`);
            
            // Find the pantry item by name (try multiple matching strategies)
            const pantryItem = allPantryItems.find(item => {
              const itemNameLower = item.itemName.toLowerCase();
              const ingredientTextLower = ingredient.text.toLowerCase();
              
              return (
                itemNameLower === ingredientTextLower ||
                itemNameLower.includes(ingredientTextLower) ||
                ingredientTextLower.includes(itemNameLower)
              );
            });
            
            if (pantryItem) {
              // Check if units match, if not, convert
              let quantityToSubtract = ingredient.quantity;
              
              if (pantryItem.unit.toLowerCase() !== ingredient.unit.toLowerCase()) {
                // Units don't match - need to convert
                const converted = convertUnit(ingredient.quantity, ingredient.unit, pantryItem.unit);
                
                if (converted !== null) {
                  quantityToSubtract = converted;
                  console.log(`    🔄 Converted ${ingredient.quantity} ${ingredient.unit} → ${converted.toFixed(3)} ${pantryItem.unit}`);
                } else {
                  console.warn(`    ⚠️ Cannot convert ${ingredient.unit} to ${pantryItem.unit} - skipping subtraction`);
                  continue; // Skip this ingredient
                }
              }
              
              // Calculate new quantity
              const newQuantity = pantryItem.quantity - quantityToSubtract;
              
              if (newQuantity > 0) {
                // Update item with reduced quantity
                await PantryService.updateItem(pantryItem.itemID, {
                  quantity: newQuantity,
                  userID: customUserData.userID,
                  itemName: pantryItem.itemName
                });
                console.log(`    ✅ Updated ${pantryItem.itemName}: ${pantryItem.quantity} ${pantryItem.unit} → ${newQuantity.toFixed(3)} ${pantryItem.unit}`);
                subtractedCount++;
              } else {
                // Remove item completely if quantity is 0 or negative
                await PantryService.deleteItem(pantryItem.itemID);
                console.log(`    ✅ Removed ${pantryItem.itemName} (quantity depleted)`);
                subtractedCount++;
              }
            } else {
              console.warn(`  ⚠️ Pantry item not found: ${ingredient.text}`);
            }
          }
          
          console.log(`✅ Subtracted ${subtractedCount} ingredients from pantry`);
        } else {
          console.log('  No substituted ingredients to subtract from pantry');
        }
      } catch (error) {
        console.error('❌ Error subtracting from pantry:', error);
      }
    }

    // Save recipe to history
    try {
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
          Alert.alert(
            'Cooking Complete! 🎉',
            'Recipe saved to your cooking history and ingredients removed from pantry!',
            [
              { 
                text: 'OK', 
                onPress: () => {
                  // Redirect to recipe website for traffic attribution
                  if (recipe?.url) {
                    Linking.openURL(recipe.url).catch(err => 
                      console.error('❌ Failed to open recipe URL:', err)
                    );
                  }
                  router.back();
                }
              }
            ]
          );
        } else {
          Alert.alert(
            'Cooking Complete! 🎉',
            'Recipe completed but history was not saved.',
            [{ 
              text: 'OK', 
              onPress: () => {
                // Redirect to recipe website for traffic attribution
                if (recipe?.url) {
                  Linking.openURL(recipe.url).catch(err => 
                    console.error('❌ Failed to open recipe URL:', err)
                  );
                }
                router.back();
              }
            }]
          );
        }
      } else {
        Alert.alert(
          'Cooking Complete! 🎉',
          'Great job!',
          [{ 
            text: 'OK', 
            onPress: () => {
              // Redirect to recipe website for traffic attribution
              if (recipe?.url) {
                Linking.openURL(recipe.url).catch(err => 
                  console.error('❌ Failed to open recipe URL:', err)
                );
              }
              router.back();
            }
          }]
        );
      }
    } catch (error) {
      console.error('❌ Error saving to history:', error);
      Alert.alert(
        'Cooking Complete! 🎉',
        'Recipe completed but history was not saved.',
        [{ 
          text: 'OK', 
          onPress: () => {
            // Redirect to recipe website for traffic attribution
            if (recipe?.url) {
              Linking.openURL(recipe.url).catch(err => 
                console.error('❌ Failed to open recipe URL:', err)
              );
            }
            router.back();
          }
        }]
      );
    }
  };

  const currentInstruction = instructions[currentStep];
  const instructionText = typeof currentInstruction === 'string' 
    ? currentInstruction 
    : currentInstruction?.instruction || '';

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{recipe.label}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Substitution Badge */}
      {hasSubstitutions === 'true' && (
        <View style={styles.substitutionBanner}>
          <Text style={styles.substitutionBannerText}>
            ✓ Using ingredient substitutions
          </Text>
        </View>
      )}

      {/* Step Counter */}
      <View style={styles.stepCounter}>
        <Text style={styles.stepCounterText}>
          Step {currentStep + 1} of {totalSteps}
        </Text>
      </View>

      {/* Instruction */}
      <ScrollView 
        style={styles.instructionContainer}
        contentContainerStyle={styles.instructionContent}
      >
        <Text style={styles.instructionText}>
          {instructionText}
        </Text>
      </ScrollView>

      {/* Progress Dots */}
      <View style={styles.progressDots}>
        {instructions.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentStep && styles.dotActive,
              completedSteps.includes(index) && styles.dotCompleted,
            ]}
          />
        ))}
      </View>

      {/* Navigation Buttons */}
      <View style={styles.navigationButtons}>
        <TouchableOpacity
          style={[styles.navButton, styles.previousButton]}
          onPress={handlePreviousStep}
          disabled={currentStep === 0}
        >
          <Text style={[
            styles.navButtonText,
            currentStep === 0 && styles.navButtonTextDisabled
          ]}>
            Previous
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, styles.nextButton]}
          onPress={handleNextStep}
        >
          <Text style={styles.navButtonText}>
            {currentStep === totalSteps - 1 ? 'Complete' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#666',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 36,
  },
  substitutionBanner: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
  },
  substitutionBannerText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepCounter: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  stepCounterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B9B6E',
    textAlign: 'center',
  },
  instructionContainer: {
    flex: 1,
  },
  instructionContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  instructionText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#1A1A1A',
    textAlign: 'left',
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#6B9B6E',
  },
  dotCompleted: {
    backgroundColor: '#A5D6A7',
  },
  navigationButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  navButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  previousButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6B9B6E',
  },
  nextButton: {
    backgroundColor: '#6B9B6E',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  navButtonTextDisabled: {
    color: '#B0B0B0',
  },
});

export default CookingSteps;
