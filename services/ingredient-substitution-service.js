import { supabase } from '../lib/supabase';

/**
 * Ingredient Substitution Service
 * Handles smart ingredient substitutions using pantry data and AI suggestions
 */

class IngredientSubstitutionService {
  /**
   * Get user's pantry items
   * @param {number} userID - User's ID
   * @returns {Promise<Array>} Array of pantry items
   */
  async getUserPantryItems(userID) {
    try {
      const { data: inventories, error: invError } = await supabase
        .from('tbl_inventories')
        .select('"inventoryID"')
        .eq('"userID"', userID);

      if (invError) throw invError;
      if (!inventories || inventories.length === 0) return [];

      const inventoryIDs = inventories.map(inv => inv.inventoryID);

      const { data: items, error } = await supabase
        .from('tbl_items')
        .select('*')
        .in('"inventoryID"', inventoryIDs)
        .gt('quantity', 0); // Only items with quantity > 0

      if (error) throw error;
      return items || [];
    } catch (error) {
      console.error('Error fetching pantry items:', error);
      return [];
    }
  }

  /**
   * Check which ingredients are missing from pantry
   * @param {Array} recipeIngredients - Recipe ingredients list
   * @param {Array} pantryItems - User's pantry items
   * @returns {Object} { available, missing }
   */
  checkIngredientAvailability(recipeIngredients, pantryItems) {
    const available = [];
    const missing = [];

    recipeIngredients.forEach(ingredient => {
      const ingredientName = this.normalizeIngredientName(ingredient.text || ingredient);
      const found = pantryItems.some(item => 
        this.fuzzyMatch(this.normalizeIngredientName(item.itemName), ingredientName)
      );

      if (found) {
        available.push(ingredient);
      } else {
        missing.push(ingredient);
      }
    });

    return { available, missing };
  }

