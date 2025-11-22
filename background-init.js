import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { SupabaseProvider } from './contexts/supabase-context';
import RootLayout from './app/_layout';

// Keep the splash screen visible while we fetch resources
// Wrap in try-catch to prevent crashes on some Android devices
try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  console.warn('SplashScreen.preventAutoHideAsync() failed:', e);
}

export default function BackgroundInit() {
  useEffect(() => {
    async function BackgroundInit() {
      try {
        console.log('🚀 App.js: Background initialization starting...');
        
        // Background font loading
        await Font.loadAsync({
          // Add custom fonts here if needed
        });
        
        console.log('✅ App.js: Background initialization complete');
        
        // Hide splash screen after a short delay to ensure router is ready
        setTimeout(async () => {
          try {
            await SplashScreen.hideAsync();
          } catch (e) {
            console.warn('SplashScreen.hideAsync() failed:', e);
          }
        }, 100);
        
      } catch (error) {
        console.error('❌ App.js: Background initialization failed:', error);
        // Still hide splash screen even if initialization fails
        try {
          await SplashScreen.hideAsync();
        } catch (e) {
          console.warn('SplashScreen.hideAsync() failed:', e);
        }
      }
    }

    BackgroundInit();
  }, []);

  // Just return the router layout - no UI here
  return (
    <SupabaseProvider>
      <StatusBar style="auto" />
      <RootLayout />
    </SupabaseProvider>
  );
}