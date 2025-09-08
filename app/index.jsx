import { StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import { useSupabase } from '../hooks/useSupabase';
import { useCustomAuth } from '../hooks/useCustomAuth';
import { DatabaseSetup } from '../lib/databaseSetup';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Recipe App!</Text>
      
      {/* Database Status Indicator */}
      {dbStatus && (
        <View style={[
          styles.statusCard, 
          dbStatus.success ? styles.statusSuccess : styles.statusWarning
        ]}>
          <Text style={styles.statusTitle}>
            {dbStatus.success ? '✅ Database Ready' : '⚠️ Database Setup Required'}
          </Text>
          {!dbStatus.success && (
            <View>
              <Text style={styles.statusText}>
                Custom tables not found. The app will work with basic Supabase auth, 
                but custom features require database setup.
              </Text>
              <TouchableOpacity 
                style={styles.setupButton}
                onPress={() => Alert.alert(
                  'Database Setup Required',
                  'Please run the SQL commands from database/schema.sql in your Supabase SQL Editor to enable all features.',
                  [{ text: 'OK' }]
                )}
              >
                <Text style={styles.setupButtonText}>View Setup Instructions</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      
      {user ? (
        <View style={styles.userSection}>
          <Text style={styles.userText}>Welcome back!</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          {customUserData && (
            <View style={styles.customDataSection}>
              <Text style={styles.customDataText}>Name: {customUserData.userName}</Text>
              <Text style={styles.customDataText}>
                Status: {customUserData.isVerified ? '✅ Verified' : '⏳ Pending Verification'}
              </Text>
              <Text style={styles.customDataText}>
                Member since: {new Date(customUserData.createdAt).toLocaleDateString()}
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.button} onPress={handleSignOut}>
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.authSection}>
          <TouchableOpacity style={styles.button} onPress={goToSignUp}>
            <Text style={styles.buttonText}>Sign Up</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={goToSignIn}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleTestConnection}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Testing Connection...' : 'Test Supabase Connection'}
        </Text>
      </TouchableOpacity>
      
      {error && (
        <Text style={styles.errorText}>Error: {error}</Text>
      )}
    </View>
  );
}

export default Home

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  userSection: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
  userText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
    textAlign: 'center',
    color: '#333',
  },
  userEmail: {
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 15,
    textAlign: 'center',
  },
  customDataSection: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    width: '100%',
  },
  customDataText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    textAlign: 'center',
  },
  statusCard: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 2,
  },
  statusSuccess: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
  },
  statusWarning: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 20,
  },
  setupButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'center',
  },
  setupButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  authSection: {
    width: '100%',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  diagnosticButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
  },
});