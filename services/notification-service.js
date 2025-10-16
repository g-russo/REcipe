import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register device for push notifications
 * Returns Expo Push Token
 */
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('⚠️ Failed to get push token - permission denied');
      return null;
    }
    
    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      })).data;
      
      console.log('📱 Expo Push Token:', token);
    } catch (error) {
      console.error('❌ Error getting push token:', error);
      return null;
    }
  } else {
    console.warn('⚠️ Must use physical device for Push Notifications');
  }

  return token;
}

/**
 * Save push token to Supabase for user
 */
export async function savePushToken(userId, token) {
  if (!token) {
    console.warn('⚠️ No token to save');
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('user_push_tokens')
      .upsert({
        user_id: userId,
        push_token: token,
        device_type: Platform.OS,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) throw error;
    console.log('✅ Push token saved to database');
    return true;
  } catch (error) {
    console.error('❌ Error saving push token:', error.message);
    return false;
  }
}

/**
 * Send local notification (for testing)
 */
export async function scheduleLocalNotification(title, body, data = {}, seconds = 2) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: { seconds },
    });
    console.log(`✅ Notification scheduled for ${seconds}s from now`);
  } catch (error) {
    console.error('❌ Error scheduling notification:', error);
  }
}

/**
 * Send immediate local notification
 */
export async function sendLocalNotification(title, body, data = {}) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // null = immediate
    });
    console.log('✅ Local notification sent');
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
}

/**
 * Listen for notification responses (when user taps notification)
 */
export function addNotificationResponseListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Listen for notifications received while app is foregrounded
 */
export function addNotificationReceivedListener(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('✅ All notifications cancelled');
}

/**
 * Get notification permissions status
 */
export async function getNotificationPermissions() {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}
