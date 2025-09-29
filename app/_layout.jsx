import { Stack } from 'expo-router';
import { useEffect } from 'react';

export default function RootLayout() {
  useEffect(() => {
    // Ensure router is properly initialized
    console.log('Router layout mounted');
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#8DB896',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
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
          headerShown: true 
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
        name="database-test" 
        options={{ 
          title: 'Database Test',
          headerShown: true 
        }} 
      />
    </Stack>
  );
}
