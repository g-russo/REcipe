import { StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import { useSupabase } from '../hooks/useSupabase';
import { useCustomAuth } from '../hooks/useCustomAuth';
import { DatabaseSetup } from '../lib/databaseSetup';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { globalStyles } from '../assets/css/globalStyles';
import { indexStyles } from '../assets/css/indexStyles';
import TopographicBackground from '../components/TopographicBackground';

const Home = () => {
  const { loading, error, testConnection } = useSupabase();
  const { user, customUserData, signOut } = useCustomAuth();
  const [dbStatus, setDbStatus] = useState(null);

  useEffect(() => {
    checkDatabaseSetup();
  }, []);

  const checkDatabaseSetup = async () => {
    try {
      const status = await DatabaseSetup.setupDatabase();
      setDbStatus(status);
      
      if (!status.success) {
        const tableInfo = await DatabaseSetup.getTableInfo();
        console.log('Database table info:', tableInfo);
      }
    } catch (err) {
      console.error('Database check error:', err);
      setDbStatus({ success: false, error: err.message });
    }
  };

  const handleTestConnection = async () => {
    try {
      await testConnection();
      Alert.alert('Success', 'Connected to Supabase successfully!');
    } catch (err) {
      Alert.alert('Error', `Failed to connect: ${err.message}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      Alert.alert('Success', 'Signed out successfully!');
    } catch (err) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const goToSignUp = () => {
    router.push('/signup');
  };

  const goToSignIn = () => {
    router.push('/signin');
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