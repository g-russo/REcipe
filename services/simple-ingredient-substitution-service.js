import { supabase } from '../lib/supabase';

/**
 * Simplified Ingredient Substitution Service
 * 
 * ✅ KEY BEHAVIORS:
 * 1. Focus on ingredient NAME replacement only (chicken → tofu, salt → soy sauce)
 * 2. NO quantity/unit tracking during substitution
 * 3. Preserve recipe's original quantity and unit
 * 4. Ask user post-cooking which ingredients were fully used
 * 5. Delete only confirmed ingredients from pantry
 * 
 * Example: "250g chopped chicken" becomes "250g tofu" (quantity preserved, only ingredient name changed)
 */

class SimpleIngredientSubstitutionService {
  constructor() {
    this.OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    this.API_TIMEOUT = 30000; // 30 seconds
    this.MAX_RETRIES = 2;
  }

  /**
   * Get user's pantry items (only non-expired items with quantity > 0)
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
      const today = new Date().toISOString().split('T')[0];

      const { data: items, error } = await supabase
        .from('tbl_items')
        .select('*')
        .in('"inventoryID"', inventoryIDs)
        .gt('quantity', 0)
        .or(`itemExpiration.is.null,itemExpiration.gte.${today}`);

      if (error) throw error;
      
      console.log(`📦 Fetched ${items?.length || 0} valid pantry items`);
      return items || [];
    } catch (error) {
      console.error('Error fetching pantry items:', error);
      return [];
    }
  }

  /**
   * Extract ingredient name from text (removes quantity and descriptors)
   * @param {string} text - Ingredient text
   * @returns {string} Clean ingredient name
   */
  extractIngredientName(text) {
    return text
      .toLowerCase()
      .replace(/^\d+(\.\d+)?\s*(g|kg|lb|lbs|oz|ml|l|cup|cups|tbsp|tsp|pcs|pieces?)?/i, '') // Remove leading quantity
      .replace(/\b(fresh|dried|chopped|minced|sliced|diced|ground|whole|organic|frozen|raw|cooked|large|small|medium)\b/gi, '') // Remove descriptors
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get AI-powered ingredient substitutions
   * Uses SousChef AI to find best substitute from pantry
   * @param {string} originalIngredient - Original ingredient text (e.g., "250g chicken")
   * @param {Array} pantryItems - User's pantry items
   * @param {string} recipeName - Recipe name for context
   * @returns {Promise<Array>} Array of substitution suggestions
   */
  async getAISubstitutions(originalIngredient, pantryItems, recipeName = '') {
    if (!this.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured');
      return [];
    }

    if (pantryItems.length === 0) {
      console.log('⚠️ No pantry items available for substitution');
      return [];
    }

    const ingredientName = this.extractIngredientName(originalIngredient);
    
    // Parse quantity and unit from original
    const quantityMatch = originalIngredient.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?/i);
    const quantity = quantityMatch ? quantityMatch[1] : '';
    const unit = quantityMatch ? (quantityMatch[2] || '') : '';

    console.log(`🤖 Finding substitutes for: "${ingredientName}" (from "${originalIngredient}")`);
    console.log(`📊 Available pantry items: ${pantryItems.length}`);

    const pantryList = pantryItems
      .map((item, index) => `${index + 1}. ${item.itemName}`)
      .join('\n');

    const prompt = `You are SousChef AI, an expert culinary assistant helping substitute ingredients in "${recipeName || 'a recipe'}".

TASK: Find the best substitute for "${ingredientName}" from the user's pantry.

USER'S PANTRY:
${pantryList}

RULES:
1. ONLY suggest items from the pantry list above
2. Focus on ingredient NAME replacement only (ignore quantities)
3. Consider taste, texture, and cooking properties
4. Prioritize similar flavor profiles
5. Return TOP 3 best substitutes
6. If no good substitute exists, return empty array

IMPORTANT: The substituted ingredient will keep the original quantity and unit (${quantity}${unit}).
Example: If original is "250g chicken" and substitute is "tofu", result will be "250g tofu"

Return JSON array:
[
  {
    "pantryItemName": "exact name from pantry",
    "pantryItemId": <index from pantry list>,
    "reasoning": "why this is a good substitute",
    "confidence": "high|medium|low",
    "compatibilityNote": "any cooking adjustments needed"
  }
]

Return ONLY the JSON array, no additional text.`;

    try {
      console.log('🔄 Calling SousChef AI for substitution suggestions...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are SousChef AI, an expert culinary assistant. Always return valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 800
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        console.error('❌ No content in AI response');
        return [];
      }

      console.log('📝 AI Response:', content);

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('❌ No JSON array found in response');
        return [];
      }

      const suggestions = JSON.parse(jsonMatch[0]);
      
      // Map suggestions to include full pantry item data
      const enrichedSuggestions = suggestions.map(sug => {
        const pantryItem = pantryItems[sug.pantryItemId - 1]; // Index is 1-based
        return {
          ...sug,
          pantryItem: pantryItem,
          originalIngredient: originalIngredient,
          originalIngredientName: ingredientName,
          substitutedText: `${quantity}${unit} ${sug.pantryItemName}`.trim() // Preserve quantity, replace name
        };
      });

      console.log(`✅ Found ${enrichedSuggestions.length} AI suggestions`);
      return enrichedSuggestions;

    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('❌ AI request timed out after 30s');
      } else {
        console.error('❌ Error getting AI substitutions:', error);
      }
      return [];
    }
  }

  /**
   * Apply substitution to recipe ingredient
   * @param {string} originalText - Original ingredient text
   * @param {string} substituteName - Name of substitute ingredient
   * @returns {Object} { original, substituted, ingredientName }
   */
  applySubstitution(originalText, substituteName) {
    const ingredientName = this.extractIngredientName(originalText);
    
    // Parse quantity and unit
    const quantityMatch = originalText.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?/i);
    const quantityPart = quantityMatch ? `${quantityMatch[1]}${quantityMatch[2] || ''}` : '';
    
    // Replace ingredient name, keep quantity
    const substituted = quantityPart ? `${quantityPart} ${substituteName}` : substituteName;

    return {
      original: originalText,
      substituted: substituted.trim(),
      ingredientName: ingredientName,
      substituteName: substituteName,
      quantityPreserved: !!quantityPart
    };
  }

  /**
   * Delete ingredients from pantry (called after cooking with user confirmation)
   * @param {number} userID - User ID
   * @param {Array} confirmedItems - Array of objects with {pantryItemId, ingredientName}
   * @returns {Promise<Object>} Result with success status
   */
  async deleteUsedIngredients(userID, confirmedItems) {
    if (!confirmedItems || confirmedItems.length === 0) {
      return { success: true, message: 'No ingredients to delete', deleted: [], failed: [] };
    }

    try {
      console.log(`🗑️ Deleting ${confirmedItems.length} used ingredients...`);

      const deletedItems = [];
      const failedItems = [];

      for (const item of confirmedItems) {
        // Handle both old format (just ID) and new format (object with id/name)
        const itemId = typeof item === 'number' ? item : item.pantryItemId;
        const itemName = typeof item === 'object' ? item.ingredientName : null;

        if (itemId) {
          // Delete by ID (preferred) - RLS policies handle user filtering
          const { data, error } = await supabase
            .from('tbl_items')
            .delete()
            .eq('itemID', itemId)
            .select();

          if (error) {
            console.error(`❌ Failed to delete item ${itemId}:`, error);
            failedItems.push({ itemId, itemName, error: error.message });
          } else if (data && data.length > 0) {
            deletedItems.push(data[0]);
            console.log(`✅ Deleted: ${data[0].itemName}`);
          } else {
            console.warn(`⚠️ Item ${itemId} not found or already deleted`);
            failedItems.push({ itemId, itemName, error: 'Not found' });
          }
        } else if (itemName) {
          // Fallback: Delete by name matching (less precise) - RLS policies handle user filtering
          console.log(`⚠️ No ID provided, attempting to delete by name: ${itemName}`);
          
          const { data, error } = await supabase
            .from('tbl_items')
            .delete()
            .ilike('itemName', `%${itemName}%`)
            .limit(1)
            .select();

          if (error) {
            console.error(`❌ Failed to delete item "${itemName}":`, error);
            failedItems.push({ itemName, error: error.message });
          } else if (data && data.length > 0) {
            deletedItems.push(data[0]);
            console.log(`✅ Deleted: ${data[0].itemName}`);
          } else {
            console.warn(`⚠️ Item "${itemName}" not found`);
            failedItems.push({ itemName, error: 'Not found' });
          }
        } else {
          console.error(`❌ Invalid item - no ID or name:`, item);
          failedItems.push({ item, error: 'Invalid item format' });
        }
      }

      console.log(`✅ Successfully deleted ${deletedItems.length} ingredients`);
      if (failedItems.length > 0) {
        console.warn(`⚠️ Failed to delete ${failedItems.length} ingredients:`, failedItems);
      }

      return {
        success: true,
        message: `${deletedItems.length} ingredient(s) removed from pantry`,
        deleted: deletedItems,
        failed: failedItems
      };

    } catch (error) {
      console.error('❌ Error deleting used ingredients:', error);
      return {
        success: false,
        message: 'Failed to update pantry',
        error: error.message,
        deleted: [],
        failed: []
      };
    }
  }

  /**
   * Get summary of substitutions made in recipe
   * @param {Object} recipe - Recipe object with substitutions
   * @param {number} userID - User ID to fetch pantry items for matching
   * @returns {Promise<Array>} Array of substitution summaries
   */
  async getSubstitutionSummary(recipe, userID) {
    // Support both ingredientLines (Edamam) and ingredients (AI recipes)
    const ingredientKey = recipe?.ingredientLines ? 'ingredientLines' : 'ingredients';
    const ingredients = recipe?.[ingredientKey];
    
    if (!ingredients) return [];

    const substitutions = [];

    // Fetch user's pantry items to match by name
    let pantryItems = [];
    if (userID) {
      try {
        pantryItems = await this.getUserPantryItems(userID);
      } catch (error) {
        console.warn('⚠️ Failed to fetch pantry items for matching:', error);
      }
    }

    ingredients.forEach((ing, index) => {
      const ingredientText = ing.text || ing;
      const ingredientName = this.extractIngredientName(ingredientText);
      
      // Check if ingredient is marked as substituted (from old system)
      if (ing.isSubstituted && ing.originalText) {
        // Extract ingredient name from substituted text (remove quantity/unit)
        const substitutedName = this.extractIngredientName(ing.text);
        
        // Try to find matching pantry item by name
        const matchedPantryItem = pantryItems.find(item => {
          const itemNameLower = item.itemName.toLowerCase();
          const substitutedNameLower = substitutedName.toLowerCase();
          return itemNameLower === substitutedNameLower || 
                 itemNameLower.includes(substitutedNameLower) ||
                 substitutedNameLower.includes(itemNameLower);
        });

        substitutions.push({
          index,
          original: ing.originalText,
          substituted: ing.text,
          pantryItem: matchedPantryItem || {
            itemName: substitutedName,
            itemID: null
          },
          pantryItemId: matchedPantryItem?.itemID || null,
          ingredientName: substitutedName
        });
      }
      // Also check new format if using new substitution service
      else if (ing.substitutedWith) {
        substitutions.push({
          index,
          original: ing.text || ing,
          substituted: ing.substitutedWith.substituted,
          pantryItem: ing.substitutedWith.pantryItem,
          pantryItemId: ing.substitutedWith.pantryItem?.itemID,
          ingredientName: ing.substitutedWith.pantryItem?.itemName
        });
      }
      // NEW: Also detect ANY pantry items that match recipe ingredients (not just substitutions)
      else if (pantryItems.length > 0) {
        const matchedPantryItem = pantryItems.find(item => {
          const itemNameLower = item.itemName.toLowerCase();
          const ingredientNameLower = ingredientName.toLowerCase();
          return itemNameLower === ingredientNameLower || 
                 itemNameLower.includes(ingredientNameLower) ||
                 ingredientNameLower.includes(itemNameLower);
        });

        // If this ingredient matches something in the pantry, include it
        if (matchedPantryItem) {
          substitutions.push({
            index,
            original: ingredientText,
            substituted: ingredientText, // Same as original (not substituted)
            pantryItem: matchedPantryItem,
            pantryItemId: matchedPantryItem.itemID,
            ingredientName: matchedPantryItem.itemName,
            isFromPantry: true // Flag to indicate this is a pantry match, not a substitution
          });
        }
      }
    });

    console.log(`📋 Found ${substitutions.length} pantry items in recipe (substituted + matched)`);
    return substitutions;
  }
}

// Export singleton instance
const simpleSubstitutionService = new SimpleIngredientSubstitutionService();
export default simpleSubstitutionService;
