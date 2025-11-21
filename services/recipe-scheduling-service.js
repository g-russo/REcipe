import { supabase } from '../lib/supabase';
import ImageGenerationService from './image-generation-service';
import RecipeHistoryService from './recipe-history-service';

// Note: expo-notifications and NotificationDatabaseService imports removed
// Notifications are now handled by the server-side daily cron job system

/**
 * Recipe Scheduling Service
 * Manages scheduled recipes and sends notifications 3 days before, 1 day before, and on cooking day
 */

class RecipeSchedulingService {
  /**
   * Check if a recipe is already scheduled
   * @param {number} userID - User's ID
   * @param {Object} recipe - Recipe data to check
   * @returns {Promise<Object>} { isDuplicate: boolean, existingSchedule: Object }
   */
  async checkForDuplicateSchedule(userID, recipe) {
    try {
      if (!userID || !recipe) {
        return { isDuplicate: false, existingSchedule: null };
      }

      const recipeName = recipe.label || recipe.recipeName || 'Untitled Recipe';
      const recipeURI = recipe.uri || recipe.recipeID || recipeName;

      const { data: existingSchedules, error: checkError } = await supabase
        .from('tbl_scheduled_recipes')
        .select('scheduleID, scheduledDate, recipeName, recipeData')
        .eq('userID', userID)
        .eq('isCompleted', false);

      if (checkError) {
        console.error('Error checking for duplicate schedules:', checkError);
        throw checkError;
      }

      if (existingSchedules && existingSchedules.length > 0) {
        const existingSchedule = existingSchedules.find(schedule => {
          const scheduleRecipeData = schedule.recipeData || {};
          const existingURI = scheduleRecipeData.uri || scheduleRecipeData.recipeID || schedule.recipeName;
          return existingURI === recipeURI;
        });

        if (existingSchedule) {
          return { isDuplicate: true, existingSchedule };
        }
      }

      return { isDuplicate: false, existingSchedule: null };
    } catch (error) {
      console.error('Error checking for duplicate schedule:', error);
      throw error;
    }
  }

