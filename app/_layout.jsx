// Do not remove, this is required for the app to run
// Add routing here
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { SupabaseProvider } from '../contexts/supabase-context';

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

        // Initialize cache service
        try {
          const { default: RecipeCacheService } = await import('../services/recipe-cache-service');
          await RecipeCacheService.initializeCache();
          console.log('✅ Cache service initialized');
        } catch (cacheError) {
          console.warn('⚠️ Cache service initialization failed:', cacheError);
        }

        // Initialize database setup
        try {
          const { initializeDatabase } = await import('../lib/database-setup');
          await initializeDatabase();
          console.log('✅ Database initialized');
        } catch (dbError) {
          console.warn('⚠️ Database initialization failed:', dbError);
        }

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
        <Stack.Screen name="home" options={{ title: 'Home' }} />
        <Stack.Screen name="signin" options={{ title: 'Sign In' }} />
        <Stack.Screen name="signup" options={{ title: 'Sign Up' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Reset Password' }} />
        <Stack.Screen name="otp-verification" options={{ title: 'Verify OTP' }} />
        <Stack.Screen name="reset-password-otp" options={{ title: 'Reset Password' }} />
        <Stack.Screen name="new-password" options={{ title: 'New Password' }} />
        <Stack.Screen name="force-password-change" options={{ title: 'Update Password' }} />
        <Stack.Screen name="recipe-search" options={{ title: 'Search Recipes' }} />
        <Stack.Screen name="recipe-detail" options={{ title: 'Recipe Details' }} />
      </Stack>
      <StatusBar style="auto" />
    </SupabaseProvider>
  );
}