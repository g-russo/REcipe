import { supabase } from '../lib/supabase';
import { OPENAI_API_KEY } from '@env';

class RecipeMatcherService {
  /**
   * Check if user can make a recipe using AI-powered ingredient matching
   */
  async checkRecipeMatch(userEmail, recipe) {
    try {
      const pantryItems = await this.getUserPantryItems(userEmail);
      
      if (pantryItems.length === 0) {
        return {
          canMake: false,
          matchPercentage: 0,
          missingIngredients: recipe.ingredients || [],
          availableIngredients: [],
          matches: []
        };
      }

      const matchResult = await this.aiMatchIngredients(
        recipe.ingredients,
        pantryItems
      );

      return matchResult;
    } catch (error) {
      console.error('Error checking recipe match:', error);
      return {
        canMake: false,
        matchPercentage: 0,
        missingIngredients: recipe.ingredients || [],
        availableIngredients: [],
        matches: [],
        error: error.message
      };
    }
  }

  /**
   * Get user's pantry items
   */
  async getUserPantryItems(userEmail) {
    try {
      const { data: userData } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', userEmail)
        .single();

      if (!userData) return [];

      const { data: inventory } = await supabase
        .from('tbl_inventories')
        .select('inventoryID')
        .eq('userID', userData.userID)
        .single();

      if (!inventory) return [];

      const { data: items } = await supabase
        .from('tbl_items')
        .select('*')
        .eq('inventoryID', inventory.inventoryID);

      return items || [];
    } catch (error) {
      console.error('Error fetching pantry:', error);
      return [];
    }
  }

