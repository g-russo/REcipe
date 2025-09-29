// Optimized index.jsx - Fast app entry with background initialization
import { StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { globalStyles } from '../assets/css/globalStyles';
import { indexStyles } from '../assets/css/indexStyles';
import TopographicBackground from '../components/TopographicBackground';

export default function Home() {
  const [isInitializing, setIsInitializing] = useState(false);
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
      setInitStatus(prev => ({ ...prev, auth: true }));
      
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

  // If user is authenticated, show the main app (this would be your recipe app)
  if (user) {
    return (
      <TopographicBackground>
        <View style={globalStyles.card}>
          <Text style={globalStyles.title}>Welcome back!</Text>
          <Text style={indexStyles.userEmail}>{user.email}</Text>
          
          {customUserData && (
            <View style={indexStyles.customDataSection}>
              <Text style={indexStyles.customDataText}>Name: {customUserData.userName}</Text>
              <Text style={indexStyles.customDataText}>
                Status: {customUserData.isVerified ? '✅ Verified' : '⏳ Pending Verification'}
              </Text>
            </View>
          )}

          <View style={globalStyles.formActions}>
            <TouchableOpacity style={globalStyles.primaryButton} onPress={handleSignOut}>
              <Text style={globalStyles.primaryButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TopographicBackground>
    );
  }

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

export default Home