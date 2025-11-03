/**
 * UPDATED INTEGRATION GUIDE
 * How to integrate the substitution system with your existing components
 * 
 * Updated components:
 * - IngredientsTab: Now has onSubstitutePress callback and shows substitutions
 * - FloatingPlayButton: Now shows warning for missing ingredients
 */

// ============================================
// STEP 1: Import in recipe-detail.jsx
// ============================================

import { useState, useEffect } from 'react';
import { useIngredientSubstitution } from '../hooks/use-ingredient-substitution';
import IngredientSubstitutionModal from '../components/substitution/ingredient-substitution-modal';

// ============================================
// STEP 2: Add state and hook in RecipeDetail component
// ============================================

const RecipeDetail = () => {
  const router = useRouter();
  const { recipeData } = useLocalSearchParams();
  const { user } = useCustomAuth();
  
  const [recipe, setRecipe] = useState(null);
  const [displayRecipe, setDisplayRecipe] = useState(null); // Recipe to display (may have substitutions)
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [substitutionMode, setSubstitutionMode] = useState('manual'); // 'manual' or 'auto'
  
  // Use the substitution hook
  const {
    missingIngredients,
    availableIngredients,
    modifiedRecipe,
    showMissingIngredientsAlert,
    applySubstitutions,
    showIngredientUsageConfirmation,
    hasMissingIngredients,
    hasSubstitutions,
  } = useIngredientSubstitution(displayRecipe || recipe, user?.userID);

  // Update display recipe when modifications are applied
  useEffect(() => {
    if (modifiedRecipe) {
      setDisplayRecipe(modifiedRecipe);
    } else if (recipe && !displayRecipe) {
      setDisplayRecipe(recipe);
    }
  }, [modifiedRecipe, recipe]);

  // ============================================
  // STEP 3: Handle manual substitution (from Ingredients Tab)
  // ============================================

  const handleManualSubstitute = () => {
    if (!recipe?.ingredients || recipe.ingredients.length === 0) {
      Alert.alert('No Ingredients', 'This recipe has no ingredients to substitute');
      return;
    }

    setSubstitutionMode('manual');
    setShowSubstitutionModal(true);
  };

  // ============================================
  // STEP 4: Handle Start Recipe (from Floating Button)
  // ============================================

  const handleStartRecipe = () => {
    if (!recipe?.ingredients) {
      // No ingredients, just go to cooking steps
      router.push({
        pathname: '/cooking-steps',
        params: {
          recipeData: JSON.stringify(displayRecipe || recipe),
          hasSubstitutions: hasSubstitutions,
        }
      });
      return;
    }

    // Check for missing ingredients
    if (hasMissingIngredients) {
      // Show alert with options
      showMissingIngredientsAlert(
        // Option 1: "No, Proceed" - Go to cooking without substitution
        () => {
          router.push({
            pathname: '/cooking-steps',
            params: {
              recipeData: JSON.stringify(displayRecipe || recipe),
              hasSubstitutions: hasSubstitutions,
            }
          });
        },
        // Option 2: "Yes" - Open substitution modal
        () => {
          setSubstitutionMode('auto');
          setShowSubstitutionModal(true);
        }
      );
    } else {
      // All ingredients available, proceed directly
      router.push({
        pathname: '/cooking-steps',
        params: {
          recipeData: JSON.stringify(displayRecipe || recipe),
          hasSubstitutions: hasSubstitutions,
        }
      });
    }
  };

  // ============================================
  // STEP 5: Handle Schedule Recipe
  // ============================================

  const handleScheduleRecipe = () => {
    Alert.alert(
      'Schedule Recipe',
      'This feature is coming soon! You\'ll be able to schedule recipes for specific dates and times.',
      [{ text: 'OK' }]
    );
  };

  // ============================================
  // STEP 6: Handle substitution confirmation
  // ============================================

  const handleSubstitutionConfirm = (substitutions) => {
    // Apply substitutions to create modified recipe
    const modified = applySubstitutions(substitutions);
    setDisplayRecipe(modified);
    
    // Close modal
    setShowSubstitutionModal(false);
    
    // If in auto mode (from Start Recipe), proceed to cooking
    if (substitutionMode === 'auto') {
      router.push({
        pathname: '/cooking-steps',
        params: {
          recipeData: JSON.stringify(modified),
          hasSubstitutions: true,
        }
      });
    }
  };

  // ============================================
  // STEP 7: Render the components
  // ============================================

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* ... Hero, Info, Nutrition ... */}

        {/* Ingredients Tab - Pass substitution props */}
        {activeTab === 'ingredients' && (
          <IngredientsTab 
            ingredients={displayRecipe?.ingredients || recipe?.ingredients || []}
            onSubstitutePress={handleManualSubstitute}
            hasSubstitutions={hasSubstitutions}
          />
        )}

        {/* Instructions Tab */}
        {activeTab === 'instructions' && (
          <InstructionsTab 
            instructions={displayRecipe?.instructions || recipe?.instructions || []}
            hasSubstitutions={hasSubstitutions}
          />
        )}
      </ScrollView>

      {/* Floating Play Button - Pass missing ingredients prop */}
      <FloatingPlayButton 
        onStartRecipe={handleStartRecipe}
        onScheduleRecipe={handleScheduleRecipe}
        hasMissingIngredients={hasMissingIngredients}
      />

      {/* Ingredient Substitution Modal */}
      <IngredientSubstitutionModal
        visible={showSubstitutionModal}
        onClose={() => setShowSubstitutionModal(false)}
        onConfirm={handleSubstitutionConfirm}
        missingIngredients={
          substitutionMode === 'auto' 
            ? missingIngredients // Only missing ingredients
            : (displayRecipe?.ingredients || recipe?.ingredients || []) // All ingredients for manual
        }
        userID={user?.userID}
      />
    </SafeAreaView>
  );
};

