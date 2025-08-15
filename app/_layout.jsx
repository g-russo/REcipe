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
    </Stack>
  );
}
