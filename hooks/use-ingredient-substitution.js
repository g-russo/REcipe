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
  const [substitutionMap, setSubstitutionMap] = useState({});
  const [modifiedRecipe, setModifiedRecipe] = useState(null);
  const [loading, setLoading] = useState(false);

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
      }
    } catch (error) {
      console.error('Error checking ingredient availability:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Show alert for missing ingredients
   * @param {Function} onProceed - Callback when user chooses to proceed
   * @param {Function} onSubstitute - Callback when user chooses to substitute
   */
  const showMissingIngredientsAlert = (onProceed, onSubstitute) => {
    if (missingIngredients.length === 0) {
      // All ingredients available
      onProceed();
      return;
    }

    const missingList = missingIngredients
      .map(ing => `• ${ing.text || ing}`)
      .join('\n');

    Alert.alert(
      'Missing Ingredients',
      `You are missing the following ingredients:\n\n${missingList}\n\nWould you like to substitute them with ingredients from your pantry?`,
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
      
      const ingredientsToSubtract = ingredientsList.map(ing => ({
        text: typeof ing === 'string' ? ing : (ing.text || ing),
        name: typeof ing === 'string' ? ing : (ing.text || ing),
        quantity: 1 // Default quantity if not specified
      }));

      const result = await IngredientSubstitutionService.subtractIngredientsFromPantry(
        userID,
        ingredientsToSubtract
      );

      if (result.success) {
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
    substitutionMap,
    modifiedRecipe,
    loading,

    // Methods
    checkIngredientAvailability,
    showMissingIngredientsAlert,
    applySubstitutions,
    showIngredientUsageConfirmation,
    resetSubstitutions,

    // Computed
    hasMissingIngredients: missingIngredients.length > 0,
    hasSubstitutions: Object.keys(substitutionMap).length > 0,
  };
};
