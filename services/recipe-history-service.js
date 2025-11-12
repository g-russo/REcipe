import { supabase } from '../lib/supabase';
import ImageGenerationService from './image-generation-service';

/**
 * Recipe History Service
 * Manages completed recipe history for users
 */

class RecipeHistoryService {
  /**
   * Save completed recipe to history
   * @param {number} userID - User's ID
   * @param {Object} recipe - Recipe data
   * @param {Array} ingredientsUsed - List of ingredients used from pantry
   * @param {boolean} hasSubstitutions - Whether recipe had substitutions
   * @returns {Promise<Object>} Save result
   */
  async saveRecipeToHistory(userID, recipe, ingredientsUsed = [], hasSubstitutions = false) {
    try {
      if (!userID) {
        throw new Error('User ID is required');
      }

      if (!recipe) {
        throw new Error('Recipe data is required');
      }

      const recipeName = recipe.label || recipe.recipeName || 'Untitled Recipe';
      
      // 🖼️ Download and store Edamam image permanently to avoid expired AWS tokens
      let recipeToStore = { ...recipe };
      const isEdamamRecipe = recipe.uri && !recipe.recipeID && !recipe.isCustom;
      
      if (isEdamamRecipe && recipe.image) {
        console.log('📥 Downloading and storing Edamam image for history...');
        try {
          const permanentImageUrl = await ImageGenerationService.downloadAndStoreEdamamImage(
            recipe.image,
            recipe.uri
          );
          recipeToStore.image = permanentImageUrl;
          console.log('✅ Image stored permanently for history:', permanentImageUrl);
        } catch (imageError) {
          console.warn('⚠️ Failed to store image, using original URL:', imageError.message);
          // Continue with original URL - better than failing the entire save
        }
      }

      const { data, error } = await supabase
        .from('tbl_recipe_history')
        .insert({
          userID: userID,
          recipeName: recipeName,
          recipeData: recipeToStore, // Use modified recipe with permanent image
          ingredientsUsed: ingredientsUsed,
          hasSubstitutions: hasSubstitutions,
          completedAt: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving recipe to history:', error);
        throw error;
      }

      console.log('✅ Recipe saved to history:', recipeName);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Error in saveRecipeToHistory:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user's recipe history
   * @param {number} userID - User's ID
   * @param {number} limit - Number of records to fetch (default: 50)
   * @returns {Promise<Array>} List of completed recipes
   */
  async getRecipeHistory(userID, limit = 50) {
    try {
      if (!userID) {
        throw new Error('User ID is required');
      }

      const { data, error } = await supabase
        .from('tbl_recipe_history')
        .select('*')
        .eq('userID', userID)
        .order('completedAt', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching recipe history:', error);
        throw error;
      }

      console.log(`📜 Fetched ${data?.length || 0} recipe history items`);
      return data || [];
    } catch (error) {
      console.error('Error in getRecipeHistory:', error);
      return [];
    }
  }

  /**
   * Get recipe history grouped by date
   * @param {number} userID - User's ID
   * @returns {Promise<Object>} History grouped by date
   */
  async getRecipeHistoryGroupedByDate(userID) {
    try {
      const history = await this.getRecipeHistory(userID);
      
      // Group by date
      const grouped = history.reduce((acc, item) => {
        const date = new Date(item.completedAt).toLocaleDateString();
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(item);
        return acc;
      }, {});

      return grouped;
    } catch (error) {
      console.error('Error grouping history by date:', error);
      return {};
    }
  }

  /**
   * Delete recipe from history
   * @param {number} historyID - History record ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteRecipeFromHistory(historyID) {
    try {
      if (!historyID) {
        throw new Error('History ID is required');
      }

      const { error } = await supabase
        .from('tbl_recipe_history')
        .delete()
        .eq('historyID', historyID);

      if (error) {
        console.error('Error deleting recipe from history:', error);
        throw error;
      }

      console.log('✅ Recipe removed from history');
      return {
        success: true
      };
    } catch (error) {
      console.error('Error in deleteRecipeFromHistory:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clear all history for a user
   * @param {number} userID - User's ID
   * @returns {Promise<Object>} Clear result
   */
  async clearAllHistory(userID) {
    try {
      if (!userID) {
        throw new Error('User ID is required');
      }

      const { error } = await supabase
        .from('tbl_recipe_history')
        .delete()
        .eq('userID', userID);

      if (error) {
        console.error('Error clearing history:', error);
        throw error;
      }

      console.log('✅ All history cleared');
      return {
        success: true
      };
    } catch (error) {
      console.error('Error in clearAllHistory:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get statistics for user's cooking history
   * @param {number} userID - User's ID
   * @returns {Promise<Object>} Statistics
   */
  async getHistoryStats(userID) {
    try {
      const history = await this.getRecipeHistory(userID, 1000); // Get all history
      
      const stats = {
        totalRecipesCooked: history.length,
        recipesWithSubstitutions: history.filter(h => h.hasSubstitutions).length,
        recipesThisWeek: history.filter(h => {
          const completedDate = new Date(h.completedAt);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return completedDate >= weekAgo;
        }).length,
        recipesThisMonth: history.filter(h => {
          const completedDate = new Date(h.completedAt);
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return completedDate >= monthAgo;
        }).length,
        mostRecentRecipe: history[0] || null
      };

      return stats;
    } catch (error) {
      console.error('Error getting history stats:', error);
      return {
        totalRecipesCooked: 0,
        recipesWithSubstitutions: 0,
        recipesThisWeek: 0,
        recipesThisMonth: 0,
        mostRecentRecipe: null
      };
    }
  }
}

export default new RecipeHistoryService();
