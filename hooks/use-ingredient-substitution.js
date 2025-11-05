import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import IngredientSubstitutionService from '../services/ingredient-substitution-service';
import RecipeHistoryService from '../services/recipe-history-service';

/**
 * Custom hook for ingredient substitution and pantry checking
 * Handles the entire substitution flow for cooking recipes
 */
export const useIngredientSubstitution = (recipe, userID) => {
  const [pantryItems, setPantryItems] = useState([]);
  const [missingIngredients, setMissingIngredients] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [insufficientIngredients, setInsufficientIngredients] = useState([]); // NEW
  const [substitutionMap, setSubstitutionMap] = useState({});
  const [modifiedRecipe, setModifiedRecipe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usingPantryIngredients, setUsingPantryIngredients] = useState(false); // Track if user wants to use pantry

  // Check ingredient availability when recipe or userID changes
  useEffect(() => {
    if (recipe && userID) {
      checkIngredientAvailability();
    }
  }, [recipe, userID]);

  /**
   * Check which ingredients are available in pantry
   */
  const checkIngredientAvailability = async () => {
    setLoading(true);
    try {
      const items = await IngredientSubstitutionService.getUserPantryItems(userID);
      setPantryItems(items);

      // Support both ingredientLines (Edamam) and ingredients (AI recipes)
      const recipeIngredients = recipe.ingredientLines || recipe.ingredients;
      
      if (recipeIngredients) {
        const result = IngredientSubstitutionService.checkIngredientAvailability(
          recipeIngredients,
          items
        );
        setAvailableIngredients(result.available);
        setMissingIngredients(result.missing);
        setInsufficientIngredients(result.insufficient || []); // NEW
      }
    } catch (error) {
      console.error('Error checking ingredient availability:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Show alert asking if user wants to use available pantry ingredients
   * @param {Function} onYes - Callback when user chooses to use pantry ingredients
   * @param {Function} onNo - Callback when user chooses not to use pantry ingredients
   */
  const showUsePantryIngredientsAlert = (onYes, onNo) => {
    if (availableIngredients.length === 0) {
      // No pantry ingredients available
      onNo();
      return;
    }

    const availableList = availableIngredients
      .map(ing => `• ${ing.text || ing}`)
      .join('\n');

    Alert.alert(
      'Available Ingredients',
      `The following ingredients are available in your pantry:\n\n${availableList}\n\nWould you like to use them for this recipe?`,
      [
        {
          text: 'No',
          onPress: () => {
            setUsingPantryIngredients(false);
            onNo();
          },
          style: 'cancel'
        },
        {
          text: 'Yes',
          onPress: () => {
            setUsingPantryIngredients(true);
            onYes();
          }
        }
      ]
    );
  };

  /**
   * Show alert for missing ingredients
   * @param {Function} onProceed - Callback when user chooses to proceed
   * @param {Function} onSubstitute - Callback when user chooses to substitute
   */
  const showMissingIngredientsAlert = (onProceed, onSubstitute) => {
    // Combine missing and insufficient ingredients
    const allMissing = [...missingIngredients];
    const allInsufficient = [...insufficientIngredients];
    
    if (allMissing.length === 0 && allInsufficient.length === 0) {
      // All ingredients available in sufficient quantities
      onProceed();
      return;
    }

    let message = '';
    
    // Add missing ingredients
    if (allMissing.length > 0) {
      const missingList = allMissing
        .map(ing => `• ${ing.text || ing}`)
        .join('\n');
      message += `You are missing the following ingredients:\n\n${missingList}`;
    }
    
    // Add insufficient ingredients
    if (allInsufficient.length > 0) {
      const insufficientList = allInsufficient
        .map(ing => `• ${ing.text || ing} (need ${ing.required} ${ing.requiredUnit}, have ${ing.available} ${ing.availableUnit})`)
        .join('\n');
      
      if (message) message += '\n\n';
      message += `Insufficient quantities:\n\n${insufficientList}`;
    }
    
    message += '\n\nWould you like to substitute them with ingredients from your pantry?';

    Alert.alert(
      'Missing Ingredients',
      message,
      [
        {
          text: 'No, Proceed',
          onPress: onProceed,
          style: 'cancel'
        },
        {
          text: 'Yes',
          onPress: onSubstitute
        }
      ]
    );
  };

  /**
   * Apply substitutions to create modified recipe
   * @param {Object} substitutions - Map of original to substitute ingredients
   */
  const applySubstitutions = (substitutions) => {
    const modified = IngredientSubstitutionService.createSubstitutedRecipe(
      recipe,
      substitutions
    );
    setSubstitutionMap(substitutions);
    setModifiedRecipe(modified);
    return modified;
  };

  /**
   * Show confirmation alert for using ingredients from pantry
   * @param {Function} onConfirm - Callback when user confirms usage
   */
  const showIngredientUsageConfirmation = (onConfirm) => {
    // Only show if user said they want to use pantry ingredients
    if (!usingPantryIngredients) {
      // User didn't want to use pantry ingredients, just save to history
      saveRecipeToHistory(onConfirm);
      return;
    }

    const recipeToUse = modifiedRecipe || recipe;
    const ingredientsToUse = recipeToUse.ingredients || recipeToUse.ingredientLines || [];
    
    const availableIngredientsList = ingredientsToUse
      .filter(ing => {
        const ingredientText = typeof ing === 'string' ? ing : (ing.text || ing);
        // Include if it's available in pantry or has been substituted
        return availableIngredients.some(a => {
          const availableText = typeof a === 'string' ? a : (a.text || a);
          return availableText === ingredientText;
        }) || (ing.isSubstituted && substitutionMap[ing.originalText]);
      })
      .map(ing => {
        const text = typeof ing === 'string' ? ing : (ing.text || ing);
        return `• ${text}`;
      })
      .join('\n');

    if (!ingredientsToUse || ingredientsToUse.length === 0) {
      // No ingredients to subtract, just save to history
      saveRecipeToHistory(onConfirm);
      return;
    }

    Alert.alert(
      'Cooking Complete! 🎉',
      `Did you use these ingredients from your pantry?\n\n${availableIngredientsList || 'No ingredients from pantry used'}`,
      [
        {
          text: 'No',
          onPress: () => saveRecipeToHistory(onConfirm),
          style: 'cancel'
        },
        {
          text: 'Yes, Subtract',
          onPress: () => subtractUsedIngredients(onConfirm)
        }
      ]
    );
  };

  /**
   * Save recipe to history
   * @param {Function} onComplete - Callback when save is complete
   */
  const saveRecipeToHistory = async (onComplete) => {
    try {
      const recipeToUse = modifiedRecipe || recipe;
      const ingredientsToUse = recipeToUse.ingredients || recipeToUse.ingredientLines || [];
      
      const result = await RecipeHistoryService.saveRecipeToHistory(
        userID,
        recipeToUse,
        ingredientsToUse,
        Object.keys(substitutionMap).length > 0
      );

      if (result.success) {
        Alert.alert(
          'Success',
          'Recipe saved to your cooking history!',
          [{ text: 'OK', onPress: onComplete }]
        );
      } else {
        Alert.alert('Note', 'Recipe completed but history was not saved.');
        if (onComplete) onComplete();
      }
    } catch (error) {
      console.error('Error saving to history:', error);
      Alert.alert('Note', 'Recipe completed but history was not saved.');
      if (onComplete) onComplete();
    }
  };

  /**
   * Subtract used ingredients from pantry
   * @param {Function} onComplete - Callback when subtraction is complete
   */
  const subtractUsedIngredients = async (onComplete) => {
    try {
      const recipeToUse = modifiedRecipe || recipe;
      const ingredientsList = recipeToUse.ingredients || recipeToUse.ingredientLines || [];
      
      // Build list of ingredients to subtract with proper quantities
      const ingredientsToSubtract = ingredientsList
        .filter(ing => {
          // Only include ingredients that are from pantry
          const ingredientText = typeof ing === 'string' ? ing : (ing.text || ing);
          
          // Check if ingredient is available in pantry OR is a substitution
          const isAvailable = availableIngredients.some(a => {
            const availableText = typeof a === 'string' ? a : (a.text || a);
            return availableText === ingredientText;
          });
          
          const isSubstituted = ing.isSubstituted && substitutionMap[ing.originalText];
          
          return isAvailable || isSubstituted;
        })
        .map(ing => {
          const ingredientData = typeof ing === 'string' ? { text: ing } : ing;
          
          // If it's a substituted ingredient, use the substitute's data
          if (ingredientData.isSubstituted && substitutionMap[ingredientData.originalText]) {
            const substitute = substitutionMap[ingredientData.originalText];
            console.log('📝 Substituted ingredient:', {
              original: ingredientData.originalText,
              substitute: substitute.name,
              quantity: substitute.quantity,
              unit: substitute.unit
            });
            return {
              text: ingredientData.text,
              name: substitute.name || ingredientData.text,
              quantity: substitute.quantity || 1,
              unit: substitute.unit || '',
              // Pass original pantry info for matching
              originalQuantityInPantry: substitute.originalQuantityInPantry,
              originalUnitInPantry: substitute.originalUnitInPantry
            };
          }
          
          // Regular ingredient from pantry - parse quantity from text
          const ingredientText = ingredientData.text || ing;
          const parsedQuantity = IngredientSubstitutionService.parseQuantityFromText(ingredientText, pantryItems);
          
          console.log('📝 Regular pantry ingredient:', {
            text: ingredientText,
            parsedQuantity: parsedQuantity
          });
          
          return {
            text: ingredientText,
            name: ingredientText,
            quantity: parsedQuantity?.value || 1,
            unit: parsedQuantity?.unit || ''
          };
        });

      if (ingredientsToSubtract.length === 0) {
        // No pantry ingredients to subtract, just save to history
        console.log('ℹ️ No pantry ingredients to subtract');
        await saveRecipeToHistory(onComplete);
        return;
      }

      console.log(`🔄 Subtracting ${ingredientsToSubtract.length} ingredients from pantry...`);
      
      const result = await IngredientSubstitutionService.subtractIngredientsFromPantry(
        userID,
        ingredientsToSubtract
      );

      if (result.success) {
        console.log(`✅ Successfully subtracted ${result.updatedCount} ingredients from pantry`);
        // Save to history after subtracting ingredients
        await saveRecipeToHistory(onComplete);
        
        // Refresh pantry items
        checkIngredientAvailability();
      } else {
        Alert.alert('Error', 'Failed to update pantry. Please try again.');
      }
    } catch (error) {
      console.error('Error subtracting ingredients:', error);
      Alert.alert('Error', 'Failed to update pantry. Please try again.');
    }
  };

  /**
   * Reset substitutions
   */
  const resetSubstitutions = () => {
    setSubstitutionMap({});
    setModifiedRecipe(null);
  };

  return {
    // State
    pantryItems,
    missingIngredients,
    availableIngredients,
    insufficientIngredients, // NEW
    substitutionMap,
    modifiedRecipe,
    loading,
    usingPantryIngredients,

    // Methods
    checkIngredientAvailability,
    showUsePantryIngredientsAlert,
    showMissingIngredientsAlert,
    applySubstitutions,
    showIngredientUsageConfirmation,
    resetSubstitutions,

    // Computed
    hasMissingIngredients: missingIngredients.length > 0 || insufficientIngredients.length > 0, // Updated
    hasAvailableIngredients: availableIngredients.length > 0,
    hasSubstitutions: Object.keys(substitutionMap).length > 0,
  };
};
