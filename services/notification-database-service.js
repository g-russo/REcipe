import { supabase } from '../lib/supabase';

/**
 * Notification Database Service
 * Manages notification history in Supabase database
 */

class NotificationDatabaseService {
  /**
   * Create a new notification in database
   * @param {string} userID - User ID
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {string} type - Notification type ('pantry_expiration', 'recipe_reminder', etc.)
   * @param {object} data - Additional metadata (itemID, recipeID, etc.)
   * @returns {Promise<object>} Created notification
   */
  async createNotification(userID, title, body, type, data = {}) {
    try {
      const { data: notification, error } = await supabase
        .from('tbl_notifications')
        .insert({
          userID,
          title,
          body,
          type,
          data,
          isRead: false,
          isDeleted: false,
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Notification saved to database:', notification.notificationID);
      return notification;
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get all notifications for user (not deleted)
   * @param {string} userID - User ID
   * @param {number} limit - Max number of notifications (default: 50)
   * @returns {Promise<array>} List of notifications
   */
  async getUserNotifications(userID, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('tbl_notifications')
        .select('*')
        .eq('userID', userID)
        .eq('isDeleted', false)
        .order('createdAt', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
      return [];
    }
  }

  /**
   * Get unread notification count
   * @param {string} userID - User ID
   * @returns {Promise<number>} Count of unread notifications
   */
  async getUnreadCount(userID) {
    try {
      const { data, error } = await supabase
        .rpc('get_unread_notification_count', { p_user_id: userID });

      if (error) throw error;

      return data || 0;
    } catch (error) {
      console.error('❌ Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   * @param {string} notificationID - Notification ID
   * @returns {Promise<boolean>} Success status
   */
  async markAsRead(notificationID) {
    try {
      const { error } = await supabase
        .rpc('mark_notification_read', { p_notification_id: notificationID });

      if (error) throw error;

      console.log('✅ Notification marked as read');
      return true;
    } catch (error) {
      console.error('❌ Error marking as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   * @param {string} userID - User ID
   * @returns {Promise<number>} Number of notifications marked as read
   */
  async markAllAsRead(userID) {
    try {
      const { data, error } = await supabase
        .rpc('mark_all_notifications_read', { p_user_id: userID });

      if (error) throw error;

      console.log(`✅ Marked ${data} notifications as read`);
      return data || 0;
    } catch (error) {
      console.error('❌ Error marking all as read:', error);
      return 0;
    }
  }

  /**
   * Delete (soft delete) a notification
   * @param {string} notificationID - Notification ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteNotification(notificationID) {
    try {
      const { error } = await supabase
        .rpc('delete_notification', { p_notification_id: notificationID });

      if (error) throw error;

      console.log('✅ Notification deleted');
      return true;
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      return false;
    }
  }

  /**
   * Clear all notifications for user
   * @param {string} userID - User ID
   * @returns {Promise<number>} Number of notifications deleted
   */
  async clearAllNotifications(userID) {
    try {
      const { data, error } = await supabase
        .rpc('clear_all_notifications', { p_user_id: userID });

      if (error) throw error;

      console.log(`✅ Cleared ${data} notifications`);
      return data || 0;
    } catch (error) {
      console.error('❌ Error clearing notifications:', error);
      return 0;
    }
  }

  /**
   * Subscribe to realtime notification updates
   * @param {string} userID - User ID
   * @param {function} callback - Callback function (receives notification)
   * @returns {object} Subscription object (call .unsubscribe() to stop listening)
   */
  subscribeToNotifications(userID, callback) {
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tbl_notifications',
          filter: `userID=eq.${userID}`,
        },
        (payload) => {
          console.log('📬 New notification received:', payload.new);
          callback(payload.new);
        }
      )
      .subscribe();

    return subscription;
  }

  /**
   * Navigate based on notification type
   * @param {object} notification - Notification object
   * @param {object} router - Expo router instance
   */
  handleNotificationNavigation(notification, router) {
    const { type, data } = notification;

    switch (type) {
      case 'pantry_expiration':
        // Navigate to pantry tab
        router.push('/(tabs)/pantry-new');
        break;

      case 'recipe_reminder':
        // Navigate to recipe detail if recipeID exists
        if (data?.recipeID) {
          router.push(`/recipe-detail/${data.recipeID}`);
        }
        break;

      case 'scheduled_recipe':
        // Navigate to scheduled recipes/planner
        if (data?.recipeID) {
          router.push(`/recipe-detail/${data.recipeID}`);
        }
        break;

      case 'system':
      default:
        // Stay on notifications screen or go to home
        router.push('/(tabs)/home');
        break;
    }
  }
}

export default new NotificationDatabaseService();
