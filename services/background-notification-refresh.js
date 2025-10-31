import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import ExpirationNotificationService from './expiration-notification-service';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKGROUND_NOTIFICATION_TASK = 'background-notification-refresh';

/**
 * Background Notification Refresh Service
 * Periodically checks for expiring items and schedules notifications
 * even when app is closed
 */

// Define the background task
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
  try {
    console.log('[Background] Checking for expiring items...');
    
    // Get current user ID from AsyncStorage
    const userID = await AsyncStorage.getItem('currentUserID');
    
    if (!userID) {
      console.log('[Background] No user logged in, skipping');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Schedule notifications for expiring items
    const summary = await ExpirationNotificationService.checkAndScheduleExpirationNotifications(userID);
    
    console.log('[Background] Notifications refreshed:', summary);
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[Background] Error refreshing notifications:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register background fetch task
 * Android: Runs at specified interval (minimum 15 minutes)
 */
export const registerBackgroundNotificationRefresh = async () => {
  try {
    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    
    if (isRegistered) {
      console.log('[Background] Task already registered');
      return;
    }

    // Register the task (Android only)
    await BackgroundFetch.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
      minimumInterval: 60 * 60 * 12, // 12 hours (in seconds)
      stopOnTerminate: false, // Continue after app is killed
      startOnBoot: true, // Start after device reboot (Android)
    });

    console.log('[Background] Task registered successfully');
  } catch (error) {
    console.error('[Background] Error registering task:', error);
  }
};

/**
 * Unregister background task (for testing or user preference)
 */
export const unregisterBackgroundNotificationRefresh = async () => {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    console.log('[Background] Task unregistered');
  } catch (error) {
    console.error('[Background] Error unregistering task:', error);
  }
};

/**
 * Get background fetch status
 */
export const getBackgroundFetchStatus = async () => {
  const status = await BackgroundFetch.getStatusAsync();
  const statusText = {
    [BackgroundFetch.BackgroundFetchStatus.Restricted]: 'Restricted',
    [BackgroundFetch.BackgroundFetchStatus.Denied]: 'Denied',
    [BackgroundFetch.BackgroundFetchStatus.Available]: 'Available',
  };
  
  return {
    status: statusText[status] || 'Unknown',
    isAvailable: status === BackgroundFetch.BackgroundFetchStatus.Available,
  };
};

export default {
  registerBackgroundNotificationRefresh,
  unregisterBackgroundNotificationRefresh,
  getBackgroundFetchStatus,
};
