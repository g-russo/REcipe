// Do not remove, this is required for the app to run
// Add routing here
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { SupabaseProvider } from '../contexts/supabase-context';
import { 
  registerForPushNotificationsAsync, 
  savePushToken,
  addNotificationResponseListener,
  addNotificationReceivedListener
} from '../services/notification-service';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';

// Keep the splash screen visible while we initialize
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    async function initializeApp() {
      try {
        console.log('🚀 RootLayout: Background initialization starting...');
        
        // Background font loading
        await Font.loadAsync({
          // Add custom fonts here if needed
        });

        // Initialize Supabase cache service (no initialization needed - lazy loaded)
        console.log('✅ Supabase cache service ready (lazy loaded on demand)');

        console.log('✅ RootLayout: Background initialization complete');
      } catch (error) {
        console.error('❌ RootLayout initialization error:', error);
      } finally {
        // Hide splash screen
        await SplashScreen.hideAsync();
      }
    }

    initializeApp();
  }, []);

  // Register for push notifications
  useEffect(() => {
    let notificationResponseSubscription;
    let notificationReceivedSubscription;

    async function setupNotifications() {
      try {
        console.log('📱 Setting up push notifications...');
        
        // Register for push notifications
        const token = await registerForPushNotificationsAsync();
        
        if (token) {
          console.log('✅ Push token received:', token.substring(0, 20) + '...');
          
          // Get current user and save token
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await savePushToken(user.id, token);
            console.log('✅ Push token saved to database');
          } else {
            console.log('ℹ️ No user logged in - token will be saved on login');
          }
        }

        // Listen for notification taps (when user clicks on notification)
        notificationResponseSubscription = addNotificationResponseListener(response => {
          console.log('📱 Notification tapped:', response);
          const data = response.notification.request.content.data;
          
          // Navigate based on notification data
          if (data?.screen === 'pantry') {
            // TODO: Navigate to pantry screen
            console.log('🥕 Navigate to pantry');
          } else if (data?.screen === 'recipe-detail' && data?.recipeId) {
            // TODO: Navigate to recipe detail
            console.log('🍳 Navigate to recipe:', data.recipeId);
          } else if (data?.screen === 'home') {
            // TODO: Navigate to home
            console.log('🏠 Navigate to home');
          }
        });

        // Listen for notifications received while app is open
        notificationReceivedSubscription = addNotificationReceivedListener(notification => {
          console.log('📬 Notification received while app open:', notification.request.content);
        });

        console.log('✅ Push notifications set up successfully');
      } catch (error) {
        console.error('❌ Push notification setup error:', error);
      }
    }

    setupNotifications();

    // Cleanup subscriptions
    return () => {
      notificationResponseSubscription?.remove();
      notificationReceivedSubscription?.remove();
    };
  }, []);

  return (
    <SupabaseProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Welcome' }} />
        <Stack.Screen
          name="(tabs)"
          options={{
            title: 'Main',
            headerShown: false,
            animation: 'none', // No animation for tabs
          }}
        />
        <Stack.Screen name="signin" options={{ title: 'Sign In' }} />
        <Stack.Screen name="signup" options={{ title: 'Sign Up' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Reset Password' }} />
        <Stack.Screen name="otp-verification" options={{ title: 'Verify OTP' }} />
        <Stack.Screen name="reset-password-otp" options={{ title: 'Reset Password' }} />
        <Stack.Screen name="new-password" options={{ title: 'New Password' }} />
        <Stack.Screen name="force-password-change" options={{ title: 'Update Password' }} />
        <Stack.Screen name="recipe-detail" options={{ title: 'Recipe Details' }} />
        <Stack.Screen name="food-recognition/upload" options={{ title: 'Food Recognition' }} />
        <Stack.Screen name="food-recognition/result" options={{ title: 'Result' }} />
      </Stack>
      <StatusBar style="auto" />
    </SupabaseProvider>
  );
}