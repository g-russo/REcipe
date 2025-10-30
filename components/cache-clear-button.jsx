import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { interactiveCacheCleanup, getStorageInfo } from '../utils/cache-cleanup';

/**
 * ONE-TIME Cache Clear Component
 * Clears OLD AsyncStorage cache that was filling up phone storage
 * All NEW caching goes to Supabase (unlimited space)
 * 
 * ⚠️ You can remove this component after all users have cleared their cache once
 */
export default function CacheClearButton() {
  const [storageInfo, setStorageInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [needsCleanup, setNeedsCleanup] = useState(false);

  // Check storage on mount
  useEffect(() => {
    checkStorage();
  }, []);

  const checkStorage = async () => {
    try {
      setLoading(true);
      const info = await getStorageInfo();
      
      if (info) {
        setStorageInfo(info);
        
        // Check if there are cache keys (needs cleanup)
        const cacheKeys = info.keys.filter(item => 
          item.key.includes('cache') || 
          item.key.includes('recipe')
        );
        
        setNeedsCleanup(cacheKeys.length > 0);
        
        if (cacheKeys.length > 0) {
          const cacheSizeMB = (cacheKeys.reduce((sum, item) => sum + item.size, 0) / 1024 / 1024).toFixed(2);
          console.log(`⚠️ Found ${cacheKeys.length} old cache items using ${cacheSizeMB}MB`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to check storage:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    setLoading(true);
    try {
      await interactiveCacheCleanup();
      // Refresh storage info after cleanup
      await checkStorage();
    } finally {
      setLoading(false);
    }
  };

  // Don't show button if no cleanup needed
  if (!loading && !needsCleanup) {
    return (
      <View style={styles.container}>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>✅ Storage Clean!</Text>
          <Text style={styles.infoText}>
            All caching now uses Supabase cloud storage.{'\n'}
            No device storage issues. 🎉
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚠️ One-Time Cleanup Required</Text>
      
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          Old cache found on device ({storageInfo?.totalSizeMB || '?'}MB)
        </Text>
        <Text style={styles.warningSubtext}>
          Tap below to free up space. All future caching uses Supabase (unlimited).
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.clearButton, needsCleanup && styles.pulseButton]}
        onPress={handleClearCache}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? '⏳ Checking...' : '🧹 Clear Old Cache'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.warningText}>
        ⚠️ Use this if you see "database or disk is full" errors
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginVertical: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
    marginBottom: 15,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
    marginBottom: 5,
    textAlign: 'center',
  },
  warningSubtext: {
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#d4edda',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  infoTitle: {
    fontSize: 16,
    color: '#155724',
    fontWeight: '600',
    marginBottom: 5,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 13,
    color: '#155724',
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#ff6b6b',
  },
  pulseButton: {
    backgroundColor: '#ff6b6b',
    elevation: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
