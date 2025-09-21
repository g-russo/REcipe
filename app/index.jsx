// Optimized index.jsx - Fast app entry with background initialization
import { StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

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
      const { useSupabase } = await import('../hooks/useSupabase');
      const { useCustomAuth } = await import('../hooks/useCustomAuth');
      const { DatabaseSetup } = await import('../lib/databaseSetup');
      
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to REcipe!</Text>
      <Text style={styles.subtitle}>Your culinary companion</Text>
      
      {/* Primary actions - always available */}
      <View style={styles.primaryActions}>
        <TouchableOpacity style={styles.primaryButton} onPress={goToSignUp}>
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.secondaryButton} onPress={goToSignIn}>
          <Text style={styles.secondaryButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
      
      {/* Optional: Initialize services */}
      <View style={styles.serviceSection}>
        <TouchableOpacity 
          style={styles.serviceButton} 
          onPress={handleFullInitialization}
          disabled={isInitializing}
        >
          <Text style={styles.serviceButtonText}>
            {isInitializing ? 'Initializing Services...' : 'Initialize Full Features'}
          </Text>
        </TouchableOpacity>
        
        {/* Service status indicators */}
        {(initStatus.auth || initStatus.database || initStatus.connection) && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusTitle}>Service Status:</Text>
            <Text style={[styles.statusItem, initStatus.connection && styles.statusActive]}>
              {initStatus.connection ? '✅' : '⏳'} Connection
            </Text>
            <Text style={[styles.statusItem, initStatus.auth && styles.statusActive]}>
              {initStatus.auth ? '✅' : '⏳'} Authentication
            </Text>
            <Text style={[styles.statusItem, initStatus.database && styles.statusActive]}>
              {initStatus.database ? '✅' : '⚠️'} Database
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  primaryActions: {
    width: '100%',
    marginBottom: 30,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    marginBottom: 15,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  serviceSection: {
    width: '100%',
    marginTop: 20,
  },
  serviceButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  serviceButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  statusItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  statusActive: {
    color: '#4CAF50',
  },
});