  /**
   * Normalize ingredient name for comparison
   * @param {string} name - Ingredient name
   * @returns {string} Normalized name
   */
  normalizeIngredientName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z\s]/g, '') // Remove non-alphabetic characters
      .replace(/\b(fresh|dried|chopped|minced|sliced|diced|ground|whole|organic)\b/g, '') // Remove descriptors
      .trim();
  }

  /**
   * Fuzzy match two ingredient names
   * @param {string} a - First ingredient
   * @param {string} b - Second ingredient
   * @returns {boolean} True if match
   */
  fuzzyMatch(a, b) {
    // Direct match
    if (a.includes(b) || b.includes(a)) return true;

    // Check for plural/singular variants
    const singularA = a.replace(/s$/, '');
    const singularB = b.replace(/s$/, '');
    if (singularA === singularB) return true;

    return false;
  }

  /**
   * Get smart substitutions for missing ingredients using pantry
   * @param {Array} missingIngredients - Missing ingredients
   * @param {Array} pantryItems - User's pantry items
   * @returns {Promise<Object>} Substitution suggestions
   */
  async getSmartSubstitutions(missingIngredients, pantryItems) {
    const substitutions = {};

    for (const ingredient of missingIngredients) {
      const ingredientName = this.normalizeIngredientName(ingredient.text || ingredient);
      const suggestions = this.findSubstitutes(ingredientName, pantryItems);
      
      if (suggestions.length > 0) {
        substitutions[ingredient.text || ingredient] = suggestions;
      }
    }

    return substitutions;
  }

  /**
   * Find substitute ingredients from pantry
   * @param {string} ingredientName - Ingredient to substitute
   * @param {Array} pantryItems - User's pantry items
   * @returns {Array} Suggested substitutes
   */
  findSubstitutes(ingredientName, pantryItems) {
    const substitutionRules = this.getSubstitutionRules();
    const suggestions = [];

    // Check predefined substitution rules
    for (const [category, items] of Object.entries(substitutionRules)) {
      if (items.some(item => ingredientName.includes(item.toLowerCase()))) {
        // Find pantry items in the same category
        const categorySubstitutes = pantryItems.filter(pantryItem => 
          items.some(item => 
            this.normalizeIngredientName(pantryItem.itemName).includes(item.toLowerCase())
          )
        );

        suggestions.push(...categorySubstitutes.map(item => ({
          name: item.itemName,
          category: category,
          quantity: item.quantity,
          unit: item.unit,
          confidence: 'high'
        })));
      }
    }

    // If no substitutes found, suggest similar items from pantry
    if (suggestions.length === 0) {
      const similar = pantryItems
        .filter(item => {
          const itemName = this.normalizeIngredientName(item.itemName);
          return itemName.length > 3 && ingredientName.includes(itemName.substring(0, 3));
        })
        .map(item => ({
          name: item.itemName,
          category: 'similar',
          quantity: item.quantity,
          unit: item.unit,
          confidence: 'medium'
        }));

      suggestions.push(...similar);
    }

    return suggestions.slice(0, 10); // Limit to 10 suggestions
  }

  /**
   * Get substitution rules (category-based)
   * @returns {Object} Substitution rules
   */
  getSubstitutionRules() {
    return {
      'Protein': [
        'chicken', 'beef', 'pork', 'tofu', 'tempeh', 'turkey', 'lamb',
        'fish', 'salmon', 'tuna', 'shrimp', 'eggs', 'chickpeas', 'lentils',
        'black beans', 'mushrooms', 'seitan'
      ],
      'Dairy': [
        'milk', 'cream', 'butter', 'cheese', 'yogurt', 'sour cream',
        'coconut milk', 'almond milk', 'oat milk'
      ],
      'Seasoning': [
        'salt', 'soy sauce', 'fish sauce', 'worcestershire sauce',
        'vinegar', 'lemon juice', 'lime juice'
      ],
      'Oil': [
        'olive oil', 'vegetable oil', 'coconut oil', 'butter',
        'canola oil', 'avocado oil', 'sesame oil'
      ],
      'Sweetener': [
        'sugar', 'honey', 'maple syrup', 'agave', 'brown sugar',
        'coconut sugar', 'stevia'
      ],
      'Grain': [
        'rice', 'pasta', 'noodles', 'quinoa', 'couscous',
        'bread', 'tortilla', 'wraps'
      ],
      'Vegetable': [
        'onion', 'garlic', 'tomato', 'pepper', 'carrot', 'celery',
        'lettuce', 'spinach', 'kale', 'cabbage', 'broccoli'
      ]
    };
  }

  /**
   * Subtract used ingredients from pantry
   * @param {number} userID - User's ID
   * @param {Array} usedIngredients - Ingredients used (with quantities)
   * @returns {Promise<Object>} Update result
   */
  async subtractIngredientsFromPantry(userID, usedIngredients) {
    try {
      const pantryItems = await this.getUserPantryItems(userID);
      const updates = [];

      for (const ingredient of usedIngredients) {
        const ingredientName = this.normalizeIngredientName(ingredient.text || ingredient.name);
        
        // Find matching pantry item
        const pantryItem = pantryItems.find(item => 
          this.fuzzyMatch(this.normalizeIngredientName(item.itemName), ingredientName)
        );

        if (pantryItem) {
          const newQuantity = Math.max(0, pantryItem.quantity - (ingredient.quantity || 1));
          
          updates.push({
            itemID: pantryItem.itemID,
            newQuantity: newQuantity
          });
        }
      }

      // Execute updates
      for (const update of updates) {
        const { error } = await supabase
          .from('tbl_items')
          .update({ quantity: update.newQuantity })
          .eq('"itemID"', update.itemID);

        if (error) {
          console.error('Error updating pantry item:', error);
        }
      }

      return {
        success: true,
        updatedCount: updates.length
      };
    } catch (error) {
      console.error('Error subtracting ingredients:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a modified recipe with substitutions (local only)
   * @param {Object} recipe - Original recipe
   * @param {Object} substitutions - { originalIngredient: newIngredient }
   * @returns {Object} Modified recipe
   */
  createSubstitutedRecipe(recipe, substitutions) {
    // Clone the recipe to avoid mutating original
    const modifiedRecipe = { ...recipe };
    
    // Support both ingredientLines (Edamam) and ingredients (AI recipes)
    const ingredientKey = recipe.ingredientLines ? 'ingredientLines' : 'ingredients';
    const recipeIngredients = recipe[ingredientKey];
    
    if (!recipeIngredients) {
      console.warn('No ingredients found in recipe');
      return modifiedRecipe;
    }
    
    // Update ingredients
    modifiedRecipe[ingredientKey] = recipeIngredients.map(ingredient => {
      const ingredientText = typeof ingredient === 'string' ? ingredient : (ingredient.text || ingredient);
      
      if (substitutions[ingredientText]) {
        // For string ingredients, return an object
        if (typeof ingredient === 'string') {
          return {
            text: substitutions[ingredientText].name,
            originalText: ingredientText,
            isSubstituted: true,
            substitutionReason: substitutions[ingredientText].category
          };
        }
        // For object ingredients, merge properties
        return {
          ...ingredient,
          text: substitutions[ingredientText].name,
          originalText: ingredientText,
          isSubstituted: true,
          substitutionReason: substitutions[ingredientText].category
        };
      }
      
      // Return original ingredient (as string or object)
      return ingredient;
    });

    // Update instructions if needed (replace ingredient names)
    if (recipe.instructions) {
      modifiedRecipe.instructions = recipe.instructions.map(step => {
        let modifiedStep = typeof step === 'string' ? step : step.instruction;
        
        Object.entries(substitutions).forEach(([original, substitute]) => {
          const regex = new RegExp(original, 'gi');
          modifiedStep = modifiedStep.replace(regex, substitute.name);
        });
        
        return typeof step === 'string' ? modifiedStep : { ...step, instruction: modifiedStep };
      });
    }

    modifiedRecipe.hasSubstitutions = true;
    modifiedRecipe.substitutionMap = substitutions;

    return modifiedRecipe;
  }
}

export default new IngredientSubstitutionService();
