import { supabase } from '../lib/supabase';
import * as Notifications from 'expo-notifications';
import NotificationDatabaseService from './notification-database-service';
import ImageGenerationService from './image-generation-service';

/**
 * Recipe Scheduling Service
 * Manages scheduled recipes and sends notifications 3 days before, 1 day before, and on cooking day
 */

class RecipeSchedulingService {
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

      // Schedule notifications
      await this.scheduleNotifications(userID, recipeName, scheduledDate, data.scheduleID);

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

  /**
   * Schedule notifications for a recipe (3 days before, 1 day before, and on the day)
   * @param {number} userID - User's ID
   * @param {string} recipeName - Name of the recipe
   * @param {Date} scheduledDate - Cooking date
   * @param {number} scheduleID - Schedule record ID
   */
  async scheduleNotifications(userID, recipeName, scheduledDate, scheduleID) {
    try {
      const now = new Date();
      const cookingDate = new Date(scheduledDate);
      
      // Set time to 9:00 AM for all notifications
      cookingDate.setHours(9, 0, 0, 0);

      // Calculate notification dates for 1 week, 3 days, 2 days, 1 day before, and cooking day
      const oneWeekBefore = new Date(cookingDate);
      oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);

      const threeDaysBefore = new Date(cookingDate);
      threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);

