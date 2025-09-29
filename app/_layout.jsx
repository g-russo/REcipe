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
        
        console.log('✅ RootLayout: Background initialization complete');
        
        // Hide splash screen after initialization
        setTimeout(async () => {
          await SplashScreen.hideAsync();
        }, 100);
        
      } catch (error) {
        console.error('❌ RootLayout: Background initialization failed:', error);
        // Still hide splash screen even if initialization fails
        await SplashScreen.hideAsync();
      }
    }

    initializeApp();
  }, []);

  return (
    <SupabaseProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{
      headerStyle: {
        backgroundColor: '#4CAF50',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    }}>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'REcipe Home',
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="signup" 
        options={{ 
          title: 'Sign Up',
          headerShown: true 
        }} 
      />
      <Stack.Screen 
        name="signin" 
        options={{ 
          title: 'Sign In',
          headerShown: true 
        }} 
      />
      <Stack.Screen 
        name="forgot-password" 
        options={{ 
          title: 'Forgot Password',
          headerShown: true 
        }} 
      />
      <Stack.Screen 
        name="reset-password-otp" 
        options={{ 
          title: 'Enter Reset Code',
          headerShown: true,
          headerBackVisible: false
        }} 
      />
      <Stack.Screen 
        name="otp-verification" 
        options={{ 
          title: 'Verify Email',
          headerShown: true,
          headerBackVisible: false
        }} 
      />
      <Stack.Screen 
        name="new-password" 
        options={{ 
          title: 'New Password',
          headerShown: true 
        }} 
      />
      <Stack.Screen 
        name="force-password-change" 
        options={{ 
          title: 'Change Password',
          headerShown: true,
          headerBackVisible: false
        }} 
      />
      <Stack.Screen 
        name="home" 
        options={{ 
          title: 'Home',
          headerShown: true,
          headerBackVisible: false
        }} 
      />
      <Stack.Screen 
        name="recipe-search" 
        options={{ 
          title: 'Recipe Search',
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="api-test" 
        options={{ 
          title: 'API Test',
          headerShown: true 
        }} 
      />
      <Stack.Screen 
        name="recipe-detail" 
        options={{ 
          title: 'Recipe Details',
          headerShown: true,
          headerBackTitle: 'Back'
        }} 
      />
    </Stack>
    </SupabaseProvider>
  );
}