  /**
   * AI-powered ingredient matching (handles multiple languages)
   */
  async aiMatchIngredients(recipeIngredients, pantryItems) {
    try {
      const prompt = `Match recipe ingredients with pantry items. Consider different languages, variations, and reasonable substitutions.

Recipe needs:
${JSON.stringify(recipeIngredients, null, 2)}

User's pantry:
${JSON.stringify(pantryItems.map(item => ({
  name: item.itemName,
  quantity: item.quantity,
  unit: item.unit,
  category: item.itemCategory
})), null, 2)}

Rules:
1. Match across languages (e.g., "chicken" = "manok" = "pollo")
2. Match variations (e.g., "tomatoes" = "cherry tomatoes")
3. Check quantities (does user have enough?)
4. Suggest substitutions when appropriate

Return ONLY valid JSON:
{
  "matches": [
    {
      "recipeIngredient": "string",
      "pantryItem": "string or null",
      "isMatch": true/false,
      "confidence": 0-100,
      "hasEnough": true/false,
      "substitutionNote": "string or null"
    }
  ],
  "canMake": true/false,
  "matchPercentage": 0-100,
  "missingIngredients": ["array"],
  "availableIngredients": ["array"]
}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo', // Cheaper model for matching
          messages: [
            {
              role: 'system',
              content: 'You are a culinary expert matching ingredients across languages and cultures. Return only valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error('AI matching failed');
      }

      const aiResponse = await response.json();
      return JSON.parse(aiResponse.choices[0].message.content);
    } catch (error) {
      console.error('AI matching error:', error);
      return this.fallbackMatch(recipeIngredients, pantryItems);
    }
  }

  /**
   * Simple fallback matching (no AI)
   */
  fallbackMatch(recipeIngredients, pantryItems) {
    const matches = recipeIngredients.map(ingredient => {
      const ingredientName = ingredient.name.toLowerCase();
      const pantryMatch = pantryItems.find(item => 
        item.itemName.toLowerCase().includes(ingredientName) ||
        ingredientName.includes(item.itemName.toLowerCase())
      );

      return {
        recipeIngredient: ingredient.name,
        pantryItem: pantryMatch?.itemName || null,
        isMatch: !!pantryMatch,
        confidence: pantryMatch ? 70 : 0,
        hasEnough: true,
        substitutionNote: null
      };
    });

    const matchedCount = matches.filter(m => m.isMatch).length;
    const matchPercentage = recipeIngredients.length > 0 
      ? Math.round((matchedCount / recipeIngredients.length) * 100) 
      : 0;

    return {
      matches,
      canMake: matchPercentage === 100,
      matchPercentage,
      missingIngredients: matches.filter(m => !m.isMatch).map(m => m.recipeIngredient),
      availableIngredients: matches.filter(m => m.isMatch).map(m => m.recipeIngredient)
    };
  }

  /**
   * Save/bookmark a recipe (supports both Edamam and AI recipes)
   */
  async saveRecipe(userEmail, recipe, notes = null) {
    try {
      const { data: userData } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', userEmail)
        .single();

      if (!userData) return { success: false };

      // Determine recipe source
      const isAIRecipe = recipe.isCustom || recipe.source === 'SousChef AI';
      
      console.log('🔍 Recipe type check:', { 
        isAIRecipe, 
        hasRecipeID: !!recipe.recipeID,
        hasUri: !!recipe.uri,
        source: recipe.source,
        isCustom: recipe.isCustom
      });
      
      let recipeData;
      if (isAIRecipe) {
        // AI-generated recipe
        recipeData = {
          userID: userData.userID,
          aiRecipeID: recipe.recipeID,
          edamamRecipeURI: null,
          recipeSource: 'ai',
          recipeData: null,
          isFavorited: true,
          notes: notes,
          lastViewed: new Date().toISOString()
        };
      } else {
        // Edamam recipe
        recipeData = {
          userID: userData.userID,
          aiRecipeID: null,
          edamamRecipeURI: recipe.uri,
          recipeSource: 'edamam',
          recipeData: {
            label: recipe.label,
            image: recipe.image,
            source: recipe.source,
            url: recipe.url,
            yield: recipe.yield,
            ingredientLines: recipe.ingredientLines,
            calories: recipe.calories,
            totalTime: recipe.totalTime,
            cuisineType: recipe.cuisineType,
            mealType: recipe.mealType,
            dishType: recipe.dishType,
            healthLabels: recipe.healthLabels,
            dietLabels: recipe.dietLabels
          },
          isFavorited: true,
          notes: notes,
          lastViewed: new Date().toISOString()
        };
      }

      console.log('💾 Attempting to save recipe:', {
        isAIRecipe,
        userID: userData.userID,
        recipeURI: recipe.uri,
        recipeID: recipe.recipeID
      });

      console.log('📦 Data being inserted:', {
        userID: recipeData.userID,
        aiRecipeID: recipeData.aiRecipeID,
        edamamRecipeURI: recipeData.edamamRecipeURI,
        recipeSource: recipeData.recipeSource,
        hasRecipeData: !!recipeData.recipeData
      });

      // Check if recipe already exists
      let existingQuery = supabase
        .from('tbl_favorites')
        .select('favoriteID')
        .eq('userID', userData.userID);

      if (isAIRecipe) {
        existingQuery = existingQuery.eq('aiRecipeID', recipe.recipeID);
      } else {
        existingQuery = existingQuery.eq('edamamRecipeURI', recipe.uri);
      }

      const { data: existing } = await existingQuery.single();

      let result;
      if (existing) {
        // Update existing favorite
        console.log('📝 Updating existing favorite:', existing.favoriteID);
        result = await supabase
          .from('tbl_favorites')
          .update({
            isFavorited: true,
            lastViewed: new Date().toISOString(),
            notes: notes
          })
          .eq('favoriteID', existing.favoriteID);
      } else {
        // Insert new favorite
        console.log('➕ Inserting new favorite');
        result = await supabase
          .from('tbl_favorites')
          .insert(recipeData);
      }

      const { data, error } = result;

      if (error) {
        console.error('❌ Supabase error saving recipe:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return { success: false, error: error.message };
      }

      console.log('✅ Recipe saved successfully!', data);
      return { success: true };
    } catch (error) {
      console.error('💥 Exception saving recipe:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unsave/remove a recipe from favorites
   */
  async unsaveRecipe(userEmail, recipe) {
    try {
      console.log('🗑️ Unsaving recipe:', {
        userEmail,
        isCustom: recipe.isCustom,
        recipeID: recipe.recipeID,
        uri: recipe.uri
      });

      const { data: userData } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', userEmail)
        .single();

      if (!userData) {
        console.error('❌ User not found');
        return { success: false, error: 'User not found' };
      }

      const isAIRecipe = recipe.isCustom || recipe.source === 'SousChef AI';

      console.log('🔍 Delete query params:', {
        isAIRecipe,
        userID: userData.userID,
        aiRecipeID: recipe.recipeID,
        edamamRecipeURI: recipe.uri
      });

      let deleteQuery = supabase
        .from('tbl_favorites')
        .delete()
        .eq('userID', userData.userID);

      if (isAIRecipe) {
        deleteQuery = deleteQuery.eq('aiRecipeID', recipe.recipeID);
      } else {
        deleteQuery = deleteQuery.eq('edamamRecipeURI', recipe.uri);
      }

      const { error, data } = await deleteQuery;

      if (error) {
        console.error('❌ Delete error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Recipe unsaved successfully', data);
      return { success: true };
    } catch (error) {
      console.error('💥 Exception unsaving recipe:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get saved recipes (both Edamam and AI)
   */
  async getSavedRecipes(userEmail) {
    try {
      const { data: userData } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', userEmail)
        .single();

      if (!userData) return [];

      const { data } = await supabase
        .from('tbl_favorites')
        .select('*')
        .eq('userID', userData.userID)
        .eq('isFavorited', true)
        .order('lastViewed', { ascending: false });

      if (!data) return [];

      // Fetch AI recipe details for AI recipes
      const formattedRecipes = await Promise.all(
        data.map(async (userRecipe) => {
          if (userRecipe.recipeSource === 'ai') {
            // Fetch full AI recipe
            const { data: aiRecipe } = await supabase
              .from('tbl_recipes')
              .select('*')
              .eq('recipeID', userRecipe.aiRecipeID)
              .single();

            return {
              ...userRecipe,
              recipe: aiRecipe,
              isCustom: true
            };
          } else {
            // Edamam recipe - data already stored in recipeData field
            return {
              ...userRecipe,
              recipe: userRecipe.recipeData,
              isCustom: false
            };
          }
        })
      );

      return formattedRecipes;
    } catch (error) {
      console.error('Error fetching saved recipes:', error);
      return [];
    }
  }

  /**
   * Track recipe view (supports both Edamam and AI)
   */
  async trackRecipeView(userEmail, recipe) {
    try {
      const { data: userData } = await supabase
        .from('tbl_users')
        .select('userID')
        .eq('userEmail', userEmail)
        .single();

      if (!userData) return;

      const isAIRecipe = recipe.isCustom || recipe.source === 'SousChef AI';

      if (isAIRecipe) {
        // Track AI recipe view
        await supabase.rpc('increment_ai_recipe_view', {
          p_user_id: userData.userID,
          p_recipe_id: recipe.recipeID
        });
      } else {
        // Track Edamam recipe view
        await supabase.rpc('increment_edamam_recipe_view', {
          p_user_id: userData.userID,
          p_recipe_uri: recipe.uri
        });
      }
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  }
}

export default new RecipeMatcherService();
