import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
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
        name="otp-verification" 
        options={{ 
          title: 'Verify Email',
          headerShown: true,
          headerBackVisible: false
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
        name="new-password" 
        options={{ 
          title: 'New Password',
          headerShown: true,
          headerBackVisible: false
        }} 
      />
    </Stack>
  );
}