  /**
   * Schedule a recipe for a future date
   * @param {number} userID - User's ID
   * @param {Object} recipe - Recipe data
   * @param {Date} scheduledDate - When to cook the recipe
   * @returns {Promise<Object>} Schedule result
   */
  async scheduleRecipe(userID, recipe, scheduledDate) {
    try {
      if (!userID) {
        throw new Error('User ID is required');
      }

      if (!recipe) {
        throw new Error('Recipe data is required');
      }

      if (!scheduledDate || !(scheduledDate instanceof Date)) {
        throw new Error('Valid scheduled date is required');
      }

      const recipeName = recipe.label || recipe.recipeName || 'Untitled Recipe';
      
      // 🖼️ Download and store Edamam image permanently to avoid expired AWS tokens
      let recipeToStore = { ...recipe };
      const isEdamamRecipe = recipe.uri && !recipe.recipeID && !recipe.isCustom;
      
      if (isEdamamRecipe && recipe.image) {
        console.log('📥 Downloading and storing Edamam image for scheduled recipe...');
        try {
          const permanentImageUrl = await ImageGenerationService.downloadAndStoreEdamamImage(
            recipe.image,
            recipe.uri
          );
          recipeToStore.image = permanentImageUrl;
          console.log('✅ Image stored permanently for scheduled recipe:', permanentImageUrl);
        } catch (imageError) {
          console.warn('⚠️ Failed to store image, using original URL:', imageError.message);
          // Continue with original URL - better than failing the entire save
        }
      }

      // Save scheduled recipe to database
      const { data, error } = await supabase
        .from('tbl_scheduled_recipes')
        .insert({
          userID: userID,
          recipeName: recipeName,
          recipeData: recipeToStore, // Use modified recipe with permanent image
          scheduledDate: scheduledDate.toISOString(),
          createdAt: new Date().toISOString(),
          isCompleted: false
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving scheduled recipe:', error);
        throw error;
      }

      console.log('✅ Recipe scheduled for:', scheduledDate.toLocaleDateString());
      console.log('📅 Notifications will be created daily at 9am via cron job');

      // Note: Notifications are now handled by the daily cron job at 9am
      // The cron job will check tbl_scheduled_recipes and create notifications as needed
      // No need to schedule local notifications anymore

      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Error in scheduleRecipe:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ============================================
  // NOTE: Notification Scheduling Removed
  // ============================================
  // Notifications are now handled by the daily cron job system at 9am
  // The cron job checks tbl_scheduled_recipes and creates notifications in tbl_notifications
  // This ensures all users get notifications at exactly 9am regardless of their device state
  // Old local notification scheduling code has been removed

  /**
   * Get user's scheduled recipes
   * @param {number} userID - User's ID
   * @param {boolean} includeCompleted - Include completed recipes (default: false)
   * @returns {Promise<Array>} List of scheduled recipes
   */
  async getScheduledRecipes(userID, includeCompleted = false) {
    try {
      if (!userID) {
        throw new Error('User ID is required');
      }

      let query = supabase
        .from('tbl_scheduled_recipes')
        .select('*')
        .eq('userID', userID)
        .order('scheduledDate', { ascending: true });

      if (!includeCompleted) {
        query = query.eq('isCompleted', false);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching scheduled recipes:', error);
        throw error;
      }

      console.log(`📅 Fetched ${data?.length || 0} scheduled recipes`);
      return data || [];
    } catch (error) {
      console.error('Error in getScheduledRecipes:', error);
      return [];
    }
  }

  /**
   * Get upcoming scheduled recipes (within next 7 days)
   * @param {number} userID - User's ID
   * @returns {Promise<Array>} Upcoming recipes
   */
  async getUpcomingRecipes(userID) {
    try {
      const allScheduled = await this.getScheduledRecipes(userID, false);
      const now = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const upcoming = allScheduled.filter(recipe => {
        const scheduledDate = new Date(recipe.scheduledDate);
        return scheduledDate >= now && scheduledDate <= sevenDaysFromNow;
      });

      return upcoming;
    } catch (error) {
      console.error('Error getting upcoming recipes:', error);
      return [];
    }
  }

  /**
   * Mark scheduled recipe as completed
   * @param {number} scheduleID - Schedule record ID
   * @returns {Promise<Object>} Update result
   */
  async markAsCompleted(scheduleID) {
    try {
      if (!scheduleID) {
        throw new Error('Schedule ID is required');
      }

      // First, fetch the scheduled recipe to get recipe data and userID
      const { data: scheduledRecipe, error: fetchError } = await supabase
        .from('tbl_scheduled_recipes')
        .select('*')
        .eq('scheduleID', scheduleID)
        .single();

      if (fetchError) {
        console.error('Error fetching scheduled recipe:', fetchError);
        throw fetchError;
      }

      if (!scheduledRecipe) {
        throw new Error('Scheduled recipe not found');
      }

      // Save to history before marking as completed
      const historyResult = await RecipeHistoryService.saveRecipeToHistory(
        scheduledRecipe.userID,
        scheduledRecipe.recipeData,
        [], // No ingredients used tracking for scheduled recipes
        false // No substitutions for scheduled recipes
      );

      if (!historyResult.success) {
        console.warn('⚠️ Failed to save to history, but continuing with completion:', historyResult.error);
        // Continue marking as completed even if history save fails
      }

      // Mark as completed
      const { error } = await supabase
        .from('tbl_scheduled_recipes')
        .update({
          isCompleted: true,
          completedAt: new Date().toISOString()
        })
        .eq('scheduleID', scheduleID);

      if (error) {
        console.error('Error marking recipe as completed:', error);
        throw error;
      }

      console.log('✅ Recipe marked as completed and added to history');
      return {
        success: true
      };
    } catch (error) {
      console.error('Error in markAsCompleted:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete scheduled recipe
   * @param {number} scheduleID - Schedule record ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteScheduledRecipe(scheduleID) {
    try {
      if (!scheduleID) {
        throw new Error('Schedule ID is required');
      }

      // Note: Notifications are handled by the daily cron job
      // When recipe is deleted, the cron job will stop creating new notifications automatically
      // No need to manually cancel notifications

      // Delete from database
      const { error } = await supabase
        .from('tbl_scheduled_recipes')
        .delete()
        .eq('scheduleID', scheduleID);

      if (error) {
        console.error('Error deleting scheduled recipe:', error);
        throw error;
      }

      console.log('✅ Scheduled recipe deleted');
      return {
        success: true
      };
    } catch (error) {
      console.error('Error in deleteScheduledRecipe:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }



  /**
   * Update scheduled recipe date
   * @param {number} scheduleID - Schedule record ID
   * @param {Date} newDate - New scheduled date
   * @returns {Promise<Object>} Update result
   */
  async updateScheduledDate(scheduleID, newDate) {
    try {
      if (!scheduleID) {
        throw new Error('Schedule ID is required');
      }

      if (!newDate || !(newDate instanceof Date)) {
        throw new Error('Valid new date is required');
      }

      // Note: Notifications are handled by the daily cron job
      // When the date is updated, the cron job will automatically adjust notifications
      // based on the new scheduledDate in tbl_scheduled_recipes

      // Update date
      const { error } = await supabase
        .from('tbl_scheduled_recipes')
        .update({
          scheduledDate: newDate.toISOString()
        })
        .eq('scheduleID', scheduleID);

      if (error) {
        console.error('Error updating scheduled date:', error);
        throw error;
      }

      console.log('✅ Scheduled date updated - cron job will handle notifications at 9am');
      return {
        success: true
      };
    } catch (error) {
      console.error('Error in updateScheduledDate:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new RecipeSchedulingService();
