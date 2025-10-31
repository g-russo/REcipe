import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import PantryService from './pantry-service';

/**
 * Expiration Notifications Service
 * Manages notifications for items expiring within 3 days
 */

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class ExpirationNotificationService {
  /**
   * Request notification permissions
   * @returns {Promise<boolean>} Whether permission was granted
   */
  async requestPermissions() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('⚠️ Notification permissions not granted');
        return false;
      }

      // For Android, set up notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('pantry-expiration', {
          name: 'Pantry Expiration Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF9800',
          sound: 'default',
        });
      }

      console.log('✅ Notification permissions granted');
      return true;
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Calculate days until expiration
   * @param {string} expirationDate - ISO date string
   * @returns {number} Days until expiration (negative if expired)
   */
  calculateDaysUntilExpiration(expirationDate) {
    if (!expirationDate) return null;
    
    const expiry = new Date(expirationDate);
    const today = new Date();
    
    // Reset time to start of day for accurate day calculation
    expiry.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  /**
   * Schedule notification for an expiring item
   * @param {Object} item - Item object from database
   * @param {number} daysUntilExpiry - Days until expiration
   * @returns {Promise<string>} Notification ID
   */
  async scheduleExpirationNotification(item, daysUntilExpiry) {
    try {
      let title, body, trigger;

      if (daysUntilExpiry === 0) {
        // Expires today
        title = '🔴 Item Expires Today!';
        body = `"${item.itemName}" expires today. Use it soon!`;
        trigger = {
          hour: 9,
          minute: 0,
          repeats: false,
        };
      } else if (daysUntilExpiry === 1) {
        // Expires tomorrow
        title = '🟠 Item Expires Tomorrow';
        body = `"${item.itemName}" expires tomorrow. Plan to use it!`;
        trigger = {
          hour: 9,
          minute: 0,
          repeats: false,
        };
      } else if (daysUntilExpiry <= 3) {
        // Expires in 2-3 days
        title = '🟡 Item Expiring Soon';
        body = `"${item.itemName}" expires in ${daysUntilExpiry} days.`;
        trigger = {
          hour: 9,
          minute: 0,
          repeats: false,
        };
      } else {
        // Don't schedule for items more than 3 days away
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type: 'pantry_expiration',
            itemID: item.itemID,
            itemName: item.itemName,
            expirationDate: item.itemExpiration,
            daysUntilExpiry,
          },
          categoryIdentifier: 'pantry-expiration',
          sound: 'default',
        },
        trigger,
      });

      console.log(`✅ Scheduled notification for "${item.itemName}" (${daysUntilExpiry} days)`);
      return notificationId;
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Cancel all pantry expiration notifications
   * @returns {Promise<void>}
   */
  async cancelAllExpirationNotifications() {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      // Filter pantry expiration notifications
      const pantryNotifications = scheduledNotifications.filter(
        notif => notif.content.data?.type === 'pantry_expiration'
      );

      // Cancel each one
      for (const notif of pantryNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }

      console.log(`✅ Cancelled ${pantryNotifications.length} pantry notifications`);
    } catch (error) {
      console.error('❌ Error cancelling notifications:', error);
    }
  }

  /**
   * Check all items and schedule notifications for those expiring within 3 days
   * @param {number} userID - User ID
   * @returns {Promise<Object>} Summary of scheduled notifications
   */
  async checkAndScheduleExpirationNotifications(userID) {
    try {
      console.log('🔍 Checking for expiring items...');

      // Get all user items
      const items = await PantryService.getUserItems(userID);

      // Cancel all existing notifications first
      await this.cancelAllExpirationNotifications();

      const summary = {
        total: items.length,
        expiringSoon: 0,
        expiringToday: 0,
        expiringTomorrow: 0,
        expired: 0,
        scheduled: [],
      };

      for (const item of items) {
        if (!item.itemExpiration) continue;

        const daysUntilExpiry = this.calculateDaysUntilExpiration(item.itemExpiration);
        
        if (daysUntilExpiry === null) continue;

        // Track expired items
        if (daysUntilExpiry < 0) {
          summary.expired++;
          continue;
        }

        // Schedule notifications for items expiring within 3 days
        if (daysUntilExpiry <= 3) {
          summary.expiringSoon++;
          
          if (daysUntilExpiry === 0) {
            summary.expiringToday++;
          } else if (daysUntilExpiry === 1) {
            summary.expiringTomorrow++;
          }

          const notificationId = await this.scheduleExpirationNotification(item, daysUntilExpiry);
          
          if (notificationId) {
            summary.scheduled.push({
              itemID: item.itemID,
              itemName: item.itemName,
              daysUntilExpiry,
              notificationId,
            });
          }
        }
      }

      console.log('📊 Expiration check summary:', {
        total: summary.total,
        expiringSoon: summary.expiringSoon,
        expiringToday: summary.expiringToday,
        expiringTomorrow: summary.expiringTomorrow,
        expired: summary.expired,
        scheduled: summary.scheduled.length,
      });

      return summary;
    } catch (error) {
      console.error('❌ Error checking expiration notifications:', error);
      return null;
    }
  }

  /**
   * Send immediate notification for critical expirations
   * @param {Object} item - Item object
   * @param {string} message - Custom message
   * @returns {Promise<string>} Notification ID
   */
  async sendImmediateNotification(item, message) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚨 Pantry Alert',
          body: message || `"${item.itemName}" needs attention!`,
          data: {
            type: 'pantry_immediate',
            itemID: item.itemID,
            itemName: item.itemName,
          },
          sound: 'default',
        },
        trigger: null, // Send immediately
      });

      return notificationId;
    } catch (error) {
      console.error('❌ Error sending immediate notification:', error);
      return null;
    }
  }

  /**
   * Get items expiring within specified days
   * @param {number} userID - User ID
   * @param {number} days - Days threshold (default: 3)
   * @returns {Promise<Array>} Array of expiring items with days info
   */
  async getExpiringItems(userID, days = 3) {
    try {
      const items = await PantryService.getUserItems(userID);
      
      const expiringItems = items
        .filter(item => {
          if (!item.itemExpiration) return false;
          const daysUntilExpiry = this.calculateDaysUntilExpiration(item.itemExpiration);
          return daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= days;
        })
        .map(item => ({
          ...item,
          daysUntilExpiry: this.calculateDaysUntilExpiration(item.itemExpiration),
        }))
        .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

      return expiringItems;
    } catch (error) {
      console.error('❌ Error getting expiring items:', error);
      return [];
    }
  }

  /**
   * Setup notification listener for when user taps notification
   * @param {Function} callback - Function to call when notification is tapped
   * @returns {Object} Subscription object
   */
  setupNotificationListener(callback) {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (data.type === 'pantry_expiration' || data.type === 'pantry_immediate') {
        callback(data);
      }
    });

    return subscription;
  }

  /**
   * Remove notification listener
   * @param {Object} subscription - Subscription object from setupNotificationListener
   */
  removeNotificationListener(subscription) {
    if (subscription) {
      subscription.remove();
    }
  }
}

export default new ExpirationNotificationService();
