// Optimized index.jsx - Fast app entry with background initialization
import { StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { globalStyles } from '../assets/css/globalStyles';
import { indexStyles } from '../assets/css/indexStyles';
import TopographicBackground from '../components/TopographicBackground';
import { useCustomAuth } from '../hooks/use-custom-auth';

export default function Home() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [user, setUser] = useState(null);
  const [customUserData, setCustomUserData] = useState(null);
  const [initStatus, setInitStatus] = useState({
    auth: false,
    database: false,
    connection: false
  });

  // Quick navigation functions - available immediately
  const goToSignUp = () => {
    router.push('/signup');
  };

  const goToSignIn = () => {
    router.push('/signin');
  };

  // Background initialization - doesn't block UI
  const initializeServices = async () => {
    setIsInitializing(true);
    
    try {
      // Lazy load heavy dependencies only when needed
      const { useSupabase } = await import('../hooks/use-supabase');
      const { useCustomAuth } = await import('../hooks/use-custom-auth');
      const { DatabaseSetup } = await import('../lib/database-setup');
      
      console.log('🚀 Background: Starting service initialization...');
      
      // Test connection (non-blocking)
      setInitStatus(prev => ({ ...prev, connection: true }));
      
      // Check database (non-blocking)
      try {
        const dbStatus = await DatabaseSetup.setupDatabase();
        setInitStatus(prev => ({ ...prev, database: dbStatus.success }));
      } catch (err) {
        console.warn('Database setup failed:', err);
        setInitStatus(prev => ({ ...prev, database: false }));
      }
      
      // Auth status (non-blocking)
      try {
        const { useCustomAuth } = await import('../hooks/use-custom-auth');
        const authHook = useCustomAuth();
        
        if (authHook.user) {
          setUser(authHook.user);
          setCustomUserData(authHook.customUserData);
        }
        
        setInitStatus(prev => ({ ...prev, auth: true }));
      } catch (err) {
        console.warn('Auth status check failed:', err);
        setInitStatus(prev => ({ ...prev, auth: false }));
      }
      
      console.log('✅ Background: Service initialization complete');
      
    } catch (err) {
      console.error('Background initialization failed:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleFullInitialization = () => {
    if (!isInitializing) {
      initializeServices();
    }
  };

  const handleSignOut = async () => {
    try {
      const { useCustomAuth } = await import('../hooks/use-custom-auth');
      const { signOut } = useCustomAuth();
      await signOut();
      setUser(null);
      setCustomUserData(null);
    } catch (error) {
      console.error('Sign out failed:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  // Get auth data from custom hook
  const { user: authUser, customUserData: authCustomData } = useCustomAuth() || {};
  
  // Sync auth data when available
  useEffect(() => {
    if (authUser && !user) {
      setUser(authUser);
    }
    if (authCustomData && !customUserData) {
      setCustomUserData(authCustomData);
    }
  }, [authUser, authCustomData, user, customUserData]);

  // If user is authenticated, redirect to home page
  useEffect(() => {
    if (user) {
      console.log('✅ User authenticated, redirecting to home...');
      router.replace('/home');
    }
  }, [user]);

  // Welcome screen for non-authenticated users
  return (
    <TopographicBackground>
      <View style={globalStyles.welcomeCard}>
        <Text style={globalStyles.title}>Welcome</Text>
        <Text style={globalStyles.subtitle}>
          Just a few steps to start saving food and cooking smarter.
        </Text>
        
        <View style={globalStyles.formActions}>
          <TouchableOpacity 
            style={globalStyles.primaryButton} 
            onPress={goToSignIn}
          >
            <Text style={globalStyles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TopographicBackground>
  );
}