      const twoDaysBefore = new Date(cookingDate);
      twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);

      const oneDayBefore = new Date(cookingDate);
      oneDayBefore.setDate(oneDayBefore.getDate() - 1);

      const onCookingDay = new Date(cookingDate);

      // Schedule 1 week before notification
      if (oneWeekBefore > now) {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '🟡 Recipe Next Week',
            body: `"${recipeName}" is scheduled in 1 week. Start thinking about ingredients!`,
            data: {
              type: 'scheduled_recipe',
              scheduleID: scheduleID,
              recipeName: recipeName,
              daysUntil: 7
            }
          },
          trigger: {
            date: oneWeekBefore
          }
        });

        // Save to database
        await NotificationDatabaseService.saveNotification({
          userID: userID,
          title: '🟡 Recipe Next Week',
          message: `"${recipeName}" is scheduled in 1 week. Start thinking about ingredients!`,
          type: 'scheduled_recipe',
          relatedID: scheduleID,
          scheduledFor: oneWeekBefore.toISOString(),
          notificationIdentifier: notificationId
        });

        console.log('📅 Scheduled 1-week notification for:', recipeName);
      }

      // Schedule 3 days before notification
      if (threeDaysBefore > now) {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '🍳 Upcoming Recipe',
            body: `"${recipeName}" is scheduled in 3 days! Check your pantry.`,
            data: {
              type: 'scheduled_recipe',
              scheduleID: scheduleID,
              recipeName: recipeName,
              daysUntil: 3
            }
          },
          trigger: {
            date: threeDaysBefore
          }
        });

        // Save to database
        await NotificationDatabaseService.saveNotification({
          userID: userID,
          title: '🍳 Upcoming Recipe',
          message: `"${recipeName}" is scheduled in 3 days! Check your pantry.`,
          type: 'scheduled_recipe',
          relatedID: scheduleID,
          scheduledFor: threeDaysBefore.toISOString(),
          notificationIdentifier: notificationId
        });

        console.log('📅 Scheduled 3-day notification for:', recipeName);
      }

      // Schedule 2 days before notification
      if (twoDaysBefore > now) {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '🍳 Recipe in 2 Days',
            body: `"${recipeName}" is scheduled in 2 days! Start planning.`,
            data: {
              type: 'scheduled_recipe',
              scheduleID: scheduleID,
              recipeName: recipeName,
              daysUntil: 2
            }
          },
          trigger: {
            date: twoDaysBefore
          }
        });

        await NotificationDatabaseService.saveNotification({
          userID: userID,
          title: '🍳 Recipe in 2 Days',
          message: `"${recipeName}" is scheduled in 2 days! Start planning.`,
          type: 'scheduled_recipe',
          relatedID: scheduleID,
          scheduledFor: twoDaysBefore.toISOString(),
          notificationIdentifier: notificationId
        });

        console.log('📅 Scheduled 2-day notification for:', recipeName);
      }

      // Schedule 1 day before notification
      if (oneDayBefore > now) {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '👨‍🍳 Recipe Tomorrow',
            body: `"${recipeName}" is scheduled for tomorrow! Time to prep.`,
            data: {
              type: 'scheduled_recipe',
              scheduleID: scheduleID,
              recipeName: recipeName,
              daysUntil: 1
            }
          },
          trigger: {
            date: oneDayBefore
          }
        });

        await NotificationDatabaseService.saveNotification({
          userID: userID,
          title: '👨‍🍳 Recipe Tomorrow',
          message: `"${recipeName}" is scheduled for tomorrow! Time to prep.`,
          type: 'scheduled_recipe',
          relatedID: scheduleID,
          scheduledFor: oneDayBefore.toISOString(),
          notificationIdentifier: notificationId
        });

        console.log('📅 Scheduled 1-day notification for:', recipeName);
      }

      // Schedule cooking day notification
      if (onCookingDay > now) {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '🔔 Time to Cook!',
            body: `Today is the day to cook "${recipeName}"! Let's get started.`,
            data: {
              type: 'scheduled_recipe',
              scheduleID: scheduleID,
              recipeName: recipeName,
              daysUntil: 0
            }
          },
          trigger: {
            date: onCookingDay
          }
        });

        await NotificationDatabaseService.saveNotification({
          userID: userID,
          title: '🔔 Time to Cook!',
          message: `Today is the day to cook "${recipeName}"! Let's get started.`,
          type: 'scheduled_recipe',
          relatedID: scheduleID,
          scheduledFor: onCookingDay.toISOString(),
          notificationIdentifier: notificationId
        });

        console.log('📅 Scheduled cooking-day notification for:', recipeName);
      }

      console.log('✅ All notifications scheduled for:', recipeName);
    } catch (error) {
      console.error('Error scheduling notifications:', error);
    }
  }

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

      console.log('✅ Recipe marked as completed');
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

      // Cancel associated notifications
      await this.cancelNotificationsForSchedule(scheduleID);

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
   * Cancel all notifications for a scheduled recipe
   * @param {number} scheduleID - Schedule record ID
   */
  async cancelNotificationsForSchedule(scheduleID) {
    try {
      // Get all notifications for this schedule
      const { data: notifications } = await supabase
        .from('tbl_notifications')
        .select('*')
        .eq('relatedID', scheduleID)
        .eq('type', 'scheduled_recipe');

      if (notifications && notifications.length > 0) {
        // Cancel each notification
        for (const notification of notifications) {
          if (notification.notificationIdentifier) {
            await Notifications.cancelScheduledNotificationAsync(notification.notificationIdentifier);
          }
        }

        // Delete from database
        await supabase
          .from('tbl_notifications')
          .delete()
          .eq('relatedID', scheduleID)
          .eq('type', 'scheduled_recipe');

        console.log(`🔕 Cancelled ${notifications.length} notifications for schedule ${scheduleID}`);
      }
    } catch (error) {
      console.error('Error cancelling notifications:', error);
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

      // Get the scheduled recipe
      const { data: recipe } = await supabase
        .from('tbl_scheduled_recipes')
        .select('*')
        .eq('scheduleID', scheduleID)
        .single();

      if (!recipe) {
        throw new Error('Scheduled recipe not found');
      }

      // Cancel existing notifications
      await this.cancelNotificationsForSchedule(scheduleID);

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

      // Reschedule notifications with new date
      await this.scheduleNotifications(recipe.userID, recipe.recipeName, newDate, scheduleID);

      console.log('✅ Scheduled date updated and notifications rescheduled');
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