// ============================================
// FLOW SUMMARY
// ============================================

/**
 * MANUAL SUBSTITUTION (from Ingredients Tab):
 * 1. User clicks "Substitute" button in ingredients tab
 * 2. Modal opens showing ALL ingredients (not just missing)
 * 3. User selects ingredient to replace
 * 4. User selects substitute from pantry
 * 5. Recipe is updated locally (visual only)
 * 6. Ingredients tab shows "✓ Substituted" and highlights changes
 * 
 * AUTO SUBSTITUTION (from Start Recipe):
 * 1. User clicks "Start Recipe" in floating button
 * 2. System checks pantry for missing ingredients
 * 3. If missing ingredients found:
 *    - Alert shows: "Would you like to substitute?"
 *    - Option 1: "No, Proceed" → Go to cooking steps
 *    - Option 2: "Yes" → Open modal with ONLY missing ingredients
 * 4. User completes substitution
 * 5. Automatically navigates to cooking steps with substituted recipe
 * 
 * VISUAL INDICATORS:
 * - Ingredients Tab: Shows "✓ Substituted" when substitutions are active
 * - Substituted ingredients: Green text with "(Replaces [original])" note
 * - Floating Button: Shows "Missing ingredients" warning when applicable
 * - Cooking Steps: Shows "Using ingredient substitutions" banner
 */

// ============================================
// EXAMPLE USAGE
// ============================================

/**
 * Scenario 1: User wants to manually substitute tofu with chicken
 * 1. Navigate to Ingredients tab
 * 2. Click "Substitute" button
 * 3. Select "Tofu" from ingredient list
 * 4. Select "Chicken" from pantry substitutes
 * 5. Click "Confirm"
 * 6. Recipe now shows "Chicken (Replaces Tofu)" in green
 * 7. User can continue cooking with this modification
 * 
 * Scenario 2: User starts cooking but is missing salt
 * 1. Click floating "Start Recipe" button
 * 2. Alert: "You are missing: • Salt. Would you like to substitute?"
 * 3. Click "Yes"
 * 4. Modal shows only "Salt" as option
 * 5. Select "Salt"
 * 6. Choose "Soy Sauce" from pantry
 * 7. Automatically navigates to cooking steps
 * 8. Instructions updated to use "Soy Sauce" instead of "Salt"
 */

export default RecipeDetail;
