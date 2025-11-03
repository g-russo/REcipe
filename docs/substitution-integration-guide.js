/**
 * INTEGRATION GUIDE: Ingredient Substitution System
 * 
 * This file shows how to integrate the ingredient substitution components
 * into your recipe-detail.jsx screen.
 * 
 * Follow these steps to add substitution functionality:
 */

// ============================================
// STEP 1: Import required components and hooks
// ============================================

import { useIngredientSubstitution } from '../hooks/use-ingredient-substitution';
import IngredientSubstitutionModal from '../components/substitution/ingredient-substitution-modal';

// ============================================
// STEP 2: Add state in your component
// ============================================

const RecipeDetail = () => {
  // ... existing state ...
  
  // Add substitution modal state
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  
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
  } = useIngredientSubstitution(recipe, user?.userID);

  // ... existing code ...

  // ============================================
  // STEP 3: Handle "Start Cooking" button press
  // ============================================

  const handleStartCooking = () => {
    // Check for missing ingredients first
    showMissingIngredientsAlert(
      // Callback when user chooses "No, Proceed"
      () => {
        // Navigate to cooking steps
        router.push({
          pathname: '/cooking-steps',
          params: {
            recipeData: JSON.stringify(modifiedRecipe || recipe),
            hasSubstitutions: hasSubstitutions,
          }
        });
      },
      // Callback when user chooses "Yes" (substitute)
      () => {
        // Show substitution modal
        setShowSubstitutionModal(true);
      }
    );
  };

  // ============================================
  // STEP 4: Handle substitution confirmation
  // ============================================

  const handleSubstitutionConfirm = (substitutions) => {
    // Apply substitutions to create modified recipe
    const modified = applySubstitutions(substitutions);
    
    // Close modal
    setShowSubstitutionModal(false);
    
    // Navigate to cooking steps with modified recipe
    router.push({
      pathname: '/cooking-steps',
      params: {
        recipeData: JSON.stringify(modified),
        hasSubstitutions: true,
      }
    });
  };

  // ============================================
  // STEP 5: Handle cooking completion
  // (In your cooking-steps screen)
  // ============================================

  const handleCookingComplete = () => {
    // Show confirmation to subtract ingredients
    showIngredientUsageConfirmation(() => {
      // Navigate back or show success message
      router.back();
    });
  };

  // ============================================
  // STEP 6: Render the substitution modal
  // ============================================

  return (
    <SafeAreaView style={styles.container}>
      {/* ... existing UI ... */}

      {/* Floating Play/Start Cooking Button */}
      <FloatingPlayButton 
        onPress={handleStartCooking}
        recipeUri={recipe?.uri}
        userId={user?.email}
      />

      {/* Ingredient Substitution Modal */}
      <IngredientSubstitutionModal
        visible={showSubstitutionModal}
        onClose={() => setShowSubstitutionModal(false)}
        onConfirm={handleSubstitutionConfirm}
        missingIngredients={missingIngredients}
        userID={user?.userID}
      />

      {/* Optional: Show substitution badge on ingredients tab */}
      {hasSubstitutions && (
        <View style={styles.substitutionBadge}>
          <Text style={styles.substitutionBadgeText}>
            ✓ Using substitutions
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

// ============================================
// STEP 7: Update IngredientsTab to show substitutions
// ============================================

// In your ingredients-tab.jsx component:
const IngredientsTab = ({ ingredients, substitutionMap = {} }) => {
  return (
    <View>
      {ingredients.map((ingredient, index) => {
        const isSubstituted = ingredient.isSubstituted;
        const originalText = ingredient.originalText;

        return (
          <View key={index} style={styles.ingredientRow}>
            <Text style={[
              styles.ingredientText,
              isSubstituted && styles.substitutedText
            ]}>
              {ingredient.text || ingredient}
            </Text>
            {isSubstituted && (
              <Text style={styles.substitutionNote}>
                (Substitutes {originalText})
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

// ============================================
// STYLING EXAMPLE
// ============================================

const substitutionStyles = StyleSheet.create({
  substitutionBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginVertical: 12,
    alignSelf: 'flex-start',
  },
  substitutionBadgeText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
  },
  substitutedText: {
    color: '#6B9B6E',
    fontStyle: 'italic',
  },
  substitutionNote: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
});

/**
 * ============================================
 * SUMMARY OF FILES CREATED:
 * ============================================
 * 
 * Services:
 * - services/ingredient-substitution-service.js
 * - services/schedule-recipe-service.js (placeholder)
 * 
 * Components:
 * - components/substitution/ingredient-selector.jsx
 * - components/substitution/substitute-selector.jsx
 * - components/substitution/action-buttons.jsx
 * - components/substitution/ingredient-substitution-modal.jsx
 * 
 * Hooks:
 * - hooks/use-ingredient-substitution.js
 * 
 * Integration:
 * - This file (integration-guide.js)
 * 
 * ============================================
 * KEY FEATURES IMPLEMENTED:
 * ============================================
 * 
 * ✅ Change ingredients on command (via modal UI)
 * ✅ Alert user for missing ingredients
 * ✅ Smart ingredient substitution from pantry
 * ✅ Visual-only recipe modification (doesn't alter source)
 * ✅ Subtract used ingredients after cooking
 * ✅ Two-step substitution flow (select ingredient → select substitute)
 * ✅ Reusable components (no code repetition)
 * ✅ Integration with bottom navbar (tabs layout)
 * ✅ Placeholder for schedule recipe feature
 * 
 * ============================================
 */
